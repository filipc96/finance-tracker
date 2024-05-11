import AddCategory from "../components/AddCategory";
import { useEffect, useState } from "react";
import api from "../api";
import CategoryTable from "../components/CategoryTable";

const Categories = () => {
  const [categories, setCategories] = useState([]);

  const getCategories = () => {
    api
      .get("/api/categories/")
      .then((response) => setCategories(response.data))
      .catch((error) =>
        console.error("Error fetching the categories: ", error)
      );
  };

  useEffect(() => {
    getCategories();
  }, []);
  return (
    <>
      <h2>Categories</h2>

      <div className="flex flex-col space-y-8 py-6">
        <AddCategory callback={getCategories}></AddCategory>
        <CategoryTable categories={categories}></CategoryTable>
      </div>
    </>
  );
};

export default Categories;
