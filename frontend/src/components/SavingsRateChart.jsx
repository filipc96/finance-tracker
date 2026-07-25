import { Line } from "react-chartjs-2";
import { useTheme } from "../contexts/ThemeContext";
import { buildLineOptions, CHART_COLORS, withAlpha } from "../utils/chartTheme";
import ChartHeader from "./ui/ChartHeader";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

const SavingsRateChart = ({ summary }) => {
  const { darkMode } = useTheme();

  const rates = MONTH_LABELS.map((_, i) => {
    const income = Number(summary?.income?.[i] || 0);
    const expense = Number(summary?.expense?.[i] || 0);
    if (income <= 0) return null; // no income month — gap in the line
    return Math.round(((income - expense) / income) * 1000) / 10;
  });

  const data = {
    labels: MONTH_LABELS,
    datasets: [
      {
        label: "Savings rate",
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
    label: (ctx) => ` Savings rate: ${ctx.parsed.y}%`,
  };

  return (
    <>
      <ChartHeader
        title="Savings rate"
        subtitle="(income − expenses) ÷ income, per month"
      />
      <div className="relative h-80">
        <Line data={data} options={options} />
      </div>
    </>
  );
};

export default SavingsRateChart;
