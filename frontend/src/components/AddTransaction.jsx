import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import DateInputBox from "./DateInputBox";
import { format } from "date-fns";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";

const AddTransaction = ({ type, callback, className = "max-w-md" }) => {
  const [categories, setCategories] = useState([]);
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((response) => setCategories(response.data))
      .catch(() => toast.error("Failed to load categories."));
  }, []);

  const categoryOptions = categories
    .filter((category) => category.type === type)
    .map((category) => (
      <option key={category.id} value={category.id}>
        {category.name}
      </option>
    ));

  const addTransaction = (e) => {
    e.preventDefault();

    if (date && name && amount && category) {
      const formattedDate = format(date, "yyyy-MM-dd");
      setIsSaving(true);
      api
        .post("/api/transactions/", {
          name: name,
          type: type,
          date: formattedDate,
          amount: amount,
          category: category,
        })
        .then(() => {
          toast.success(`${type === "expense" ? "Expense" : "Income"} added.`);
          setName("");
          setAmount("");
          if (callback) callback();
        })
        .catch(() => toast.error("Failed to add transaction."))
        .finally(() => setIsSaving(false));
    } else {
      toast.error("You can't leave the fields empty!");
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm w-full h-auto p-6 ${className}`}
    >
      <form onSubmit={addTransaction} className="flex flex-col gap-4">
        <h3>Add {type === "expense" ? "Expense" : "Income"}</h3>

        <Input
          label="Short Description"
          type="text"
          placeholder="Type short description"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select category</option>
            {categoryOptions}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Date
          </label>
          <DatePicker
            selected={date}
            onChange={(date) => setDate(date)}
            customInput={<DateInputBox />}
          />
        </div>

        <Button
          type="submit"
          variant="secondary"
          isLoading={isSaving}
          className="w-full mt-1"
        >
          Add {type === "expense" ? "Expense" : "Income"}
        </Button>
      </form>
    </div>
  );
};

export default AddTransaction;
