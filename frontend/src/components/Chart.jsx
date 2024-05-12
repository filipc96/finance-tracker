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

const Chart = () => {
  const [sums, setSums] = useState({});
  useEffect(() => {
    api
      .get("/api/transactions/monthly-sum/2024/")
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

  const data = {
    labels,
    datasets: [
      {
        label: "Expenses",
        data: Array.from({ length: 12 }, (_, i) => sums[i + 1]),
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  };
  console.log(data);

  return <Line options={options} data={data} />;
};

export default Chart;
