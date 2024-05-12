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

  const deleteCategory = (id) => {
    api
      .delete(`/api/categories/delete/${id}`)
      .then((res) => {
        if (res.status === 204) console.log("Note deleted!");
        else console.log("Failed to delete note.");
        getCategories();
      })
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    getCategories();
  }, []);
  return (
    <>
      <h2>Categories</h2>

      <div className="flex flex-col space-y-20 py-6 items-center justify-items-center">
        <AddCategory callback={getCategories}></AddCategory>
        <div className="w-full">
          <CategoryTable
            categories={categories}
            onDelete={deleteCategory}
          ></CategoryTable>
        </div>
      </div>
    </>
  );
};

export default Categories;
