import { useEffect, useState } from "react";
import Chart from "../components/Chart";
import DashboardCard from "../components/DashboardCard";
import AddTransaction from "../components/AddTransaction";
import api from "../api";
import { format } from "date-fns";

const Dashboard = () => {
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [latestExpense, setLatestExpense] = useState({});
  const [latestIncome, setLatestIncome] = useState({});

  const getData = async () => {
    try {
      const userData = await api.get("/api/user/");
      setUsername(userData.data.username);
      setBalance(userData.data.balance);

      const latestExpenseData = await api.get(
        "/api/transactions/expenses/latest"
      );
      setLatestExpense(latestExpenseData.data);

      const latestIncomeData = await api.get(
        "/api/transactions/incomes/latest"
      );
      setLatestIncome(latestIncomeData.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const formatDate = (dateString) => {
    const dateObject = new Date(dateString);
    if (!isNaN(dateObject.getTime())) {
      console.log(dateObject);
      return format(dateObject, "MM/dd/yyyy");
    } else {
      console.error("Invalid date value:", dateString);
      return "Invalid Date"; // or any fallback value
    }
  };

  useEffect(() => {
    getData();
  }, []);

  return (
    <>
      <h2>Dashboard</h2>

      <div className="flex space-x-8 py-6">
        <DashboardCard
          username={username}
          text="Your Expenses: 1000RSD"
        ></DashboardCard>

        <DashboardCard
          username={username}
          text={`Balance: ${balance} RSD`}
        ></DashboardCard>
      </div>

      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          Expenses Graph
          <Chart />
        </div>
      </div>
      <div className="flex space-x-8 py-6">
        <AddTransaction callback={getData} type="expense"></AddTransaction>
        <AddTransaction callback={getData} type="income"></AddTransaction>
      </div>
      <div className="flex space-x-8 py-6">
        <DashboardCard
          username={username}
          text={
            latestExpense
              ? `${latestExpense.name} \nAmount: ${
                  latestExpense.amount
                }\nDate: ${formatDate(latestExpense?.date)}`
              : "No transactions yet"
          }
        ></DashboardCard>

        <DashboardCard
          username={username}
          text={
            latestIncome
              ? `${latestIncome.name} \nAmount: ${
                  latestIncome.amount
                }\nDate: ${formatDate(latestIncome?.date)}`
              : "No transactions yet"
          }
        ></DashboardCard>
      </div>
    </>
  );
};

export default Dashboard;
