import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";
import { setLanguage } from "../i18n";
import {
  setActiveBase,
  setActiveDisplay,
  getActiveBase,
  getActiveDisplayCurrency,
  getActiveDisplayRate,
} from "../utils/formatCurrency";

const CurrencyContext = createContext(null);

// Currency state for the whole app:
//   * baseCurrency    — the account's locked accounting currency (read-only).
//   * displayCurrency — what amounts are shown in (switchable, presentational).
//   * displayRate     — base->display multiplier used to convert every amount.
//
// It mirrors display currency + rate into module vars (formatCurrency.js) so
// money rendered from non-component code (DataTable column-render configs) stays
// converted correctly too. On mount it reads Settings (base + display) and, when
// display differs from base, fetches the current rate from /api/fx/rate/.
export const CurrencyProvider = ({ children }) => {
  const [baseCurrency, setBaseCurrency] = useState(getActiveBase);
  const [displayCurrency, setDisplayCurrency] = useState(
    getActiveDisplayCurrency
  );
  const [displayRate, setDisplayRate] = useState(getActiveDisplayRate);

  // Fetch the base->target rate (1 when target == base) and push it into both
  // React state and the module vars so every render site converts consistently.
  const applyDisplay = useCallback(async (base, target) => {
    if (!target || target === base) {
      setActiveDisplay(base, 1);
      setDisplayCurrency(base);
      setDisplayRate(1);
      return;
    }
    try {
      const { data } = await api.get("/api/fx/rate/", {
        params: { to: target },
      });
      const rate = data.available ? Number(data.rate) : 1;
      const shown = data.available ? target : base;
      setActiveDisplay(shown, rate);
      setDisplayCurrency(shown);
      setDisplayRate(rate);
    } catch {
      // FX unreachable — fall back to showing base amounts un-converted.
      setActiveDisplay(base, 1);
      setDisplayCurrency(base);
      setDisplayRate(1);
    }
  }, []);

  useEffect(() => {
    api.get("/api/settings/").then((response) => {
      const base = response.data.base_currency || getActiveBase();
      const display = response.data.display_currency || base;
      setActiveBase(base);
      setBaseCurrency(base);
      applyDisplay(base, display);
      // Sync the saved UI language from the account into the running app +
      // localStorage. Mirrors the dark-mode fallback pattern; a blank value
      // leaves the current (localStorage/default) language untouched.
      if (response.data.language) {
        setLanguage(response.data.language);
      }
    });
  }, [applyDisplay]);

  // Switch the display currency: persist the preference, then refresh the rate.
  // Passing a value equal to base (or blank) clears the preference server-side.
  const changeDisplay = useCallback(
    async (next) => {
      const target = next && next !== baseCurrency ? next : "";
      try {
        await api.post("/api/settings/", { display_currency: target });
      } catch {
        // Non-fatal: still update the view even if the preference didn't save.
      }
      await applyDisplay(baseCurrency, target || baseCurrency);
    },
    [applyDisplay, baseCurrency]
  );

  return (
    <CurrencyContext.Provider
      value={{ baseCurrency, displayCurrency, displayRate, changeDisplay }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === null) {
    throw new Error(
      "useCurrency must be used within a CurrencyProvider. Please wrap your app with <CurrencyProvider>"
    );
  }
  return context;
};
