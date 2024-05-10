import { useState } from "react";
import api from "../api";

const AddCategory = () => {
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState("");

  const addCategory = (e) => {
    e.preventDefault();
    if (categoryName && categoryType) {
      api
        .post("/api/categories/", { name: categoryName, type: categoryType })
        .then((res) => {
          if (res.status === 201) console.log("Category created!");
          else console.log("Failed to create category!");
        })
        .catch((error) => console.log(error));
    } else {
      console.log("You can't leave the category name or category type empty!");
    }
  };

  return (
    <div
      className={`flex flex-col rounded-md border w-96 h-auto p-8 justify-center`}
    >
      <form onSubmit={addCategory}>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          <h2>Add Category</h2>
          <div className="sm:col-span-2">
            <label
              htmlFor="name"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Category Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
              placeholder="Type category name"
              required
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="category"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Category Type
            </label>
            <select
              id="category"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
              onChange={(e) => setCategoryType(e.target.value)}
            >
              <option defaultValue="">Select category type</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          value="Submit"
          className="w-full mt-5 bg-black text-white p-2 rounded-lg hover:bg-white hover:text-black hover:border hover:border-gray-300"
        >
          Add Category{" "}
        </button>
      </form>
    </div>
  );
};

export default AddCategory;
