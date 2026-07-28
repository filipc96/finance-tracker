import { Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { buildLineOptions, CHART_COLORS, withAlpha } from "../utils/chartTheme";
import ChartHeader from "./ui/ChartHeader";

const SavingsRateChart = ({ summary }) => {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const monthLabels = t("common.monthsShort", { returnObjects: true });

  const rates = monthLabels.map((_, i) => {
    const income = Number(summary?.income?.[i] || 0);
    const expense = Number(summary?.expense?.[i] || 0);
    if (income <= 0) return null; // no income month — gap in the line
    return Math.round(((income - expense) / income) * 1000) / 10;
  });

  const data = {
    labels: monthLabels,
    datasets: [
      {
        label: t("charts.savingsRate"),
        data: rates,
        borderColor: CHART_COLORS.savings,
        backgroundColor: withAlpha(CHART_COLORS.savings, 0.15),
        fill: true,
        tension: 0.35,
        spanGaps: true,
      },
    ],
  };

  // Single series: drop the legend (the title names it) and label the axis and
  // tooltip as a percentage. Mutate after building so the themed grid/tick
  // colors are kept (buildLineOptions replaces a scale wholesale if passed one).
  const options = buildLineOptions(darkMode, {
    plugins: { legend: { display: false } },
  });
  options.scales.y.ticks.callback = (v) => `${v}%`;
  options.plugins.tooltip.callbacks = {
    label: (ctx) => t("charts.savingsRateTooltip", { value: ctx.parsed.y }),
  };

  return (
    <>
      <ChartHeader
        title={t("charts.savingsRate")}
        subtitle={t("charts.savingsRateSubtitle")}
      />
      <div className="relative h-80">
        <Line data={data} options={options} />
      </div>
    </>
  );
};

export default SavingsRateChart;
