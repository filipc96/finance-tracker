import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../api";
import Button from "../components/ui/Button";
import { formatMoney } from "../utils/formatCurrency";

const currentMonth = () => new Date().toISOString().slice(0, 7);

const BudgetBar = ({ budget, onDelete, onUpdate }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(budget.amount);

  const spent = Number(budget.spent);
  const limit = Number(budget.amount);
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const barWidth = Math.min(percent, 100);
  const barColor =
    percent >= 100
      ? "bg-red-500"
      : percent >= 75
      ? "bg-yellow-500"
      : "bg-green-500";

  const saveAmount = () => {
    onUpdate(budget.id, amount);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{budget.category_name}</span>
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
              />
              <button onClick={saveAmount} className="text-blue-600 text-sm">
                {t("common.save")}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-gray-500 text-sm"
              >
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {formatMoney(spent)} / {formatMoney(limit)}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-blue-600 text-sm"
              >
                {t("common.edit")}
              </button>
              <button
                onClick={() => onDelete(budget.id)}
                className="text-red-500 text-sm"
              >
                {t("common.delete")}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {t("budgets.used", { percent })}
        {percent >= 100 ? t("budgets.overBudget") : ""}
      </div>
    </div>
  );
};

const Budgets = () => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const getBudgets = (targetMonth = month) => {
    api
      .get(`/api/budgets/?month=${targetMonth}`)
      .then((res) => setBudgets(res.data))
      .catch(() => toast.error(t("budgets.loadFailed")));
  };

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((res) =>
        setCategories(res.data.filter((c) => c.type === "expense"))
      )
      .catch(() => toast.error(t("budgets.loadCategoriesFailed")));
  }, []);

  useEffect(() => {
    getBudgets(month);
  }, [month]);

  const addBudget = (e) => {
    e.preventDefault();
    if (!categoryId || !amount) {
      toast.error(t("budgets.pickCategoryAmount"));
      return;
    }
    api
      .post("/api/budgets/", {
        category: categoryId,
        amount,
        month: `${month}-01`,
      })
      .then(() => {
        toast.success(t("budgets.added"));
        setCategoryId("");
        setAmount("");
        getBudgets();
      })
      .catch((error) => {
        const data = error.response?.data;
        const message =
          data?.category?.[0] ||
          data?.non_field_errors?.[0] ||
          t("budgets.addFailed");
        toast.error(message);
      });
  };

  const updateBudget = (id, newAmount) => {
    api
      .patch(`/api/budgets/${id}/`, { amount: newAmount })
      .then(() => {
        toast.success(t("budgets.updated"));
        getBudgets();
      })
      .catch(() => toast.error(t("budgets.updateFailed")));
  };

  const deleteBudget = (id) => {
    api
      .delete(`/api/budgets/${id}/`)
      .then(() => {
        toast.success(t("budgets.deleted"));
        getBudgets();
      })
      .catch(() => toast.error(t("budgets.deleteFailed")));
  };

  return (
    <>
      <h2>{t("budgets.title")}</h2>

      <div className="flex flex-col gap-8 py-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            {t("budgets.month")}
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <form
          onSubmit={addBudget}
          className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex flex-col">
            <label className="text-sm mb-1 text-gray-600 dark:text-gray-300">
              {t("budgets.category")}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 min-w-[180px]"
            >
              <option value="">{t("budgets.selectCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1 text-gray-600 dark:text-gray-300">
              {t("budgets.monthlyLimit")}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 w-36"
            />
          </div>
          <Button type="submit" variant="secondary">
            {t("budgets.addBudget")}
          </Button>
        </form>

        <div className="flex flex-col gap-4">
          {budgets.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              {t("budgets.noBudgets")}
            </p>
          ) : (
            budgets.map((b) => (
              <BudgetBar
                key={b.id}
                budget={b}
                onDelete={deleteBudget}
                onUpdate={updateBudget}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default Budgets;
