// Currency-aware money formatting.
//
// Every stored amount is in the account's locked BASE currency. The user can
// pick a separate DISPLAY currency to read those amounts in; converting is
// purely presentational — `displayed = baseAmount * rate(base->display)`,
// labelled in the display currency. Nothing stored is ever rewritten.
//
// Most money is rendered from React components (via useCurrency()), but some is
// rendered from plain DataTable column-render config objects that can't call
// hooks. So the active display currency and its rate are also kept in module
// variables backing the format helpers' defaults — CurrencyContext keeps them
// in sync. Display currency changes rarely and every page re-renders on
// navigation, so the module defaults keep config-site tables correct.

let activeBase = "USD";
let activeDisplayCurrency = "USD";
let activeDisplayRate = 1; // base -> display multiplier

export const setActiveBase = (base) => {
  if (base) activeBase = base;
};

// Set the display currency and its base->display rate together. A missing or
// non-positive rate falls back to 1 (i.e. show base amounts un-converted).
export const setActiveDisplay = (currency, rate) => {
  if (currency) activeDisplayCurrency = currency;
  const n = Number(rate);
  activeDisplayRate = Number.isFinite(n) && n > 0 ? n : 1;
};

export const getActiveBase = () => activeBase;
export const getActiveDisplayCurrency = () => activeDisplayCurrency;
export const getActiveDisplayRate = () => activeDisplayRate;

// Symbol shown as a prefix for currencies that have a well-known one. Anything
// not listed falls back to an ISO-code suffix ("1,234.56 RSD"), which is the
// right, unambiguous choice for symbol-less currencies like the dinar.
export const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  CHF: "CHF ",
  AUD: "A$",
  CAD: "C$",
  NZD: "NZ$",
  INR: "₹",
  BRL: "R$",
  ZAR: "R",
  KRW: "₩",
  RUB: "₽",
  TRY: "₺",
  PLN: "zł ",
  SEK: "kr ",
  NOK: "kr ",
  DKK: "kr ",
};

// Curated list of currencies offered in the Settings picker. `RSD` is included
// because it's the current owner's currency (the app was RSD-only before).
export const CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "CNY", label: "Chinese Yuan" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "NZD", label: "New Zealand Dollar" },
  { code: "INR", label: "Indian Rupee" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "ZAR", label: "South African Rand" },
  { code: "KRW", label: "South Korean Won" },
  { code: "RUB", label: "Russian Ruble" },
  { code: "TRY", label: "Turkish Lira" },
  { code: "PLN", label: "Polish Złoty" },
  { code: "SEK", label: "Swedish Krona" },
  { code: "NOK", label: "Norwegian Krone" },
  { code: "DKK", label: "Danish Krone" },
  { code: "RSD", label: "Serbian Dinar" },
];

// Wrap a grouped number string with the currency's symbol (prefix) or, if it
// has no symbol, its ISO code (suffix).
const label = (numberStr, currency) => {
  const symbol = CURRENCY_SYMBOLS[currency];
  return symbol ? `${symbol}${numberStr}` : `${numberStr} ${currency}`;
};

// Bare, normalized amount with no currency: "1234.56". For deliberately
// currency-less or native-currency displays (e.g. Trading 212 amounts, which
// are in the account's own currency, not the base). Non-numeric / null -> "—".
export function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

// Convert a base amount into the (display) currency and label it: "$1,234.56"
// or "1,234.56 RSD". `value` is always in base; `rate` is the base->display
// multiplier. Non-numeric -> "—".
export function formatMoney(
  value,
  currency = activeDisplayCurrency,
  rate = activeDisplayRate
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const converted = n * (Number(rate) || 1);
  const s = converted.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return label(s, currency);
}

// Like formatMoney but rounded to whole units: "$219,370" or "219,370 RSD".
export function formatWhole(
  value,
  currency = activeDisplayCurrency,
  rate = activeDisplayRate
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const converted = n * (Number(rate) || 1);
  const s = Math.round(converted).toLocaleString();
  return label(s, currency);
}
