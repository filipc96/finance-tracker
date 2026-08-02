import { Link } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faWallet } from "@fortawesome/free-solid-svg-icons";
import Button from "./ui/Button";
import PasswordInput from "./ui/PasswordInput";
import RecoveryKeyPanel from "./RecoveryKeyPanel";
import { CURRENCY_OPTIONS } from "../utils/formatCurrency";

const Form = ({
  route,
  method,
  initialUsername = "",
  lockUsername = false,
  footer,
  onForgotPassword,
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  // Base currency is chosen once at registration and then locked (it's the
  // accounting currency of every stored amount). Only shown on the register
  // form; login ignores it.
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // On desktop, registration returns a one-time recovery key we must surface
  // before letting the user continue to login.
  const [recoveryKey, setRecoveryKey] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    setLoading(true);
    setErrorMsg("");
    e.preventDefault();

    try {
      const body = { username, password };
      if (method != "login") body.base_currency = baseCurrency;
      const res = await api.post(route, body);
      if (method == "login") {
        localStorage.setItem(ACCESS_TOKEN, res.data.access);
        localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
        navigate("/");
      } else if (res.data?.recovery_key) {
        setRecoveryKey(res.data.recovery_key);
      } else {
        navigate("/login");
      }
    } catch (error) {
      const status = error.response?.status;
      if (status === 401) {
        setErrorMsg(t("auth.errWrongCredentials"));
      } else if (status === 400 && error.response?.data?.username) {
        setErrorMsg(error.response.data.username[0]);
      } else if (status === 400 && error.response?.data?.password) {
        setErrorMsg(error.response.data.password[0]);
      } else {
        setErrorMsg(t("auth.errGeneric"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl md:p-12">
        {recoveryKey ? (
          <RecoveryKeyPanel
            recoveryKey={recoveryKey}
            onContinue={() => navigate("/login")}
          />
        ) : (
          <>
            <div className="mb-8 flex flex-col items-center gap-3">
              <div className="rounded-xl bg-black p-3">
                <FontAwesomeIcon
                  icon={faWallet}
                  className="text-2xl text-white"
                />
              </div>
              <span className="logo-text text-xl font-bold">Fintrax</span>
              <h2 className="!text-gray-900">
                {method == "login"
                  ? t("auth.welcomeBack")
                  : t("auth.createAccount")}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  {t("auth.username")}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-3.5 text-sm text-gray-900
                      placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                      disabled:opacity-70"
                    onChange={(e) => setUsername(e.target.value)}
                    value={username}
                    placeholder={t("auth.usernamePlaceholder")}
                    disabled={lockUsername}
                    required
                  />
                </div>
              </div>

              <PasswordInput
                label={t("auth.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                required
              />

              {method != "login" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t("auth.baseCurrency")}
                  </label>
                  <select
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 px-3.5 text-sm text-gray-900
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    {t("auth.baseCurrencyNote")}
                  </p>
                </div>
              )}

              {onForgotPassword && (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="-mt-2 self-end text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  {t("auth.forgotPassword")}
                </button>
              )}

              {errorMsg && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {errorMsg}
                </p>
              )}

              <Button type="submit" isLoading={loading} className="w-full">
                {method == "login" ? t("auth.signIn") : t("auth.signUp")}
              </Button>
            </form>

            {footer !== undefined ? (
              footer
            ) : (
              <div className="mt-6 text-center text-sm text-gray-500">
                {method == "login" ? (
                  <>
                    {`${t("auth.noAccount")} `}
                    <Link
                      to="/register"
                      className="font-semibold text-primary-600 hover:text-primary-700"
                    >
                      {t("auth.signUpFree")}
                    </Link>
                  </>
                ) : (
                  <>
                    {t("auth.haveAccount")}{" "}
                    <Link
                      to="/login"
                      className="font-semibold text-primary-600 hover:text-primary-700"
                    >
                      {t("auth.signIn")}
                    </Link>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Form;
