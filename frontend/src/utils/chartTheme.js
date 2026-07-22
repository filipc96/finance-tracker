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

export const buildLineOptions = (darkMode, extra = {}) => {
  const { textColor, gridColor } = getChartTheme(darkMode);
  return {
    responsive: true,
    tension: 0.4,
    plugins: {
      legend: {
        position: "top",
        labels: { color: textColor },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
    },
    ...extra,
  };
};
