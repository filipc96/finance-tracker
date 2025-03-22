import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Graph = () => {
  const [timespan, setTimespan] = useState(6);
  const [transactionTypes, setTransactionTypes] = useState(["expense"]);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const promises = transactionTypes.map((type) =>
          api.get(
            `/api/transactions/transactions-by-timespan/${type}/${timespan}/`
          )
        );

        const responses = await Promise.all(promises);
        const newData = {};
        responses.forEach((res, index) => {
          newData[transactionTypes[index]] = res.data;
        });
        setData(newData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timespan, transactionTypes]);

  const handleTimespanChange = (event) => {
    setTimespan(Number(event.target.value));
  };

  const handleTypeChange = (event) => {
    const selectedValue = event.target.value;
    setTransactionTypes(
      selectedValue === "all" ? ["expense", "income"] : [selectedValue]
    );
  };

  const getAllLabels = () => {
    const allDates = Object.values(data)
      .flat()
      .map((item) => item.month);
    return [...new Set(allDates)].sort();
  };

  const chartData = {
    labels: getAllLabels(),
    datasets: transactionTypes.map((type) => ({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      data: getAllLabels().map((label) => {
        const entry = data[type]?.find((item) => item.month === label);
        return entry ? entry.total : 0;
      }),
      borderColor: type === "expense" ? "rgb(239, 68, 68)" : "rgb(34, 197, 94)",
      backgroundColor:
        type === "expense"
          ? "rgba(239, 68, 68, 0.2)"
          : "rgba(34, 197, 94, 0.2)",
      tension: 0.4,
      fill: true,
    })),
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: document.documentElement.classList.contains("dark")
            ? "#e2e8f0"
            : "#000",
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: document.documentElement.classList.contains("dark")
            ? "#374151"
            : "#e5e7eb",
        },
        ticks: {
          color: document.documentElement.classList.contains("dark")
            ? "#e2e8f0"
            : "#000",
        },
      },
      x: {
        grid: {
          color: document.documentElement.classList.contains("dark")
            ? "#374151"
            : "#e5e7eb",
        },
        ticks: {
          color: document.documentElement.classList.contains("dark")
            ? "#e2e8f0"
            : "#000",
        },
      },
    },
  };

  return (
    <div className="flex flex-col rounded-md w-full">
      <div className="flex items-center gap-5 mb-6">
        <div className="relative">
          <select
            value={timespan}
            onChange={handleTimespanChange}
            className="appearance-none px-4 py-3 pr-10 rounded-lg border-2 border-gray-200 bg-gray-50 text-sm min-w-[180px] text-gray-700 cursor-pointer hover:border-blue-500 hover:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          >
            <option value="" disabled>
              Select Timespan
            </option>
            <option value={6}>Last 6 Months</option>
            <option value={12}>Last 12 Months</option>
            <option value={24}>Last 24 Months</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-600">
            ▼
          </span>
        </div>

        <div className="relative">
          <select
            value={transactionTypes}
            onChange={handleTypeChange}
            className="appearance-none px-4 py-3 pr-10 rounded-lg border-2 border-gray-200 bg-gray-50 text-sm min-w-[180px] text-gray-700 cursor-pointer hover:border-blue-500 hover:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          >
            <option value="all">All transactions</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-600">
            ▼
          </span>
        </div>
      </div>

      <div className="w-full min-h-[500px] relative">
        <Line
          data={chartData}
          options={{ ...options, maintainAspectRatio: false }}
        />
      </div>
    </div>
  );
};

export default Graph;
