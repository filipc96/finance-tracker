import ToggleButton from "../components/ToggleButton";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "../contexts/ThemeContext";
import api from "../api";
import toast from "react-hot-toast";

const Settings = () => {
  const { darkMode } = useTheme();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showT212Key, setShowT212Key] = useState(false);
  const [showT212Secret, setShowT212Secret] = useState(false);
  const [t212Key, setT212Key] = useState("");
  const [t212Secret, setT212Secret] = useState("");
  const [t212Environment, setT212Environment] = useState("live");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.get("/api/settings/").then((response) => {
      setApiKey(response.data.open_ai_api_key || "");
      setT212Key(response.data.t212_api_key || "");
      setT212Secret(response.data.t212_api_secret || "");
      setT212Environment(response.data.t212_environment || "live");
    });
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.post("/api/settings/", {
        dark_mode: darkMode,
        open_ai_api_key: apiKey,
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

  return (
    <div className="flex flex-col space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">Settings</h2>

      <div className="flex flex-col space-y-4 p-6 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 max-w-md">
        <div className="flex justify-between items-center">
          <span className="text-gray-700 dark:text-gray-200">Dark Mode</span>
          <ToggleButton />
        </div>
      </div>

      <div className="flex flex-col space-y-4 p-6 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 max-w-md">
        <div className="flex flex-col space-y-2">
          <span className="text-gray-700 dark:text-gray-200">
            OpenAI API Key
          </span>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenAI API key"
              className="w-full p-4 pr-10 rounded-lg border dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <FontAwesomeIcon icon={showApiKey ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-4 p-6 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 max-w-md">
        <span className="text-gray-700 dark:text-gray-200 font-semibold">
          Trading 212
        </span>
        <div className="flex flex-col space-y-2">
          <span className="text-gray-700 dark:text-gray-200">API Key</span>
          <div className="relative">
            <input
              type={showT212Key ? "text" : "password"}
              value={t212Key}
              onChange={(e) => setT212Key(e.target.value)}
              placeholder="Enter your Trading 212 API key"
              className="w-full p-4 pr-10 rounded-lg border dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowT212Key(!showT212Key)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <FontAwesomeIcon icon={showT212Key ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>
        <div className="flex flex-col space-y-2">
          <span className="text-gray-700 dark:text-gray-200">API Secret</span>
          <div className="relative">
            <input
              type={showT212Secret ? "text" : "password"}
              value={t212Secret}
              onChange={(e) => setT212Secret(e.target.value)}
              placeholder="Enter your Trading 212 API secret"
              className="w-full p-4 pr-10 rounded-lg border dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowT212Secret(!showT212Secret)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <FontAwesomeIcon icon={showT212Secret ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>
        <div className="flex flex-col space-y-2">
          <span className="text-gray-700 dark:text-gray-200">Environment</span>
          <select
            value={t212Environment}
            onChange={(e) => setT212Environment(e.target.value)}
            className="w-full p-4 rounded-lg border dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="live">Live</option>
            <option value="demo">Demo (paper trading)</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSaveSettings}
        disabled={isSaving}
        className="w-full max-w-md p-4 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {isSaving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
};

export default Settings;
