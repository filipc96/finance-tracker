import { useEffect, useState } from "react";
import {
  faArrowUp,
  faArrowDown,
  faPiggyBank,
} from "@fortawesome/free-solid-svg-icons";
import PieChart from "../components/PieChart";
import Chart from "../components/Chart";
import Graph from "../components/Graph";
import NetWorthChange from "../components/NetWorthChange";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import CategoryTrendsChart from "../components/CategoryTrendsChart";
import SavingsRateChart from "../components/SavingsRateChart";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import StatCard from "../components/StatCard";
import ChartHeader from "../components/ui/ChartHeader";
import ChartSelect from "../components/ui/ChartSelect";
import Card from "../components/ui/Card";
import { formatWhole } from "../utils/formatCurrency";
import { useCurrency } from "../contexts/CurrencyContext";
import { useTranslation } from "react-i18next";
import api from "../api";

// Selectable rolling windows for the single Analytics filter. `value` matches the
// backend PeriodSummary.PERIOD_DAYS keys; `labelKey`/`subtextKey` point at the
// translated label + "last …" phrasing shown under each card.
const PERIOD_OPTIONS = [
  { value: "day", labelKey: "analytics.periodDay", subtextKey: "analytics.subtextDay" },
  { value: "week", labelKey: "analytics.periodWeek", subtextKey: "analytics.subtextWeek" },
  { value: "month", labelKey: "analytics.periodMonth", subtextKey: "analytics.subtextMonth" },
  { value: "3m", labelKey: "analytics.period3m", subtextKey: "analytics.subtext3m" },
  { value: "6m", labelKey: "analytics.period6m", subtextKey: "analytics.subtext6m" },
  { value: "year", labelKey: "analytics.periodYear", subtextKey: "analytics.subtextYear" },
  { value: "5y", labelKey: "analytics.period5y", subtextKey: "analytics.subtext5y" },
];

const Analytics = () => {
  const { t } = useTranslation();
  const { displayCurrency, displayRate } = useCurrency();
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState("6m");
  const [periodData, setPeriodData] = useState(null);

  // The single period filter: one call feeds the income/expenses/savings-rate
  // cards and the net-worth-change block, so changing it updates them together.
  useEffect(() => {
    api
      .get(`/api/analytics/period-summary/?period=${period}`)
      .then((res) => setPeriodData(res.data))
      .catch((error) => console.log(error));
  }, [period]);

  // Kept separate from the period filter: the month-by-month trend charts below
  // (IncomeExpenseChart, SavingsRateChart) still read a full calendar year.
  useEffect(() => {
    api
      .get(`/api/analytics/monthly-summary/${year}/`)
      .then((res) => setSummary(res.data))
      .catch((error) => console.log(error));
  }, [year]);

  const periodSubtextKey = PERIOD_OPTIONS.find((o) => o.value === period)
    ?.subtextKey;
  const periodSubtext = periodSubtextKey ? t(periodSubtextKey) : "";
  const savingsRate = periodData?.savings_rate;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1>{t("analytics.title")}</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {t("analytics.subtitle")}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("analytics.overview")}
        </h2>
        <ChartSelect
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </ChartSelect>
      </div>

      <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-3">
        <StatCard
          icon={faArrowUp}
          label={t("analytics.income")}
          value={formatWhole(periodData?.income, displayCurrency, displayRate)}
          subtext={periodSubtext}
          tone="positive"
        />
        <StatCard
          icon={faArrowDown}
          label={t("analytics.expenses")}
          value={formatWhole(periodData?.expense, displayCurrency, displayRate)}
          subtext={periodSubtext}
          tone="negative"
        />
        <StatCard
          icon={faPiggyBank}
          label={t("analytics.savingsRate")}
          value={
            savingsRate === null || savingsRate === undefined
              ? "—"
              : `${savingsRate}%`
          }
          subtext={periodSubtext}
        />
      </div>

      <div className="flex flex-col gap-6 pb-6 w-full">
        <Card>
          <ChartErrorBoundary>
            <NetWorthChange
              change={periodData?.net_worth_change}
              periodLabel={periodSubtext}
            />
          </ChartErrorBoundary>
        </Card>

        <Card>
          <ChartErrorBoundary>
            <IncomeExpenseChart
              summary={summary}
              year={year}
              onYearChange={setYear}
            />
          </ChartErrorBoundary>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <ChartErrorBoundary>
              <SavingsRateChart summary={summary} />
            </ChartErrorBoundary>
          </Card>
          <Card>
            <ChartErrorBoundary>
              <CategoryTrendsChart />
            </ChartErrorBoundary>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <ChartErrorBoundary>
              <Chart type="expense" title={t("dashboard.expensesThisYear")} />
            </ChartErrorBoundary>
          </Card>
          <Card>
            <ChartErrorBoundary>
              <Chart type="income" title={t("dashboard.incomeThisYear")} />
            </ChartErrorBoundary>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <ChartHeader title={t("analytics.expensesByCategory")} />
            <ChartErrorBoundary>
              <PieChart type="expense" />
            </ChartErrorBoundary>
          </Card>
          <Card>
            <ChartHeader title={t("analytics.incomeByCategory")} />
            <ChartErrorBoundary>
              <PieChart type="income" />
            </ChartErrorBoundary>
          </Card>
        </div>

        <Card>
          <ChartErrorBoundary>
            <Graph />
          </ChartErrorBoundary>
        </Card>
      </div>
    </>
  );
};

export default Analytics;
