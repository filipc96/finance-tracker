import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  faPause,
  faPlay,
  faForward,
  faPen,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "../api";
import Button from "./ui/Button";
import EditRecurringModal from "./EditRecurringModal";
import { formatAmount } from "../utils/formatCurrency";

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
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // all | active | paused

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

  const toggleActive = (item) => {
    api
      .patch(`/api/recurring/update/${item.id}`, { active: !item.active })
      .then(() => {
        toast.success(item.active ? "Paused." : "Resumed.");
        getItems();
      })
      .catch(() => toast.error("Failed to update recurring transaction."));
  };

  const skipItem = (item) => {
    api
      .post(`/api/recurring/skip/${item.id}`)
      .then(() => {
        toast.success("Skipped next occurrence.");
        getItems();
      })
      .catch(() => toast.error("Failed to skip recurring transaction."));
  };

  // Client-side narrowing of the loaded list by name and active/paused status.
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (status === "all" ||
          (status === "active" ? item.active : !item.active)) &&
        (!q || item.name.toLowerCase().includes(q))
    );
  }, [items, search, status]);

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

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} w-48`}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No recurring transactions yet.
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No recurring transactions match.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between py-2 text-sm ${
                item.active ? "" : "opacity-50"
              }`}
            >
              <span className="flex-1 font-medium flex items-center gap-2">
                {item.name}
                {!item.active && (
                  <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                    Paused
                  </span>
                )}
              </span>
              <span className="w-24">{formatAmount(item.amount)}</span>
              <span className="w-24 capitalize">{item.type}</span>
              <span className="w-28">{item.category_name}</span>
              <span className="w-24 capitalize">{item.frequency}</span>
              <span className="w-28">next: {item.next_due}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleActive(item)}
                  className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
                  aria-label={item.active ? "Pause" : "Resume"}
                  title={item.active ? "Pause" : "Resume"}
                >
                  <FontAwesomeIcon icon={item.active ? faPause : faPlay} />
                </button>
                <button
                  onClick={() => skipItem(item)}
                  className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
                  aria-label="Skip next occurrence"
                  title="Skip next occurrence"
                >
                  <FontAwesomeIcon icon={faForward} />
                </button>
                <button
                  onClick={() => setEditing(item)}
                  className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
                  aria-label="Edit"
                  title="Edit"
                >
                  <FontAwesomeIcon icon={faPen} />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded p-1.5 text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                  aria-label="Delete"
                  title="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditRecurringModal
          item={editing}
          onClose={() => setEditing(null)}
          onUpdated={getItems}
        />
      )}
    </div>
  );
};

export default RecurringManager;
