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

// Semantic colors used app-wide. income = green, expense = red is a convention
// the whole app leans on, so these live in one place instead of scattered rgb()
// literals across every chart component.
export const CHART_COLORS = {
  income: "rgb(34, 197, 94)",
  expense: "rgb(239, 68, 68)",
  net: "rgb(59, 130, 246)",
  netWorth: "rgb(59, 130, 246)",
  balance: "rgb(34, 197, 94)",
  savings: "rgb(168, 85, 247)",
  stocks: "rgb(251, 146, 60)",
};

// Translucent version of a solid "rgb(r, g, b)" color for area fills.
export const withAlpha = (rgb, alpha = 0.15) =>
  rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);

// Categorical palette for pie slices / multi-category lines. Ordered so that
// adjacent slots stay distinguishable under color-vision deficiency (validated
// with the dataviz palette checker): red, blue, orange, green, purple, pink.
export const PIE_PALETTE = [
  "rgba(239, 68, 68, 0.85)", // red
  "rgba(59, 130, 246, 0.85)", // blue
  "rgba(251, 146, 60, 0.85)", // orange
  "rgba(34, 197, 94, 0.85)", // green
  "rgba(168, 85, 247, 0.85)", // purple
  "rgba(236, 72, 153, 0.85)", // pink
];

// Opaque twins of PIE_PALETTE for line borders / legends.
export const PIE_PALETTE_SOLID = PIE_PALETTE.map((c) =>
  c.replace(/,\s*[\d.]+\)$/, ", 1)")
);

export const getChartTheme = (darkMode) => ({
  textColor: darkMode ? "#e2e8f0" : "#334155",
  mutedColor: darkMode ? "#94a3b8" : "#64748b",
  gridColor: darkMode ? "rgba(148, 163, 184, 0.14)" : "rgba(100, 116, 139, 0.12)",
  pieBorderColor: darkMode ? "#24262d" : "#ffffff",
  tooltipBg: darkMode ? "rgba(36, 38, 45, 0.96)" : "rgba(17, 24, 39, 0.92)",
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

// Shared legend + tooltip styling so every chart's chrome matches. `currency`
// switches the tooltip value formatter to money.
const sharedPlugins = (theme, { currency, rate = 1 } = {}) => ({
  legend: {
    position: "top",
    align: "end",
    labels: {
      color: theme.textColor,
      usePointStyle: true,
      pointStyle: "circle",
      boxWidth: 8,
      boxHeight: 8,
      padding: 16,
    },
  },
  tooltip: {
    backgroundColor: theme.tooltipBg,
    titleColor: "#f8fafc",
    bodyColor: "#e2e8f0",
    padding: 12,
    cornerRadius: 8,
    boxPadding: 6,
    usePointStyle: true,
    ...(currency && {
      callbacks: {
        label: (ctx) =>
          `${ctx.dataset.label}: ${fullMoney(ctx.parsed.y, currency, rate)}`,
      },
    }),
  },
});

// Pass `currency` + `rate` to label the y-axis ticks and tooltips in the display
// currency (chart data stays in base; rate converts it). `extra` is deep-ish
// merged so callers can override without dropping the theme colors / currency
// callbacks configured here.
export const buildLineOptions = (
  darkMode,
  { currency, rate = 1, ...extra } = {}
) => {
  const theme = getChartTheme(darkMode);
  const base = sharedPlugins(theme, { currency, rate });
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    elements: {
      point: { radius: 0, hoverRadius: 5, hitRadius: 12 },
      line: { borderWidth: 2, tension: 0.35 },
    },
    ...extra,
    plugins: {
      ...base,
      ...extra.plugins,
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: theme.gridColor },
        ticks: { color: theme.mutedColor, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        grid: { color: theme.gridColor, drawTicks: false },
        border: { display: false },
        ticks: {
          color: theme.mutedColor,
          padding: 8,
          ...(currency && { callback: (v) => compactMoney(v, rate) }),
        },
      },
      ...extra.scales,
    },
  };
};

// Options for pie/doughnut charts: themed legend on the right, tooltip showing
// the money value and its share of the total.
export const buildPieOptions = (darkMode, { currency, rate = 1 } = {}) => {
  const theme = getChartTheme(darkMode);
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: theme.textColor,
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
        padding: 12,
        cornerRadius: 8,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed;
            const total = ctx.dataset.data.reduce(
              (sum, n) => sum + (Number(n) || 0),
              0
            );
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            const money = currency
              ? fullMoney(value, currency, rate)
              : value.toLocaleString();
            return ` ${ctx.label}: ${money} (${pct}%)`;
          },
        },
      },
    },
  };
};
