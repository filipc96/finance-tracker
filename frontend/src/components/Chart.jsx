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
import { useTheme } from "../contexts/ThemeContext";
import { buildLineOptions } from "../utils/chartTheme";

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
  const { darkMode } = useTheme();

  useEffect(() => {
    const currentYear = new Date().getFullYear();

    api
      .get(`/api/transactions/monthly-sum/${type}/${currentYear}/`)
      .then((res) => setSums(res.data))
      .catch((error) => console.log(error));
  }, []);

  const options = buildLineOptions(darkMode);

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

  const backgroundColor =
    type === "expense" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)";

  const color =
    type === "expense"
      ? darkMode
        ? "rgb(239, 68, 68)"
        : "rgb(255, 99, 132)"
      : darkMode
      ? "rgb(34, 197, 94)"
      : "rgb(99, 255, 132)";

  const data = {
    labels,
    datasets: [
      {
        label: `${type === "expense" ? "Expenses" : "Incomes"}`,
        data: sums,
        borderColor: color,
        backgroundColor: backgroundColor,
        fill: true,
      },
    ],
  };

  return <Line options={options} data={data} />;
};

export default Chart;
