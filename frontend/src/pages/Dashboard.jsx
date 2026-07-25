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
import BudgetAlerts from "../components/BudgetAlerts";
import ScanReceipt from "../components/ScanReceipt";
import Chart from "../components/Chart";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import Card from "../components/ui/Card";
import { formatWhole } from "../utils/formatCurrency";
import { useCurrency } from "../contexts/CurrencyContext";
import api from "../api";
import toast from "react-hot-toast";

const Dashboard = () => {
  const { displayCurrency, displayRate } = useCurrency();
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [netWorth, setNetWorth] = useState(null);
  const [latestExpense, setLatestExpense] = useState(null);
  const [latestIncome, setLatestIncome] = useState(null);
  const [allTimeSpent, setAllTimeSpent] = useState(0);
  // Bumped on every getData() run so the charts and budget widget (which fetch
  // their own data) refetch whenever a transaction is added/updated.
  const [refreshKey, setRefreshKey] = useState(0);

  const getData = async () => {
    setRefreshKey((k) => k + 1);
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
      // Follow the user's system locale instead of a hardcoded US format.
      return dateObject.toLocaleDateString();
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
          value={formatWhole(netWorth, displayCurrency, displayRate)}
        />
        <StatCard
          icon={faWallet}
          label="Balance"
          value={formatWhole(balance, displayCurrency, displayRate)}
        />
        <StatCard
          icon={faArrowTrendDown}
          label="Total Spent"
          value={formatWhole(allTimeSpent, displayCurrency, displayRate)}
          tone="negative"
        />
        <StatCard
          icon={faArrowUp}
          label="Latest Income"
          value={
            latestIncome
              ? formatWhole(latestIncome.amount, displayCurrency, displayRate)
              : "—"
          }
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
          value={
            latestExpense
              ? formatWhole(latestExpense.amount, displayCurrency, displayRate)
              : "—"
          }
          subtext={
            latestExpense
              ? `${latestExpense.name} · ${formatDate(latestExpense.date)}`
              : "No expenses yet"
          }
          tone="negative"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 pb-6 lg:grid-cols-5 lg:gap-x-4">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Card>
            <ChartErrorBoundary>
              <Chart
                type="expense"
                title="Expenses this year"
                refreshKey={refreshKey}
              />
            </ChartErrorBoundary>
          </Card>
          <Card>
            <ChartErrorBoundary>
              <Chart
                type="income"
                title="Income this year"
                refreshKey={refreshKey}
              />
            </ChartErrorBoundary>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <BudgetAlerts refreshKey={refreshKey} />
          <ScanReceipt callback={getData} className="" />
          <AddTransaction callback={getData} type="expense" className="" />
          <AddTransaction callback={getData} type="income" className="" />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
