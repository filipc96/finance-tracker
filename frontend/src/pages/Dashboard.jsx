import { useEffect, useState } from "react";
import Chart from "../components/Chart";
import DashboardCard from "../components/DashboardCard";
import api from "../api";

const Dashboard = () => {
  const [username, setUsername] = useState("");

  useEffect(() => {
    api
      .get("/api/user/")
      .then((response) => setUsername(response.data.username))
      .catch((error) => console.error("Error fetching the username", error));
  }, []);
  // width and heigth from tailwind documentation
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
          text="Your Savings: 1000RSD"
        ></DashboardCard>
      </div>

      <div className="flex space-x-8 py-6 w-4/5">
        <div className="flex flex-col rounded-md border w-full p-8 justify-center">
          Expenses Graph
          <Chart />
        </div>
      </div>
      <div className="flex space-x-8 py-6">
        <DashboardCard
          username={username}
          text="Sent 1000RSD to mother "
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
