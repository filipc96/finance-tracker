import { Chart as ChartJS, BarElement } from "chart.js";
import { Chart } from "react-chartjs-2";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { buildLineOptions } from "../utils/chartTheme";

ChartJS.register(BarElement);

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

const IncomeExpenseChart = ({ summary, year, onYearChange }) => {
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();

  const data = {
    labels: MONTH_LABELS,
    datasets: [
      {
        type: "bar",
        label: "Income",
        data: summary?.income || [],
        backgroundColor: "rgba(34, 197, 94, 0.8)",
      },
      {
        type: "bar",
        label: "Expense",
        data: summary?.expense || [],
        backgroundColor: "rgba(239, 68, 68, 0.8)",
      },
      {
        type: "line",
        label: "Net",
        data: summary?.net || [],
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        tension: 0.3,
      },
    ],
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span>Income vs Expenses</span>
        <select
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="px-3 py-1 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <Chart
        type="bar"
        data={data}
        options={buildLineOptions(darkMode, {
          currency: displayCurrency,
          rate: displayRate,
        })}
      />
    </>
  );
};

export default IncomeExpenseChart;
