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
import { buildLineOptions } from "../utils/chartTheme";
import { DEFAULT_CURRENCY } from "../utils/formatCurrency";

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
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        fill: true,
        tension: 0.3,
        borderWidth: 3,
      },
      {
        label: "Balance",
        data: series.map((s) => s.account_balance),
        borderColor: "rgb(34, 197, 94)",
        tension: 0.3,
      },
      {
        label: "Savings",
        data: series.map((s) => s.savings_total),
        borderColor: "rgb(168, 85, 247)",
        tension: 0.3,
      },
      {
        label: "Stocks",
        data: series.map((s) => s.portfolio_value),
        borderColor: "rgb(251, 146, 60)",
        tension: 0.3,
      },
    ],
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span>Net Worth Over Time</span>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="px-3 py-1 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 text-sm"
        >
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
      </div>
      {series.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No snapshots yet — net worth data accrues from your first app load
          each day.
        </p>
      ) : (
        <Line
          data={data}
          options={buildLineOptions(darkMode, { currency: DEFAULT_CURRENCY })}
        />
      )}
    </>
  );
};

export default NetWorthChart;
