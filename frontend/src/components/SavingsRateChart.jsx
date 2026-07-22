import { Line } from "react-chartjs-2";
import { useTheme } from "../contexts/ThemeContext";
import { buildLineOptions } from "../utils/chartTheme";

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
        label: "Savings rate %",
        data: rates,
        borderColor: "rgb(168, 85, 247)",
        backgroundColor: "rgba(168, 85, 247, 0.2)",
        fill: true,
        tension: 0.3,
        spanGaps: true,
      },
    ],
  };

  return (
    <>
      <span className="block mb-4">Savings Rate (income − expenses) / income</span>
      <Line data={data} options={buildLineOptions(darkMode)} />
    </>
  );
};

export default SavingsRateChart;
