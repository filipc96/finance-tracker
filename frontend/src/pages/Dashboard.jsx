import { useEffect, useState } from "react";
import {
  faWallet,
  faArrowTrendDown,
  faArrowDown,
  faArrowUp,
  faScaleBalanced,
} from "@fortawesome/free-solid-svg-icons";
import StatCard from "../components/StatCard";
import AddTransaction from "../components/AddTransaction";
import Chart from "../components/Chart";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import Card from "../components/ui/Card";
import { formatCurrency, formatWhole } from "../utils/formatCurrency";
import api from "../api";
import toast from "react-hot-toast";
import { format } from "date-fns";

const Dashboard = () => {
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [netWorth, setNetWorth] = useState(null);
  const [latestExpense, setLatestExpense] = useState(null);
  const [latestIncome, setLatestIncome] = useState(null);
  const [allTimeSpent, setAllTimeSpent] = useState(0);

  const getData = async () => {
    try {
      const userData = await api.get("/api/user/");
      setUsername(userData.data.username);
      setBalance(userData.data.balance);

      const latestExpenseData = await api.get(
        "/api/transactions/expenses/latest"
      );
      setLatestExpense(latestExpenseData.data || null);

      const latestIncomeData = await api.get(
        "/api/transactions/incomes/latest"
      );
      setLatestIncome(latestIncomeData.data || null);

      const allTimeExpenseData = await api.get(
        "/api/transactions/all-time-sum/expense/"
      );
      setAllTimeSpent(allTimeExpenseData.data || 0);

      const netWorthData = await api.get("/api/analytics/net-worth/");
      const rows = netWorthData.data || [];
      setNetWorth(rows.length ? rows[rows.length - 1].net_worth : null);
    } catch (error) {
      toast.error("Failed to load dashboard data.");
    }
  };

  const formatDate = (dateString) => {
    const dateObject = new Date(dateString);
    if (!isNaN(dateObject.getTime())) {
      return format(dateObject, "MM/dd/yyyy");
    }
    return "";
  };

  useEffect(() => {
    getData();
  }, []);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1>Dashboard</h1>
        {username && (
          <p className="text-gray-500 dark:text-gray-400">
            Welcome back, {username}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={faScaleBalanced}
          label="Net Worth"
          value={formatWhole(netWorth)}
          subtext="Balance + savings + stocks"
        />
        <StatCard
          icon={faWallet}
          label="Balance"
          value={formatCurrency(balance)}
        />
        <StatCard
          icon={faArrowTrendDown}
          label="Total Spent"
          value={formatCurrency(allTimeSpent)}
          tone="negative"
        />
        <StatCard
          icon={faArrowUp}
          label="Latest Income"
          value={latestIncome ? formatCurrency(latestIncome.amount) : "—"}
          subtext={
            latestIncome
              ? `${latestIncome.name} · ${formatDate(latestIncome.date)}`
              : "No income yet"
          }
          tone="positive"
        />
        <StatCard
          icon={faArrowDown}
          label="Latest Expense"
          value={latestExpense ? formatCurrency(latestExpense.amount) : "—"}
          subtext={
            latestExpense
              ? `${latestExpense.name} · ${formatDate(latestExpense.date)}`
              : "No expenses yet"
          }
          tone="negative"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 pb-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Card>
            <div className="mb-4">Expenses this year</div>
            <ChartErrorBoundary>
              <Chart type="expense" />
            </ChartErrorBoundary>
          </Card>
          <Card>
            <div className="mb-4">Income this year</div>
            <ChartErrorBoundary>
              <Chart type="income" />
            </ChartErrorBoundary>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <AddTransaction callback={getData} type="expense" />
          <AddTransaction callback={getData} type="income" />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
