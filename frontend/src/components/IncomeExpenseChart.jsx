import { Chart as ChartJS, BarElement } from "chart.js";
import { Chart } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
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

const IncomeExpenseChart = ({ summary, year, onYearChange }) => {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();

  const data = {
    labels: t("common.monthsShort", { returnObjects: true }),
    datasets: [
      {
        type: "bar",
        label: t("chart.income"),
        data: summary?.income || [],
        backgroundColor: withAlpha(CHART_COLORS.income, 0.85),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        type: "bar",
        label: t("history.expense"),
        data: summary?.expense || [],
        backgroundColor: withAlpha(CHART_COLORS.expense, 0.85),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        type: "line",
        label: t("charts.net"),
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
      <ChartHeader title={t("charts.incomeVsExpenses")}>
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
