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
          "rgba(255, 99, 132, 0.6)",
          "rgba(54, 162, 235, 0.6)",
          "rgba(255, 206, 86, 0.6)",
          "rgba(75, 192, 192, 0.6)",
          "rgba(153, 102, 255, 0.6)",
          "rgba(255, 159, 64, 0.6)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(153, 102, 255, 1)",
          "rgba(255, 159, 64, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
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
