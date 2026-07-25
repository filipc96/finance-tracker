import { useEffect, useState } from "react";
import {
  faArrowUp,
  faArrowDown,
  faScaleBalanced,
  faPiggyBank,
} from "@fortawesome/free-solid-svg-icons";
import PieChart from "../components/PieChart";
import Chart from "../components/Chart";
import Graph from "../components/Graph";
import NetWorthChart from "../components/NetWorthChart";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import CategoryTrendsChart from "../components/CategoryTrendsChart";
import SavingsRateChart from "../components/SavingsRateChart";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import StatCard from "../components/StatCard";
import ChartHeader from "../components/ui/ChartHeader";
import Card from "../components/ui/Card";
import { formatWhole } from "../utils/formatCurrency";
import { useCurrency } from "../contexts/CurrencyContext";
import api from "../api";

const sumList = (list) =>
  (list || []).reduce((acc, n) => acc + (Number(n) || 0), 0);

const Analytics = () => {
  const { displayCurrency, displayRate } = useCurrency();
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);

  // Fetched once here, shared by the stat row, IncomeExpenseChart and
  // SavingsRateChart so the year selector drives the whole top section.
  useEffect(() => {
    api
      .get(`/api/analytics/monthly-summary/${year}/`)
      .then((res) => setSummary(res.data))
      .catch((error) => console.log(error));
  }, [year]);

  const totalIncome = sumList(summary?.income);
  const totalExpense = sumList(summary?.expense);
  const totalNet = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.round((totalNet / totalIncome) * 1000) / 10 : null;
  const inYear = `in ${year}`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1>Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Track your income, spending, and net worth over time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={faArrowUp}
          label="Income"
          value={formatWhole(totalIncome, displayCurrency, displayRate)}
          subtext={inYear}
          tone="positive"
        />
        <StatCard
          icon={faArrowDown}
          label="Expenses"
          value={formatWhole(totalExpense, displayCurrency, displayRate)}
          subtext={inYear}
          tone="negative"
        />
        <StatCard
          icon={faScaleBalanced}
          label="Net"
          value={formatWhole(totalNet, displayCurrency, displayRate)}
          subtext={inYear}
          tone={totalNet >= 0 ? "positive" : "negative"}
        />
        <StatCard
          icon={faPiggyBank}
          label="Savings rate"
          value={savingsRate === null ? "—" : `${savingsRate}%`}
          subtext={inYear}
        />
      </div>

      <div className="flex flex-col gap-6 pb-6 w-full max-w-5xl">
        <Card>
          <ChartErrorBoundary>
            <NetWorthChart />
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
              <Chart type="expense" title="Expenses this year" />
            </ChartErrorBoundary>
          </Card>
          <Card>
            <ChartErrorBoundary>
              <Chart type="income" title="Income this year" />
            </ChartErrorBoundary>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <ChartHeader title="Expenses by category" />
            <ChartErrorBoundary>
              <PieChart type="expense" />
            </ChartErrorBoundary>
          </Card>
          <Card>
            <ChartHeader title="Income by category" />
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
