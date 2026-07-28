import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "../api";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import RecurringTable from "../components/RecurringTable";
import EditRecurringModal from "../components/EditRecurringModal";
import { CURRENCY_OPTIONS } from "../utils/formatCurrency";
import { useCurrency } from "../contexts/CurrencyContext";

const emptyForm = {
  name: "",
  amount: "",
  currency: "",
  category: "",
  type: "expense",
  frequency: "monthly",
  next_due: new Date().toISOString().slice(0, 10),
};

const Recurring = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { baseCurrency } = useCurrency();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // all | active | paused

  // Default the entry currency to base once it resolves (kept editable).
  useEffect(() => {
    setForm((prev) => (prev.currency ? prev : { ...prev, currency: baseCurrency }));
  }, [baseCurrency]);

  const getItems = () => {
    api
      .get("/api/recurring/")
      .then((res) => setItems(res.data))
      .catch(() => toast.error(t("recurring.loadFailed")));
  };

  useEffect(() => {
    getItems();
    api
      .get("/api/categories/")
      .then((res) => setCategories(res.data))
      .catch(() => toast.error(t("transaction.loadCategoriesFailed")));
  }, []);

  const setField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const addItem = (e) => {
    e.preventDefault();
    if (!form.name || !form.amount || !form.category) {
      toast.error(t("recurring.fillNameAmountCat"));
      return;
    }
    api
      .post("/api/recurring/", form)
      .then(() => {
        toast.success(t("recurring.added"));
        setForm({ ...emptyForm, currency: baseCurrency });
        getItems();
      })
      .catch((error) => {
        const data = error.response?.data;
        toast.error(
          data?.non_field_errors?.[0] ||
            data?.category?.[0] ||
            data?.amount?.[0] ||
            t("recurring.addFailed")
        );
      });
  };

  const deleteItem = (id) => {
    api
      .delete(`/api/recurring/delete/${id}`)
      .then(() => {
        toast.success(t("recurring.removed"));
        getItems();
      })
      .catch(() => toast.error(t("recurring.removeFailed")));
  };

  const toggleActive = (item) => {
    api
      .patch(`/api/recurring/update/${item.id}`, { active: !item.active })
      .then(() => {
        toast.success(
          item.active ? t("recurring.pausedToast") : t("recurring.resumedToast")
        );
        getItems();
      })
      .catch(() => toast.error(t("recurring.updateFailed")));
  };

  const skipItem = (item) => {
    api
      .post(`/api/recurring/skip/${item.id}`)
      .then(() => {
        toast.success(t("recurring.skipped"));
        getItems();
      })
      .catch(() => toast.error(t("recurring.skipFailed")));
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

  const activeFilterCount = (search.trim() ? 1 : 0) + (status !== "all" ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const matchingCategories = categories.filter((c) => c.type === form.type);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2>{t("recurring.title")}</h2>
        <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
          <FontAwesomeIcon icon={faArrowLeft} />
          {t("recurring.backToHistory")}
        </Button>
      </div>

      <div className="flex flex-col gap-6 py-6">
        {/* Add form */}
        <Card title={t("recurring.addTitle")}>
          <form onSubmit={addItem} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label={t("recurring.name")}
                placeholder={t("recurring.namePlaceholder")}
                value={form.name}
                onChange={setField("name")}
              />
              <Input
                label={t("recurring.amount")}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={setField("amount")}
              />
              <Select
                label={t("recurring.currency")}
                value={form.currency || baseCurrency}
                onChange={setField("currency")}
                title={t("recurring.currencyTitle")}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                    {c.code === baseCurrency ? t("settings.baseSuffix") : ""}
                  </option>
                ))}
              </Select>
              <Select
                label={t("recurring.type")}
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value,
                    category: "",
                  }))
                }
              >
                <option value="expense">{t("history.expense")}</option>
                <option value="income">{t("chart.income")}</option>
              </Select>
              <Select
                label={t("recurring.category")}
                value={form.category}
                onChange={setField("category")}
              >
                <option value="">{t("recurring.selectCategory")}</option>
                {matchingCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                label={t("recurring.frequency")}
                value={form.frequency}
                onChange={setField("frequency")}
              >
                <option value="daily">{t("recurring.freqDaily")}</option>
                <option value="weekly">{t("recurring.freqWeekly")}</option>
                <option value="monthly">{t("recurring.freqMonthly")}</option>
                <option value="yearly">{t("recurring.freqYearly")}</option>
              </Select>
              <Input
                label={t("recurring.firstDue")}
                type="date"
                value={form.next_due}
                onChange={setField("next_due")}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm">
                {t("common.add")}
              </Button>
            </div>
          </form>
        </Card>

        {/* Filters + table */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {t("recurring.count", { count: visibleItems.length })}
              {activeFilterCount > 0 ? t("history.filteredSuffix") : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters((s) => !s)}
            >
              {activeFilterCount > 0
                ? t("history.filtersCount", { count: activeFilterCount })
                : t("history.filters")}
            </Button>
          </div>

          {showFilters && (
            <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label={t("history.search")}
                  placeholder={t("history.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  label={t("recurring.status")}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">{t("recurring.all")}</option>
                  <option value="active">{t("recurring.active")}</option>
                  <option value="paused">{t("recurring.paused")}</option>
                </Select>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                >
                  {t("history.clear")}
                </Button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("recurring.noneYet")}
            </p>
          ) : (
            <RecurringTable
              items={visibleItems}
              onToggleActive={toggleActive}
              onSkip={skipItem}
              onEdit={setEditing}
              onDelete={deleteItem}
            />
          )}
        </div>
      </div>

      {editing && (
        <EditRecurringModal
          item={editing}
          onClose={() => setEditing(null)}
          onUpdated={getItems}
        />
      )}
    </>
  );
};

export default Recurring;
