import PieChart from "../components/PieChart";
import Chart from "../components/Chart";
import Graph from "../components/Graph"; // Import the Graph component

const Analytics = () => {
  return (
    <>
      <h1>Analytics</h1>
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
