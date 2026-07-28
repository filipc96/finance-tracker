import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../api";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { buildLineOptions, CHART_COLORS, withAlpha } from "../utils/chartTheme";
import ChartHeader from "./ui/ChartHeader";
import { useTranslation } from "react-i18next";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Chart = ({ type, refreshKey, title }) => {
  const { t } = useTranslation();
  const [sums, setSums] = useState({});
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();
  const LABELS = t("common.monthsShort", { returnObjects: true });

  useEffect(() => {
    const currentYear = new Date().getFullYear();

    api
      .get(`/api/transactions/monthly-sum/${type}/${currentYear}/`)
      .then((res) => setSums(res.data))
      .catch((error) => console.log(error));
  }, [type, refreshKey]);

  const color = type === "expense" ? CHART_COLORS.expense : CHART_COLORS.income;

  const data = {
    labels: LABELS,
    datasets: [
      {
        label: type === "expense" ? t("chart.expenses") : t("chart.income"),
        data: sums,
        borderColor: color,
        backgroundColor: withAlpha(color, 0.15),
        fill: true,
      },
    ],
  };

  const options = buildLineOptions(darkMode, {
    currency: displayCurrency,
    rate: displayRate,
    plugins: { legend: { display: false } },
  });

  return (
    <>
      {title && <ChartHeader title={title} />}
      <div className="relative h-64">
        <Line options={options} data={data} />
      </div>
    </>
  );
};

export default Chart;
