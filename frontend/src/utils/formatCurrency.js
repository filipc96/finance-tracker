export const DEFAULT_CURRENCY = "RSD";

// Bare, normalized amount: "1234.56". Non-numeric / null -> "—".
export function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

// Amount with a currency label: "1234.56 RSD".
export function formatCurrency(value, currency = DEFAULT_CURRENCY) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${formatAmount(n)} ${currency}`;
}

// Rounded integer with grouping, no decimals: "219,370" or "219,370 RSD"
// when a currency is passed. Non-numeric -> "—".
export function formatWhole(value, currency = "") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const s = Math.round(n).toLocaleString();
  return currency ? `${s} ${currency}` : s;
}
