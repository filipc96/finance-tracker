import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      .catch(() => toast.error(t("transaction.loadCategoriesFailed")));
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
      toast.error(t("transaction.emptyFields"));
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
        toast.success(t("editRecurring.updated"));
        onUpdated();
        onClose();
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.amount?.[0] ||
            err.response?.data?.category?.[0] ||
            err.response?.data?.non_field_errors?.[0] ||
            t("recurring.updateFailed")
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
          <h3>
            {item.type === "expense"
              ? t("editRecurring.editExpense")
              : t("editRecurring.editIncome")}
          </h3>

          <Input
            label={t("editRecurring.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t("editRecurring.amount")}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Select
              label={t("editRecurring.currency")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                  {c.code === baseCurrency ? t("settings.baseSuffix") : ""}
                </option>
              ))}
            </Select>
            <Select
              label={t("editRecurring.category")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t("editRecurring.selectCategory")}</option>
              {categoryOptions}
            </Select>
            <Select
              label={t("editRecurring.frequency")}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="daily">{t("recurring.freqDaily")}</option>
              <option value="weekly">{t("recurring.freqWeekly")}</option>
              <option value="monthly">{t("recurring.freqMonthly")}</option>
              <option value="yearly">{t("recurring.freqYearly")}</option>
            </Select>
            <Input
              label={t("editRecurring.nextDue")}
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 mt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={isSaving}
            >
              {t("common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRecurringModal;
