import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const ToggleButton = () => {
  const { t } = useTranslation();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-200"
      aria-label={t("common.toggleDarkMode")}
    >
      <FontAwesomeIcon
        icon={darkMode ? faSun : faMoon}
        className="text-gray-600 dark:text-yellow-300"
        size="lg"
      />
    </button>
  );
};

export default ToggleButton;
