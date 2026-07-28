import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../api";
import Form from "../components/Form";
import Button from "../components/ui/Button";
import PasswordInput from "../components/ui/PasswordInput";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWallet,
  faUser,
  faPlus,
  faArrowLeft,
  faKey,
} from "@fortawesome/free-solid-svg-icons";

// Desktop-only logged-out landing. Because each app launch spawns a fresh
// sidecar, the master-password vault is always locked at startup — so even with
// a still-valid cached token the user lands here and must re-enter a password,
// which is what unlocks their encrypted secrets for the session.
//
// Modes: pick (tiles) -> password (unlock a chosen account) | register (new) |
// recover (forgot password, reset with the recovery key).
const AccountPicker = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState(null); // null = loading
  const [mode, setMode] = useState("pick");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    api
      .get("/api/accounts/")
      .then((res) => {
        setAccounts(res.data);
        // No accounts yet on this machine -> go straight to registration.
        if (res.data.length === 0) setMode("register");
      })
      .catch(() => setAccounts([]));
  }, []);

  const backToPick = () => {
    setSelected("");
    setMode("pick");
  };

  if (mode === "password") {
    return (
      <Form
        route="/api/token/"
        method="login"
        initialUsername={selected}
        lockUsername
        onForgotPassword={() => setMode("recover")}
        footer={
          <button
            type="button"
            onClick={backToPick}
            className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            {t("accountPicker.chooseDifferent")}
          </button>
        }
      />
    );
  }

  if (mode === "register") {
    return (
      <Form
        route="/api/user/register/"
        method="user/register"
        footer={
          accounts && accounts.length > 0 ? (
            <button
              type="button"
              onClick={backToPick}
              className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              {t("accountPicker.backToAccounts")}
            </button>
          ) : null
        }
      />
    );
  }

  if (mode === "recover") {
    return (
      <RecoverForm username={selected} onDone={() => setMode("password")} onBack={backToPick} />
    );
  }

  // mode === "pick"
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl md:p-12">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="rounded-xl bg-black p-3">
            <FontAwesomeIcon icon={faWallet} className="text-2xl text-white" />
          </div>
          <span className="logo-text text-xl font-bold">Fintrax</span>
          <h2 className="!text-gray-900">{t("accountPicker.chooseAccount")}</h2>
        </div>

        <div className="flex flex-col gap-2">
          {accounts === null ? (
            <p className="text-center text-sm text-gray-500">
              {t("common.loading")}
            </p>
          ) : (
            accounts.map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => {
                  setSelected(acc.username);
                  setMode("password");
                }}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left
                  hover:border-primary-400 hover:bg-primary-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <FontAwesomeIcon icon={faUser} />
                </span>
                <span className="font-medium text-gray-900">
                  {acc.username}
                </span>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => setMode("register")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed
            border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
        >
          <FontAwesomeIcon icon={faPlus} />
          {t("accountPicker.newAccount")}
        </button>
      </div>
    </div>
  );
};

// Forgotten-password reset using the one-time recovery key. Resets both the
// vault's password wrapping and the Django auth password; no data is lost.
const RecoverForm = ({ username, onDone, onBack }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(username || "");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      await api.post("/api/vault/recover/", {
        username: name,
        recovery_key: recoveryKey,
        new_password: newPassword,
      });
      setDone(true);
    } catch (error) {
      setErrorMsg(error.response?.data?.error || t("auth.errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl md:p-12">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="rounded-xl bg-primary-600 p-3">
            <FontAwesomeIcon icon={faKey} className="text-2xl text-white" />
          </div>
          <h2 className="!text-gray-900">{t("accountPicker.resetTitle")}</h2>
          <p className="text-center text-sm text-gray-500">
            {t("accountPicker.resetIntro")}
          </p>
        </div>

        {done ? (
          <div className="flex flex-col gap-5">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {t("accountPicker.passwordReset")}
            </p>
            <Button type="button" onClick={onDone} className="w-full">
              {t("accountPicker.backToSignIn")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                {t("accountPicker.username")}
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 px-3.5 text-sm text-gray-900
                  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.usernamePlaceholder")}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                {t("accountPicker.recoveryKey")}
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 px-3.5 font-mono text-sm text-gray-900
                  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={2}
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                placeholder={t("accountPicker.recoveryKeyPlaceholder")}
                required
              />
            </div>

            <PasswordInput
              label={t("accountPicker.newPassword")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("accountPicker.newPasswordPlaceholder")}
              required
            />

            {errorMsg && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMsg}
              </p>
            )}

            <Button type="submit" isLoading={loading} className="w-full">
              {t("accountPicker.resetPassword")}
            </Button>

            <button
              type="button"
              onClick={onBack}
              className="flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              {t("accountPicker.backToAccounts")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AccountPicker;
