import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";
import { CURRENCY_OPTIONS } from "../utils/formatCurrency";
import { useCurrency } from "../contexts/CurrencyContext";

// Edit an existing recurring rule. Type is fixed (the category list is scoped to
// the rule's type) — matching how transactions are edited. Amount/currency/
// category/frequency/next_due changes take effect on the next materialization
// run.
const EditRecurringModal = ({ item, onClose, onUpdated }) => {
  const { baseCurrency } = useCurrency();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [currency, setCurrency] = useState(item.currency || baseCurrency);
  const [category, setCategory] = useState(String(item.category));
  const [frequency, setFrequency] = useState(item.frequency);
  const [nextDue, setNextDue] = useState(item.next_due);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((res) => setCategories(res.data))
      .catch(() => toast.error("Failed to load categories."));
  }, []);

  const categoryOptions = categories
    .filter((c) => c.type === item.type)
    .map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ));

  const save = (e) => {
    e.preventDefault();
    if (!(name && amount && category && nextDue)) {
      toast.error("You can't leave the fields empty!");
      return;
    }
    setIsSaving(true);
    api
      .patch(`/api/recurring/update/${item.id}`, {
        name,
        amount,
        currency,
        category,
        frequency,
        next_due: nextDue,
        type: item.type,
      })
      .then(() => {
        toast.success("Recurring transaction updated.");
        onUpdated();
        onClose();
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.amount?.[0] ||
            err.response?.data?.category?.[0] ||
            err.response?.data?.non_field_errors?.[0] ||
            "Failed to update recurring transaction."
        )
      )
      .finally(() => setIsSaving(false));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <h3>Edit recurring {item.type === "expense" ? "expense" : "income"}</h3>

          <Input
            label="Name"
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                  {c.code === baseCurrency ? " (base)" : ""}
                </option>
              ))}
            </Select>
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select category</option>
              {categoryOptions}
            </Select>
            <Select
              label="Frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
            <Input
              label="Next due"
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 mt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={isSaving}
            >
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRecurringModal;
