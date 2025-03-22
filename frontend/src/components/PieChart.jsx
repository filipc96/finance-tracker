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
        backgroundColor: [
          "rgba(239, 68, 68, 0.8)", // red
          "rgba(34, 197, 94, 0.8)", // green
          "rgba(59, 130, 246, 0.8)", // blue
          "rgba(168, 85, 247, 0.8)", // purple
          "rgba(251, 146, 60, 0.8)", // orange
          "rgba(236, 72, 153, 0.8)", // pink
        ],
        borderColor: document.documentElement.classList.contains("dark")
          ? "#1a1c23"
          : "#ffffff",
        borderWidth: 2,
      },
    ],
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
  };

  return (
    <>
      {type === "expense" ? "Expenses Pie Chart" : "Incomes Pie Chart"}
      <Pie data={data} options={options} />
    </>
  );
};

export default PieChart;
