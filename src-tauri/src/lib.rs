//! Fintrax desktop launcher.
//!
//! On startup this:
//!   1. resolves a per-user data dir under %APPDATA%/com.fintrax.app,
//!   2. picks a fixed port (8765, or a free one if taken) so the webview
//!      origin — and thus the localStorage JWT/theme — stays stable,
//!   3. spawns the bundled Django sidecar (`fintrax-server`),
//!   4. shows a splash window, polls the sidecar's /health/ endpoint, then
//!      opens the real window on http://127.0.0.1:<port>/ and closes the splash,
//!   5. kills the sidecar when the app exits (no orphaned python process).

use std::net::TcpListener;
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Holds the sidecar handle so we can kill it on exit.
#[derive(Default)]
struct SidecarState(Mutex<Option<CommandChild>>);

const PREFERRED_PORT: u16 = 8765;

/// Return PREFERRED_PORT if it's bindable, else an OS-assigned free port.
fn pick_port() -> u16 {
    if TcpListener::bind(("127.0.0.1", PREFERRED_PORT)).is_ok() {
        return PREFERRED_PORT;
    }
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(PREFERRED_PORT)
}

/// Block until the sidecar answers /health/ with 200, or time out (~40s).
fn wait_for_health(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{port}/health/");
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .expect("failed to build http client");
    for _ in 0..200 {
        if let Ok(resp) = client.get(&url).send() {
            if resp.status().is_success() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Second launch: focus the existing window instead of starting
            // another sidecar.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            } else if let Some(w) = app.get_webview_window("splash") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState::default())
        .setup(|app| {
            let handle = app.handle().clone();

            // Per-user data dir (created by the sidecar if missing).
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");
            let data_dir_str = data_dir.to_string_lossy().to_string();

            let port = pick_port();

            // Splash while the backend boots.
            let _ = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("index.html".into()))
                .title("Fintrax")
                .inner_size(420.0, 320.0)
                .resizable(false)
                .center()
                .build();

            // Spawn the Django sidecar.
            let (_rx, child) = app
                .shell()
                .sidecar("fintrax-server")
                .expect("fintrax-server sidecar not found")
                .args([
                    "--port",
                    &port.to_string(),
                    "--data-dir",
                    &data_dir_str,
                ])
                .spawn()
                .expect("failed to spawn fintrax-server");

            app.state::<SidecarState>().0.lock().unwrap().replace(child);

            // Wait for readiness off the main thread, then swap splash -> app.
            std::thread::spawn(move || {
                let ready = wait_for_health(port);
                let url = format!("http://127.0.0.1:{port}/");

                if ready {
                    let built = WebviewWindowBuilder::new(
                        &handle,
                        "main",
                        WebviewUrl::External(url.parse().expect("bad url")),
                    )
                    .title("Fintrax")
                    .inner_size(1280.0, 800.0)
                    .min_inner_size(900.0, 600.0)
                    .center()
                    .build();

                    if built.is_ok() {
                        if let Some(splash) = handle.get_webview_window("splash") {
                            let _ = splash.close();
                        }
                    }
                } else {
                    // Backend never came up; surface the failure instead of
                    // spinning forever on the splash.
                    if let Some(splash) = handle.get_webview_window("splash") {
                        let _ = splash.eval(
                            "document.body.innerHTML = \
                             '<div style=\\'font-family:system-ui;color:#e2e8f0;text-align:center\\'>\
                             Fintrax failed to start.<br>Please restart the app.</div>';",
                        );
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                // Terminate the sidecar so no python process is orphaned.
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        kill_tree(child);
                    }
                }
            }
        });
}

/// Kill the sidecar *and its descendants*.
///
/// PyInstaller onefile re-execs: the process we spawned is a bootstrap that
/// forks the real waitress/Django worker. `CommandChild::kill()` only reaps the
/// direct child, orphaning that worker (which keeps holding the port). On
/// Windows `taskkill /T` walks the whole tree; `child.kill()` is the fallback.
fn kill_tree(child: CommandChild) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &child.pid().to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    let _ = child.kill();
}
