import Chart from "../components/Chart";
import DashboardCard from "../components/DashboardCard";

const Dashboard = () => {
  return (
    <>
      <h2>Dashboard</h2>

      <div className="flex space-x-8 py-6">
        <DashboardCard
          username="FIlip Cvijetinovic"
          text="Your Expenses: 1000RSD"
          width="400px"
          height="150px"
        ></DashboardCard>

        <DashboardCard
          username="FIlip Cvijetinovic"
          text="Your Savings: 1000RSD"
          width="400px"
          height="150px"
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
          username="FIlip Cvijetinovic"
          text="Sent 1000RSD to mother "
          width="400px"
          height="200px"
        ></DashboardCard>

        <DashboardCard
          username="FIlip Cvijetinovic"
          text="Broadband bill: 1000RSD"
          width="400px"
          heigth="200px"
        ></DashboardCard>
      </div>
    </>
  );
};

export default Dashboard;
