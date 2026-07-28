import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../api";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { buildPieOptions, getChartTheme, PIE_PALETTE } from "../utils/chartTheme";

ChartJS.register(CategoryScale, LinearScale, ArcElement, Title, Tooltip, Legend);

const PieChart = ({ type }) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();
  const { pieBorderColor } = getChartTheme(darkMode);

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((res) => {
        setCategories(
          res.data.filter(
            (category) =>
              category.type == type && Number(category.transactions_sum) > 0
          )
        );
      })
      .catch((error) => console.log(error));
  }, [type]);

  if (categories.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {type === "expense"
            ? t("charts.noExpenseActivity")
            : t("charts.noIncomeActivity")}
        </p>
      </div>
    );
  }

  const data = {
    labels: categories.map((item) => item.name),
    datasets: [
      {
        label: t("charts.sumsByCategory"),
        data: categories.map((item) => item.transactions_sum),
        backgroundColor: PIE_PALETTE,
        borderColor: pieBorderColor,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options = buildPieOptions(darkMode, {
    currency: displayCurrency,
    rate: displayRate,
  });

  return (
    <div className="relative h-72">
      <Pie data={data} options={options} />
    </div>
  );
};

export default PieChart;
