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
import { useCurrency } from "../contexts/CurrencyContext";
import { CURRENCY_OPTIONS } from "../utils/formatCurrency";
import { useTranslation } from "react-i18next";

const AddTransaction = ({ type, callback, className = "max-w-md" }) => {
  const { t } = useTranslation();
  const { baseCurrency } = useCurrency();
  const [categories, setCategories] = useState([]);
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  // Currency the amount is typed in; the backend converts it to the base
  // currency before storing. Defaults to base (no conversion).
  const [currency, setCurrency] = useState(baseCurrency);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Once the base currency resolves from the API, default the entry currency to
  // it (users can still switch to enter an amount in another currency).
  useEffect(() => {
    setCurrency(baseCurrency);
  }, [baseCurrency]);

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((response) => setCategories(response.data))
      .catch(() => toast.error(t("transaction.loadCategoriesFailed")));
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
          currency: currency,
        })
        .then(() => {
          toast.success(
            type === "expense"
              ? t("transaction.expenseAdded")
              : t("transaction.incomeAdded")
          );
          setName("");
          setAmount("");
          if (callback) callback();
        })
        .catch(() => toast.error(t("transaction.addFailed")))
        .finally(() => setIsSaving(false));
    } else {
      toast.error(t("transaction.emptyFields"));
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm w-full h-auto p-6 ${className}`}
    >
      <form onSubmit={addTransaction} className="flex flex-col gap-4">
        <h3>
          {type === "expense"
            ? t("transaction.addExpense")
            : t("transaction.addIncome")}
        </h3>

        <Input
          label={t("transaction.description")}
          type="text"
          placeholder={t("transaction.descriptionPlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t("transaction.amount")}
            type="number"
            min="0"
            step="0.01"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Select
            label={t("transaction.currency")}
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
        </div>

        <Select
          label={t("transaction.category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("transaction.selectCategory")}</option>
          {categoryOptions}
        </Select>

        {currency !== baseCurrency && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("transaction.conversionNote", { currency: baseCurrency })}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t("transaction.date")}
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
          {type === "expense"
            ? t("transaction.addExpense")
            : t("transaction.addIncome")}
        </Button>
      </form>
    </div>
  );
};

export default AddTransaction;
