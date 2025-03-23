import ToggleButton from "../components/ToggleButton";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const Settings = () => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement save logic
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
