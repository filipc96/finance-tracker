import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../api";
import { useTheme } from "../contexts/ThemeContext";
import { buildLineOptions, PIE_PALETTE } from "../utils/chartTheme";

const CategoryTrendsChart = () => {
  const { darkMode } = useTheme();
  const [type, setType] = useState("expense");
  const [months, setMonths] = useState(6);
  const [trends, setTrends] = useState({ months: [], categories: [] });

  useEffect(() => {
    api
      .get(`/api/analytics/category-trends/${type}/${months}/`)
      .then((res) => setTrends(res.data))
      .catch((error) => console.log(error));
  }, [type, months]);

  const data = {
    labels: trends.months,
    datasets: trends.categories.map((category, index) => ({
      label: category.name,
      data: category.data,
      borderColor: PIE_PALETTE[index % PIE_PALETTE.length].replace("0.8", "1"),
      backgroundColor: PIE_PALETTE[index % PIE_PALETTE.length],
      tension: 0.3,
    })),
  };

  const selectClass =
    "px-3 py-1 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 text-sm";

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span>Category Trends</span>
        <div className="flex gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={selectClass}
          >
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className={selectClass}
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>
      </div>
      {trends.categories.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No transactions in this window.
        </p>
      ) : (
        <Line data={data} options={buildLineOptions(darkMode)} />
      )}
    </>
  );
};

export default CategoryTrendsChart;
