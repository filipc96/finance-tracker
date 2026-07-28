import ToggleButton from "../components/ToggleButton";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { CURRENCY_OPTIONS } from "../utils/formatCurrency";
import { LANGUAGES, setLanguage } from "../i18n";
import api from "../api";
import toast from "react-hot-toast";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import PasswordInput from "../components/ui/PasswordInput";
import Button from "../components/ui/Button";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const { baseCurrency, displayCurrency, changeDisplay } = useCurrency();
  const [language, setLanguageState] = useState(i18n.language);
  const [apiKey, setApiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [lmstudioUrl, setLmstudioUrl] = useState("");
  const [t212Key, setT212Key] = useState("");
  const [t212Secret, setT212Secret] = useState("");
  const [t212Environment, setT212Environment] = useState("live");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramAllowedId, setTelegramAllowedId] = useState("");
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Whether a secret is already stored server-side. The raw keys are never
  // sent back to the browser, so the inputs stay empty and these flags drive
  // the "already saved — leave blank to keep" affordance.
  const [hasKeys, setHasKeys] = useState({
    open_ai: false,
    anthropic: false,
    t212_key: false,
    t212_secret: false,
  });

  useEffect(() => {
    api.get("/api/settings/").then((response) => {
      setLlmProvider(response.data.llm_provider || "openai");
      setLlmModel(response.data.llm_model || "");
      setOllamaUrl(response.data.ollama_base_url || "");
      setLmstudioUrl(response.data.lmstudio_base_url || "");
      setT212Environment(response.data.t212_environment || "live");
      setTelegramEnabled(!!response.data.telegram_enabled);
      setTelegramToken(response.data.telegram_bot_token || "");
      setTelegramAllowedId(response.data.telegram_allowed_user_id || "");
      if (response.data.language) setLanguageState(response.data.language);
      setHasKeys({
        open_ai: !!response.data.has_open_ai_api_key,
        anthropic: !!response.data.has_anthropic_api_key,
        t212_key: !!response.data.has_t212_api_key,
        t212_secret: !!response.data.has_t212_api_secret,
      });
    });
    api
      .get("/api/user/")
      .then((res) => setUsername(res.data.username))
      .catch(() => {});
  }, []);

  // Switch the UI language immediately (i18next + localStorage) and persist the
  // preference to the account. Non-fatal if the save fails — the view still
  // updates locally.
  const handleLanguageChange = (code) => {
    setLanguageState(code);
    setLanguage(code);
    api.post("/api/settings/", { language: code }).catch(() => {});
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const payload = {
        dark_mode: darkMode,
        llm_provider: llmProvider,
        llm_model: llmModel,
        ollama_base_url: ollamaUrl,
        lmstudio_base_url: lmstudioUrl,
        t212_environment: t212Environment,
        // Telegram bot config is plaintext and round-trips like the URLs above,
        // so always send the current values.
        telegram_enabled: telegramEnabled,
        telegram_bot_token: telegramToken,
        telegram_allowed_user_id: telegramAllowedId,
      };
      // Only send a secret when the user actually typed one — a blank field
      // means "keep the stored key".
      if (apiKey) payload.open_ai_api_key = apiKey;
      if (anthropicKey) payload.anthropic_api_key = anthropicKey;
      if (t212Key) payload.t212_api_key = t212Key;
      if (t212Secret) payload.t212_api_secret = t212Secret;

      const { data } = await api.post("/api/settings/", payload);
      // Reflect newly-stored keys and clear the inputs so they show as saved.
      setHasKeys({
        open_ai: !!data.has_open_ai_api_key,
        anthropic: !!data.has_anthropic_api_key,
        t212_key: !!data.has_t212_api_key,
        t212_secret: !!data.has_t212_api_secret,
      });
      setApiKey("");
      setAnthropicKey("");
      setT212Key("");
      setT212Secret("");
      toast.success(t("settings.toast.saved"));
    } catch (error) {
      toast.error(t("settings.toast.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const savedPlaceholder = (fallback, isSet) =>
    isSet ? t("settings.savedPlaceholder") : fallback;

  const modelPlaceholder =
    llmProvider === "openai"
      ? t("settings.ai.modelPlaceholderOpenai")
      : llmProvider === "anthropic"
      ? t("settings.ai.modelPlaceholderAnthropic")
      : t("settings.ai.modelPlaceholderLocal");

  return (
    <div className="flex flex-col gap-6 max-w-2xl pb-10">
      <h2>{t("settings.title")}</h2>

      <Card
        title={t("settings.appearance.title")}
        description={t("settings.appearance.description")}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t("settings.darkMode")}
            </span>
            <ToggleButton />
          </div>
          <Select
            label={t("settings.language")}
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t("settings.baseCurrency")}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("settings.baseCurrencyDesc")}
              </p>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {baseCurrency}
            </span>
          </div>
          <Select
            label={t("settings.displayCurrency")}
            value={displayCurrency}
            onChange={(e) => changeDisplay(e.target.value)}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
                {c.code === baseCurrency ? ` ${t("settings.baseSuffix")}` : ""}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            {t("settings.displayNote", { currency: baseCurrency })}
          </p>
        </div>
      </Card>

      <Card
        title={t("settings.ai.title")}
        description={t("settings.ai.description")}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("settings.ai.provider")}
              value={llmProvider}
              onChange={(e) => {
                setLlmProvider(e.target.value);
                setLlmModel("");
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">{t("settings.ai.ollamaLocal")}</option>
              <option value="lmstudio">{t("settings.ai.lmstudioLocal")}</option>
            </Select>
            <Input
              label={t("settings.ai.model")}
              type="text"
              list="llm-model-options"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              placeholder={modelPlaceholder}
            />
            <datalist id="llm-model-options">
              {llmProvider === "openai" && (
                <>
                  <option value="gpt-5-mini" />
                  <option value="gpt-4o-mini" />
                  <option value="gpt-4o" />
                </>
              )}
              {llmProvider === "anthropic" && (
                <>
                  <option value="claude-sonnet-4-6" />
                  <option value="claude-opus-4-6" />
                  <option value="claude-haiku-4-5" />
                </>
              )}
            </datalist>
          </div>

          {llmProvider === "openai" && (
            <PasswordInput
              label={t("settings.ai.openaiKey")}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={savedPlaceholder(
                t("settings.ai.openaiKeyPlaceholder"),
                hasKeys.open_ai
              )}
            />
          )}
          {llmProvider === "anthropic" && (
            <PasswordInput
              label={t("settings.ai.anthropicKey")}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={savedPlaceholder(
                t("settings.ai.anthropicKeyPlaceholder"),
                hasKeys.anthropic
              )}
            />
          )}
          {llmProvider === "ollama" && (
            <Input
              label={t("settings.ai.ollamaUrl")}
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434/v1 (default)"
            />
          )}
          {llmProvider === "lmstudio" && (
            <Input
              label={t("settings.ai.lmstudioUrl")}
              type="text"
              value={lmstudioUrl}
              onChange={(e) => setLmstudioUrl(e.target.value)}
              placeholder="http://localhost:1234/v1 (default)"
            />
          )}
        </div>
      </Card>

      <Card
        title={t("settings.t212.title")}
        description={t("settings.t212.description")}
      >
        <div className="flex flex-col gap-4">
          <PasswordInput
            label={t("settings.t212.apiKey")}
            value={t212Key}
            onChange={(e) => setT212Key(e.target.value)}
            placeholder={savedPlaceholder(
              t("settings.t212.apiKeyPlaceholder"),
              hasKeys.t212_key
            )}
          />
          <PasswordInput
            label={t("settings.t212.apiSecret")}
            value={t212Secret}
            onChange={(e) => setT212Secret(e.target.value)}
            placeholder={savedPlaceholder(
              t("settings.t212.apiSecretPlaceholder"),
              hasKeys.t212_secret
            )}
          />
          <Select
            label={t("settings.t212.environment")}
            value={t212Environment}
            onChange={(e) => setT212Environment(e.target.value)}
          >
            <option value="live">{t("settings.t212.live")}</option>
            <option value="demo">{t("settings.t212.demo")}</option>
          </Select>
        </div>
      </Card>

      <Card
        title={t("settings.telegram.title")}
        description={t("settings.telegram.description")}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t("settings.telegram.enable")}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("settings.telegram.enableDesc")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={telegramEnabled}
              onClick={() => setTelegramEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                telegramEnabled
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  telegramEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <PasswordInput
            label={t("settings.telegram.botToken")}
            value={telegramToken}
            onChange={(e) => setTelegramToken(e.target.value)}
            placeholder="123456789:ABCdef... (from @BotFather)"
          />
          <Input
            label={t("settings.telegram.userId")}
            type="text"
            value={telegramAllowedId}
            onChange={(e) => setTelegramAllowedId(e.target.value)}
            placeholder={t("settings.telegram.userIdPlaceholder")}
          />

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>
              <span className="font-medium">{t("settings.telegram.setupLabel")}</span>{" "}
              {t("settings.telegram.setupPart1")}{" "}
              <span className="font-mono">@BotFather</span>{" "}
              {t("settings.telegram.setupPart2")}{" "}
              <span className="font-mono">@userinfobot</span>{" "}
              {t("settings.telegram.setupPart3")}
            </p>
            <p>{t("settings.telegram.oneUser")}</p>
            <p className="text-amber-600 dark:text-amber-500">
              {t("settings.telegram.privacyNote")}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title={t("settings.account.title")}
        description={t("settings.account.description")}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("settings.account.signedInAs")}
            </div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {username || "…"}
            </div>
          </div>
          <Link to="/myaccount">
            <Button variant="ghost" size="sm">
              {t("settings.account.manage")}
            </Button>
          </Link>
        </div>
      </Card>

      <Button
        onClick={handleSaveSettings}
        isLoading={isSaving}
        className="w-full"
      >
        {t("settings.saveButton")}
      </Button>
    </div>
  );
};

export default Settings;
