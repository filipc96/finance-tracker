import { useEffect, useState } from "react";
import {
  faWallet,
  faArrowTrendDown,
  faArrowDown,
  faArrowUp,
} from "@fortawesome/free-solid-svg-icons";
import Chart from "../components/Chart";
import StatCard from "../components/StatCard";
import AddTransaction from "../components/AddTransaction";
import Card from "../components/ui/Card";
import api from "../api";
import toast from "react-hot-toast";
import { format } from "date-fns";

const Dashboard = () => {
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
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

      <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={faWallet} label="Balance" value={`${balance} RSD`} />
        <StatCard
          icon={faArrowTrendDown}
          label="Total Spent"
          value={`${allTimeSpent} RSD`}
          tone="negative"
        />
        <StatCard
          icon={faArrowUp}
          label="Latest Income"
          value={latestIncome ? `${latestIncome.amount} RSD` : "—"}
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
          value={latestExpense ? `${latestExpense.amount} RSD` : "—"}
          subtext={
            latestExpense
              ? `${latestExpense.name} · ${formatDate(latestExpense.date)}`
              : "No expenses yet"
          }
          tone="negative"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 pb-6 lg:grid-cols-5">
        <Card title="Expenses this year" className="lg:col-span-3">
          <Chart type="expense" />
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <AddTransaction callback={getData} type="expense" />
          <AddTransaction callback={getData} type="income" />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
