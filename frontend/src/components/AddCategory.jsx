import { useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";

const AddCategory = ({ callback }) => {
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const addCategory = (e) => {
    e.preventDefault();
    if (categoryName && categoryType) {
      setIsSaving(true);
      api
        .post("/api/categories/", { name: categoryName, type: categoryType })
        .then(() => {
          toast.success("Category created.");
          setCategoryName("");
          if (callback) callback();
        })
        .catch(() => toast.error("Failed to create category."))
        .finally(() => setIsSaving(false));
    } else {
      toast.error("You can't leave the category name or type empty!");
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm w-full max-w-md h-auto p-6">
      <form onSubmit={addCategory} className="flex flex-col gap-4">
        <h3>Add Category</h3>

        <Input
          label="Category Name"
          type="text"
          placeholder="Type category name"
          required
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />

        <Select
          label="Category Type"
          value={categoryType}
          onChange={(e) => setCategoryType(e.target.value)}
        >
          <option value="">Select category type</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </Select>

        <Button
          type="submit"
          variant="secondary"
          isLoading={isSaving}
          className="w-full mt-1"
        >
          Add Category
        </Button>
      </form>
    </div>
  );
};

export default AddCategory;
