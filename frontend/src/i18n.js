// i18next singleton for the whole SPA.
//
// All locale resources are STATICALLY imported so they land in the JS bundle —
// the desktop app serves the SPA as static files from the Django sidecar, so
// there is no place to fetch locale JSON from at runtime. English is the
// authoritative source; any key missing from another locale falls back to it.
//
// The active language is read from localStorage on load (so it applies instantly,
// including on the Login/Register screens that render outside the app providers),
// then synced from the user's saved Settings once authenticated (see
// contexts/CurrencyContext.jsx).
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import srLatn from "./locales/sr-Latn.json";
import srCyrl from "./locales/sr-Cyrl.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import ru from "./locales/ru.json";

// The languages we ship, with their native display labels for the Settings
// picker. Order = order shown in the dropdown.
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "sr-Latn", label: "Srpski (latinica)" },
  { code: "sr-Cyrl", label: "Српски (ћирилица)" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
];

const SUPPORTED = LANGUAGES.map((l) => l.code);

// Persisted UI language, falling back to English for a first run or bad value.
export function storedLanguage() {
  const saved = localStorage.getItem("language");
  return saved && SUPPORTED.includes(saved) ? saved : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "sr-Latn": { translation: srLatn },
    "sr-Cyrl": { translation: srCyrl },
    de: { translation: de },
    es: { translation: es },
    ru: { translation: ru },
  },
  lng: storedLanguage(),
  fallbackLng: "en",
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false }, // React already escapes.
  returnNull: false,
});

// Change language everywhere and persist the choice locally. Backend persistence
// is done by the caller (Settings) via POST /api/settings/.
export function setLanguage(code) {
  const next = SUPPORTED.includes(code) ? code : "en";
  localStorage.setItem("language", next);
  return i18n.changeLanguage(next);
}

export default i18n;
