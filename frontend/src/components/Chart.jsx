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
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
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

const Chart = ({ type }) => {
  const [sums, setSums] = useState({});

  useEffect(() => {
    const currentYear = new Date().getFullYear();

    api
      .get(`/api/transactions/monthly-sum/${type}/${currentYear}/`)
      .then((res) => setSums(res.data))
      .catch((error) => console.log(error));
  }, []);
  const options = {
    responsive: true,
    tension: 0.4,
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
      y: {
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

  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];

  const darkModeBgColor =
    type === "expense" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)";

  const color =
    type === "expense"
      ? document.documentElement.classList.contains("dark")
        ? "rgb(239, 68, 68)"
        : "rgb(255, 99, 132)"
      : document.documentElement.classList.contains("dark")
      ? "rgb(34, 197, 94)"
      : "rgb(99, 255, 132)";

  const data = {
    labels,
    datasets: [
      {
        label: `${type === "expense" ? "Expenses" : "Incomes"}`,
        data: sums,
        borderColor: color,
        backgroundColor: darkModeBgColor,
        fill: true,
      },
    ],
  };

  return (
    <>
      {type === "expense" ? "Expenses Graph" : "Incomes Graph"}
      <Line options={options} data={data} />
    </>
  );
};

export default Chart;
