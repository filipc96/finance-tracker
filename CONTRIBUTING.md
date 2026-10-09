# Contributing

Thanks for your interest in Fintrax! This is a personal project open-sourced
to share code and invite collaboration.

## Quick start

```bash
git clone https://github.com/filipc96/finance-tracker.git
cd finance-tracker
```

See [README.md](README.md#building-from-source) for setup instructions.

## Development guidelines

- **Backend:** Python 3.13+, Django 4.2, DRF. Tests in `backend/api/tests.py`.
  Run with `python manage.py test`.
- **Frontend:** React 18, Vite, Vitest. Run with `npm test` in `frontend/`.
- **Rust/Tauri:** Tauri 2. Run tests with `cargo test` in `src-tauri/`.
- **Lint:** `ruff check backend/` for Python; `npm run lint` for the frontend.

## PR checklist

- [ ] Backend tests pass (`python manage.py test`)
- [ ] Frontend tests pass (`npm test`)
- [ ] No new linter warnings
- [ ] Conventional commit message (`feat:`, `fix:`, `docs:`, etc.)
- [ ] Screenshots updated if UI changed

## License

MIT — see [LICENSE](LICENSE). By contributing, you agree that your
contributions are licensed under the same terms.