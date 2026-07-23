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

// Rounded integer with grouping, no decimals, no currency: "219,370". Non-numeric -> "—".
export function formatWhole(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}
