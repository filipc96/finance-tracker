import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { buildLineOptions, CHART_COLORS, withAlpha } from "../utils/chartTheme";
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

const Graph = () => {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();
  const [timespan, setTimespan] = useState(6);
  const [transactionTypes, setTransactionTypes] = useState(["expense"]);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const promises = transactionTypes.map((type) =>
          api.get(
            `/api/transactions/transactions-by-timespan/${type}/${timespan}/`
          )
        );

        const responses = await Promise.all(promises);
        const newData = {};
        responses.forEach((res, index) => {
          newData[transactionTypes[index]] = res.data;
        });
        setData(newData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timespan, transactionTypes]);

  const handleTimespanChange = (event) => {
    setTimespan(Number(event.target.value));
  };

  const handleTypeChange = (event) => {
    const selectedValue = event.target.value;
    setTransactionTypes(
      selectedValue === "all" ? ["expense", "income"] : [selectedValue]
    );
  };

  const getAllLabels = () => {
    const allDates = Object.values(data)
      .flat()
      .map((item) => item.month);
    return [...new Set(allDates)].sort();
  };

  const chartData = {
    labels: getAllLabels(),
    datasets: transactionTypes.map((type) => ({
      label: type === "expense" ? t("history.expense") : t("chart.income"),
      data: getAllLabels().map((label) => {
        const entry = data[type]?.find((item) => item.month === label);
        return entry ? entry.total : 0;
      }),
      borderColor:
        type === "expense" ? CHART_COLORS.expense : CHART_COLORS.income,
      backgroundColor: withAlpha(
        type === "expense" ? CHART_COLORS.expense : CHART_COLORS.income,
        0.15
      ),
      tension: 0.35,
      fill: true,
    })),
  };

  const options = buildLineOptions(darkMode, {
    currency: displayCurrency,
    rate: displayRate,
  });
  options.scales.y.beginAtZero = true;

  return (
    <>
      <ChartHeader title={t("charts.transactionsOverTime")}>
        <ChartSelect
          value={transactionTypes.length > 1 ? "all" : transactionTypes[0]}
          onChange={handleTypeChange}
        >
          <option value="all">{t("charts.allTransactions")}</option>
          <option value="expense">{t("chart.expenses")}</option>
          <option value="income">{t("chart.income")}</option>
        </ChartSelect>
        <ChartSelect value={timespan} onChange={handleTimespanChange}>
          <option value={6}>{t("charts.last6Months")}</option>
          <option value={12}>{t("charts.last12Months")}</option>
          <option value={24}>{t("charts.last24Months")}</option>
        </ChartSelect>
      </ChartHeader>

      {loading && Object.keys(data).length === 0 ? (
        <div className="flex h-96 items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("common.loading")}
          </p>
        </div>
      ) : (
        <div className="relative h-96">
          <Line data={chartData} options={options} />
        </div>
      )}
    </>
  );
};

export default Graph;
