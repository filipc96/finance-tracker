// Shared chart.js theming so every chart reacts to the dark-mode toggle
// instead of reading document.documentElement on each render.

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

// Compact money label for axis ticks: 187247.73 -> "187,248". Full precision
// with the currency label is used in tooltips instead.
const compactMoney = (value) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });

const fullMoney = (value, currency) =>
  `${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

// Pass `currency` to label the y-axis ticks and tooltips (e.g. net worth in
// RSD). `extra` is deep-ish merged so callers can override without dropping
// the theme colors / currency callbacks configured here.
export const buildLineOptions = (darkMode, { currency, ...extra } = {}) => {
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
              `${ctx.dataset.label}: ${fullMoney(ctx.parsed.y, currency)}`,
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
          ...(currency && { callback: (v) => compactMoney(v) }),
        },
      },
      ...extra.scales,
    },
  };
};
