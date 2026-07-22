import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import Button from "./ui/Button";

const emptyForm = {
  name: "",
  amount: "",
  category: "",
  type: "expense",
  frequency: "monthly",
  next_due: new Date().toISOString().slice(0, 10),
};

const RecurringManager = ({ onMaterialized }) => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const getItems = () => {
    api
      .get("/api/recurring/")
      .then((res) => setItems(res.data))
      .catch(() => toast.error("Failed to load recurring transactions."));
  };

  useEffect(() => {
    getItems();
    api
      .get("/api/categories/")
      .then((res) => setCategories(res.data))
      .catch(() => toast.error("Failed to load categories."));
  }, []);

  const setField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const addItem = (e) => {
    e.preventDefault();
    if (!form.name || !form.amount || !form.category) {
      toast.error("Fill in name, amount and category.");
      return;
    }
    api
      .post("/api/recurring/", form)
      .then(() => {
        toast.success("Recurring transaction added.");
        setForm(emptyForm);
        getItems();
        if (onMaterialized) onMaterialized();
      })
      .catch((error) => {
        const data = error.response?.data;
        toast.error(
          data?.non_field_errors?.[0] ||
            data?.category?.[0] ||
            data?.amount?.[0] ||
            "Failed to add recurring transaction."
        );
      });
  };

  const deleteItem = (id) => {
    api
      .delete(`/api/recurring/delete/${id}`)
      .then(() => {
        toast.success("Recurring transaction removed.");
        getItems();
      })
      .catch(() => toast.error("Failed to remove recurring transaction."));
  };

  const matchingCategories = categories.filter((c) => c.type === form.type);
  const inputClass =
    "px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
      <h3 className="font-semibold">Recurring transactions</h3>

      <form onSubmit={addItem} className="flex flex-wrap items-end gap-3">
        <input
          type="text"
          placeholder="Name"
          value={form.name}
          onChange={setField("name")}
          className={`${inputClass} w-40`}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={setField("amount")}
          className={`${inputClass} w-28`}
        />
        <select
          value={form.type}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, type: e.target.value, category: "" }))
          }
          className={inputClass}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select
          value={form.category}
          onChange={setField("category")}
          className={inputClass}
        >
          <option value="">Category</option>
          {matchingCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={form.frequency}
          onChange={setField("frequency")}
          className={inputClass}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            First due
          </label>
          <input
            type="date"
            value={form.next_due}
            onChange={setField("next_due")}
            className={inputClass}
          />
        </div>
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No recurring transactions yet.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="flex-1 font-medium">{item.name}</span>
              <span className="w-24">{item.amount}</span>
              <span className="w-24 capitalize">{item.type}</span>
              <span className="w-28">{item.category_name}</span>
              <span className="w-24 capitalize">{item.frequency}</span>
              <span className="w-28">next: {item.next_due}</span>
              <button
                onClick={() => deleteItem(item.id)}
                className="text-red-500 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringManager;
