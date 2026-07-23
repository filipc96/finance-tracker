import { useEffect, useState } from "react";
import PieChart from "../components/PieChart";
import Chart from "../components/Chart";
import Graph from "../components/Graph";
import NetWorthChart from "../components/NetWorthChart";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import CategoryTrendsChart from "../components/CategoryTrendsChart";
import SavingsRateChart from "../components/SavingsRateChart";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import Card from "../components/ui/Card";
import api from "../api";

const Analytics = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);

  // Fetched once here, shared by IncomeExpenseChart and SavingsRateChart
  useEffect(() => {
    api
      .get(`/api/analytics/monthly-summary/${year}/`)
      .then((res) => setSummary(res.data))
      .catch((error) => console.log(error));
  }, [year]);

  return (
    <>
      <h1>Analytics</h1>

      <div className="flex flex-col gap-6 py-6 w-full max-w-5xl">
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Expenses this year">
            <ChartErrorBoundary>
              <Chart type="expense" />
            </ChartErrorBoundary>
          </Card>
          <Card title="Income this year">
            <ChartErrorBoundary>
              <Chart type="income" />
            </ChartErrorBoundary>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Expenses by category">
            <ChartErrorBoundary>
              <PieChart type="expense" />
            </ChartErrorBoundary>
          </Card>
          <Card title="Income by category">
            <ChartErrorBoundary>
              <PieChart type="income" />
            </ChartErrorBoundary>
          </Card>
        </div>

        <Card title="Transactions over time">
          <ChartErrorBoundary>
            <Graph />
          </ChartErrorBoundary>
        </Card>
      </div>
    </>
  );
};

export default Analytics;
