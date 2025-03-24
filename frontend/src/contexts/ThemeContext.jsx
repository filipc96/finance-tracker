import { createContext, useContext, useState, useEffect } from "react";
import api from "../api";
const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (!localStorage.getItem("darkMode")) {
      api.get("/api/settings/").then((response) => {
        setDarkMode(response.data.dark_mode);
      });
    }

    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const value = { darkMode, toggleDarkMode };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error(
      "useTheme must be used within a ThemeProvider. Please wrap your app with <ThemeProvider>"
    );
  }
  return context;
};
