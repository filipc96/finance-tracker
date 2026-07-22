import React from "react";
import { useState, useEffect } from "react";
import api from "../api";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useTheme } from "../contexts/ThemeContext";
import { getChartTheme, PIE_PALETTE } from "../utils/chartTheme";

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const PieChart = ({ type }) => {
  const [categories, setCategories] = useState([]);
  const { darkMode } = useTheme();
  const { textColor, pieBorderColor } = getChartTheme(darkMode);

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((res) => {
        setCategories(res.data.filter((category) => category.type == type));
      })
      .catch((error) => console.log(error));
  }, []);

  const labels = categories.map((item) => item.name);
  const values = categories.map((item) => item.transactions_sum);

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Sums by Category",
        data: values,
        backgroundColor: PIE_PALETTE,
        borderColor: pieBorderColor,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
        labels: { color: textColor },
      },
    },
  };

  return (
    <>
      {type === "expense" ? "Expenses Pie Chart" : "Incomes Pie Chart"}
      <Pie data={data} options={options} />
    </>
  );
};

export default PieChart;
