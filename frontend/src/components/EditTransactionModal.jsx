import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../api";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";

// Edit an existing transaction. Type is fixed (the category list is filtered to
// the transaction's type) — switching income<->expense means delete + re-add,
// which keeps the type/category pairing consistent. The backend re-balances the
// account via its save signals.
const EditTransactionModal = ({ transaction, onClose, onUpdated }) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState(transaction.name);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [date, setDate] = useState(transaction.date);
  const [category, setCategory] = useState(String(transaction.category));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((res) => setCategories(res.data))
      .catch(() => toast.error(t("transaction.loadCategoriesFailed")));
  }, []);

  const categoryOptions = categories
    .filter((c) => c.type === transaction.type)
    .map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ));

  const save = (e) => {
    e.preventDefault();
    if (!(name && amount && date && category)) {
      toast.error(t("transaction.emptyFields"));
      return;
    }
    setIsSaving(true);
    api
      .patch(`/api/transactions/update/${transaction.id}`, {
        name,
        amount,
        date,
        category,
        type: transaction.type,
      })
      .then(() => {
        toast.success(t("editTx.updated"));
        onUpdated();
        onClose();
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.amount?.[0] ||
            err.response?.data?.category?.[0] ||
            t("editTx.updateFailed")
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
            {transaction.type === "expense"
              ? t("editTx.editExpense")
              : t("editTx.editIncome")}
          </h3>

          <Input
            label={t("transaction.description")}
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Select
              label={t("transaction.category")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t("transaction.selectCategory")}</option>
              {categoryOptions}
            </Select>
          </div>

          <Input
            label={t("transaction.date")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

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

export default EditTransactionModal;
