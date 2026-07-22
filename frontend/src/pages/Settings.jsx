import ToggleButton from "../components/ToggleButton";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import api from "../api";
import toast from "react-hot-toast";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import PasswordInput from "../components/ui/PasswordInput";
import Button from "../components/ui/Button";

const Settings = () => {
  const { darkMode } = useTheme();
  const [apiKey, setApiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [lmstudioUrl, setLmstudioUrl] = useState("");
  const [t212Key, setT212Key] = useState("");
  const [t212Secret, setT212Secret] = useState("");
  const [t212Environment, setT212Environment] = useState("live");
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.get("/api/settings/").then((response) => {
      setApiKey(response.data.open_ai_api_key || "");
      setAnthropicKey(response.data.anthropic_api_key || "");
      setLlmProvider(response.data.llm_provider || "openai");
      setLlmModel(response.data.llm_model || "");
      setOllamaUrl(response.data.ollama_base_url || "");
      setLmstudioUrl(response.data.lmstudio_base_url || "");
      setT212Key(response.data.t212_api_key || "");
      setT212Secret(response.data.t212_api_secret || "");
      setT212Environment(response.data.t212_environment || "live");
    });
    api
      .get("/api/user/")
      .then((res) => setUsername(res.data.username))
      .catch(() => {});
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.post("/api/settings/", {
        dark_mode: darkMode,
        open_ai_api_key: apiKey,
        anthropic_api_key: anthropicKey,
        llm_provider: llmProvider,
        llm_model: llmModel,
        ollama_base_url: ollamaUrl,
        lmstudio_base_url: lmstudioUrl,
        t212_api_key: t212Key,
        t212_api_secret: t212Secret,
        t212_environment: t212Environment,
      });
      toast.success("Settings saved.");
    } catch (error) {
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const modelPlaceholder =
    llmProvider === "openai"
      ? "gpt-5-mini (default)"
      : llmProvider === "anthropic"
      ? "claude-sonnet-4-6 (default)"
      : "e.g. llama3, qwen2.5 — required for local providers";

  return (
    <div className="flex flex-col gap-6 max-w-2xl pb-10">
      <h2>Settings</h2>

      <Card
        title="Appearance"
        description="How the app looks on this device."
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Dark Mode
          </span>
          <ToggleButton />
        </div>
      </Card>

      <Card
        title="AI & Chat"
        description="Provider and model used by the financial assistant. Local providers (Ollama, LM Studio) need no API key."
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Provider"
              value={llmProvider}
              onChange={(e) => {
                setLlmProvider(e.target.value);
                setLlmModel("");
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama (local)</option>
              <option value="lmstudio">LM Studio (local)</option>
            </Select>
            <Input
              label="Model"
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
              label="OpenAI API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenAI API key"
            />
          )}
          {llmProvider === "anthropic" && (
            <PasswordInput
              label="Anthropic API Key"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="Enter your Anthropic API key"
            />
          )}
          {llmProvider === "ollama" && (
            <Input
              label="Ollama Base URL"
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434/v1 (default)"
            />
          )}
          {llmProvider === "lmstudio" && (
            <Input
              label="LM Studio Base URL"
              type="text"
              value={lmstudioUrl}
              onChange={(e) => setLmstudioUrl(e.target.value)}
              placeholder="http://localhost:1234/v1 (default)"
            />
          )}
        </div>
      </Card>

      <Card
        title="Trading 212"
        description="API credentials for portfolio sync. Generate them in the Trading 212 app under Settings → API."
      >
        <div className="flex flex-col gap-4">
          <PasswordInput
            label="API Key"
            value={t212Key}
            onChange={(e) => setT212Key(e.target.value)}
            placeholder="Enter your Trading 212 API key"
          />
          <PasswordInput
            label="API Secret"
            value={t212Secret}
            onChange={(e) => setT212Secret(e.target.value)}
            placeholder="Enter your Trading 212 API secret"
          />
          <Select
            label="Environment"
            value={t212Environment}
            onChange={(e) => setT212Environment(e.target.value)}
          >
            <option value="live">Live</option>
            <option value="demo">Demo (paper trading)</option>
          </Select>
        </div>
      </Card>

      <Card title="Account" description="Profile and security.">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Signed in as
            </div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {username || "…"}
            </div>
          </div>
          <Link to="/myaccount">
            <Button variant="ghost" size="sm">
              Manage account
            </Button>
          </Link>
        </div>
      </Card>

      <Button
        onClick={handleSaveSettings}
        isLoading={isSaving}
        className="w-full"
      >
        Save Settings
      </Button>
    </div>
  );
};

export default Settings;
