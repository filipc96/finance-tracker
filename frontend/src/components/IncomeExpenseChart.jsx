import { Chart as ChartJS, BarElement } from "chart.js";
import { Chart } from "react-chartjs-2";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  buildLineOptions,
  CHART_COLORS,
  withAlpha,
} from "../utils/chartTheme";
import ChartHeader from "./ui/ChartHeader";
import ChartSelect from "./ui/ChartSelect";

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
        backgroundColor: withAlpha(CHART_COLORS.income, 0.85),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        type: "bar",
        label: "Expense",
        data: summary?.expense || [],
        backgroundColor: withAlpha(CHART_COLORS.expense, 0.85),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        type: "line",
        label: "Net",
        data: summary?.net || [],
        borderColor: CHART_COLORS.net,
        backgroundColor: withAlpha(CHART_COLORS.net, 0.12),
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.35,
      },
    ],
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <>
      <ChartHeader title="Income vs expenses">
        <ChartSelect
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </ChartSelect>
      </ChartHeader>
      <div className="relative h-80">
        <Chart
          type="bar"
          data={data}
          options={buildLineOptions(darkMode, {
            currency: displayCurrency,
            rate: displayRate,
          })}
        />
      </div>
    </>
  );
};

export default IncomeExpenseChart;
