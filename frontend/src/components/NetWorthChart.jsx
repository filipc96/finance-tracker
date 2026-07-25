import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../api";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  buildLineOptions,
  CHART_COLORS,
  withAlpha,
} from "../utils/chartTheme";
import ChartHeader from "./ui/ChartHeader";
import ChartSelect from "./ui/ChartSelect";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const NetWorthChart = () => {
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();
  const [series, setSeries] = useState([]);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    api
      .get(`/api/analytics/net-worth/?months=${months}`)
      .then((res) => setSeries(res.data))
      .catch((error) => console.log(error));
  }, [months]);

  const data = {
    labels: series.map((s) => s.date),
    datasets: [
      {
        label: "Net worth",
        data: series.map((s) => s.net_worth),
        borderColor: CHART_COLORS.netWorth,
        backgroundColor: withAlpha(CHART_COLORS.netWorth, 0.12),
        fill: true,
        borderWidth: 3,
      },
      {
        label: "Balance",
        data: series.map((s) => s.account_balance),
        borderColor: CHART_COLORS.balance,
      },
      {
        label: "Savings",
        data: series.map((s) => s.savings_total),
        borderColor: CHART_COLORS.savings,
      },
      {
        label: "Stocks",
        data: series.map((s) => s.portfolio_value),
        borderColor: CHART_COLORS.stocks,
      },
    ],
  };

  return (
    <>
      <ChartHeader title="Net worth over time">
        <ChartSelect
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </ChartSelect>
      </ChartHeader>
      {series.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No snapshots yet — net worth data accrues from your first app load
          each day.
        </p>
      ) : (
        <div className="relative h-80">
          <Line
            data={data}
            options={buildLineOptions(darkMode, {
              currency: displayCurrency,
              rate: displayRate,
            })}
          />
        </div>
      )}
    </>
  );
};

export default NetWorthChart;
