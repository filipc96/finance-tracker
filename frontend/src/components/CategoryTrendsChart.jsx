import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import api from "../api";
import { useTheme } from "../contexts/ThemeContext";
import {
  buildLineOptions,
  PIE_PALETTE,
  PIE_PALETTE_SOLID,
} from "../utils/chartTheme";
import ChartHeader from "./ui/ChartHeader";
import ChartSelect from "./ui/ChartSelect";

const CategoryTrendsChart = () => {
  const { t } = useTranslation();
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
      borderColor: PIE_PALETTE_SOLID[index % PIE_PALETTE_SOLID.length],
      backgroundColor: PIE_PALETTE[index % PIE_PALETTE.length],
      tension: 0.35,
    })),
  };

  return (
    <>
      <ChartHeader title={t("charts.categoryTrends")}>
        <ChartSelect value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">{t("chart.expenses")}</option>
          <option value="income">{t("chart.income")}</option>
        </ChartSelect>
        <ChartSelect
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          <option value={6}>{t("charts.last6Months")}</option>
          <option value={12}>{t("charts.last12Months")}</option>
          <option value={24}>{t("charts.last24Months")}</option>
        </ChartSelect>
      </ChartHeader>
      {trends.categories.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("charts.noTransactionsWindow")}
        </p>
      ) : (
        <div className="relative h-80">
          <Line data={data} options={buildLineOptions(darkMode)} />
        </div>
      )}
    </>
  );
};

export default CategoryTrendsChart;
