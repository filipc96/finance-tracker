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

  const color = `${
    type === "expense" ? "rgb(255, 99, 132)" : "rgb(99, 255, 132)"
  }`;

  const data = {
    labels,
    datasets: [
      {
        label: `${type === "expense" ? "Expenses" : "Incomes"}`,
        data: sums,
        borderColor: color,
        backgroundColor: color,
      },
    ],
  };
  console.log(data);

  return (
    <>
      {type === "expense" ? "Expenses Graph" : "Incomes Graph"}
      <Line options={options} data={data} />
    </>
  );
};

export default Chart;
