// Shared chart.js theming so every chart reacts to the dark-mode toggle
// instead of reading document.documentElement on each render.

import { Chart as ChartJS, registerables } from "chart.js";
import { formatMoney } from "./formatCurrency";

// Register every chart.js controller/element/scale once, app-wide. This lives
// here (not in main.jsx) so chart.js stays out of the entry bundle: every chart
// component and chart page imports this module, so the registration — and
// chart.js itself — loads lazily with the first chart route. The generic
// <Chart type="bar"> needs this; without it Analytics blanks with "bar is not a
// registered controller" in a production build.
ChartJS.register(...registerables);

export const PIE_PALETTE = [
  "rgba(239, 68, 68, 0.8)", // red
  "rgba(34, 197, 94, 0.8)", // green
  "rgba(59, 130, 246, 0.8)", // blue
  "rgba(168, 85, 247, 0.8)", // purple
  "rgba(251, 146, 60, 0.8)", // orange
  "rgba(236, 72, 153, 0.8)", // pink
];

export const getChartTheme = (darkMode) => ({
  textColor: darkMode ? "#e2e8f0" : "#000",
  gridColor: darkMode ? "#374151" : "#e5e7eb",
  pieBorderColor: darkMode ? "#1a1c23" : "#ffffff",
});

// Compact money label for axis ticks: base 187247.73 at rate 1 -> "187,248".
// The chart data is in base currency, so `rate` converts to the display one.
const compactMoney = (value, rate = 1) =>
  (Number(value) * (Number(rate) || 1)).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

// Symbol-aware full-precision label for tooltips ("$1,234.56" / "1,234.56 RSD").
// `value` is in base; formatMoney applies the base->display `rate`.
const fullMoney = (value, currency, rate) => formatMoney(value, currency, rate);

// Pass `currency` + `rate` to label the y-axis ticks and tooltips in the display
// currency (chart data stays in base; rate converts it). `extra` is deep-ish
// merged so callers can override without dropping the theme colors / currency
// callbacks configured here.
export const buildLineOptions = (
  darkMode,
  { currency, rate = 1, ...extra } = {}
) => {
  const { textColor, gridColor } = getChartTheme(darkMode);
  return {
    responsive: true,
    tension: 0.4,
    ...extra,
    plugins: {
      legend: {
        position: "top",
        labels: { color: textColor },
      },
      ...(currency && {
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${fullMoney(ctx.parsed.y, currency, rate)}`,
          },
        },
      }),
      ...extra.plugins,
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          ...(currency && { callback: (v) => compactMoney(v, rate) }),
        },
      },
      ...extra.scales,
    },
  };
};
