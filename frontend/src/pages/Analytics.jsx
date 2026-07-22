import { useEffect, useState } from "react";
import PieChart from "../components/PieChart";
import Chart from "../components/Chart";
import Graph from "../components/Graph";
import NetWorthChart from "../components/NetWorthChart";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import CategoryTrendsChart from "../components/CategoryTrendsChart";
import SavingsRateChart from "../components/SavingsRateChart";
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
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <NetWorthChart />
        </div>
      </div>
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <IncomeExpenseChart
            summary={summary}
            year={year}
            onYearChange={setYear}
          />
        </div>
      </div>
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <SavingsRateChart summary={summary} />
        </div>
      </div>
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <CategoryTrendsChart />
        </div>
      </div>
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <Chart type="expense" />
        </div>
      </div>
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <Chart type="income" />
        </div>
      </div>
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <PieChart type="expense" />
        </div>
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <PieChart type="income" />
        </div>
      </div>
      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          <Graph />
        </div>
      </div>
    </>
  );
};

export default Analytics;
