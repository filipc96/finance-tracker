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

        {/* <AddCategory></AddCategory> */}
      </div>
      <div className="flex space-x-8 py-6">
        <DashboardCard
          username={username}
          text={`${latestExpense.name} \nAmount: ${
            latestExpense.amount
          }\nDate: ${format(latestExpense.date, "MM/dd/yyyy")}`}
        ></DashboardCard>

        <DashboardCard
          username={username}
          text="Broadband bill: 1000RSD"
        ></DashboardCard>
      </div>
    </>
  );
};

export default Dashboard;
