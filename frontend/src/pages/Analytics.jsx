import Chart from "../components/Chart";

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
    </>
  );
};

export default Analytics;
