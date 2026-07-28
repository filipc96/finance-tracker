import AddTransaction from "../components/AddTransaction";
import EditTransactionModal from "../components/EditTransactionModal";
import TransactionTable from "../components/TransactionsTable";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import api from "../api";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const EMPTY_FILTERS = {
  search: "",
  type: "",
  category: "",
  date_from: "",
  date_to: "",
  min_amount: "",
  max_amount: "",
};

const History = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sort, setSort] = useState({ key: "date", dir: "desc" });

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const getTransactions = (
    targetPage = page,
    activeFilters = filters,
    activeSort = sort
  ) => {
    const params = new URLSearchParams({ page: targetPage });
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    if (activeSort?.key) {
      params.append(
        "ordering",
        `${activeSort.dir === "desc" ? "-" : ""}${activeSort.key}`
      );
    }
    api
      .get(`/api/transactions/?${params.toString()}`)
      .then((response) => {
        setTransactions(response.data.results);
        setCount(response.data.count);
        setHasNext(Boolean(response.data.next));
        setPage(targetPage);
      })
      .catch((error) => {
        if (error.response?.status === 404 && targetPage > 1) {
          // Page no longer exists (e.g. deleted last item on last page)
          getTransactions(1, activeFilters);
        } else {
          toast.error(t("history.loadFailed"));
        }
      });
  };

  const setFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const applyFilters = () => getTransactions(1, filters);

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    getTransactions(1, EMPTY_FILTERS);
  };

  const changeSort = (nextSort) => {
    setSort(nextSort);
    getTransactions(1, filters, nextSort);
  };

  const deleteTransaction = (id) => {
    api
      .delete(`/api/transactions/delete/${id}`)
      .then(() => {
        toast.success(t("history.deleted"));
        getTransactions();
      })
      .catch(() => toast.error(t("history.deleteFailed")));
  };

  const exportCSV = () => {
    api
      .get("/api/transactions/export/", { responseType: "blob" })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const link = document.createElement("a");
        link.href = url;
        link.download = "transactions.csv";
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error(t("history.exportFailed")));
  };

  const importCSV = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    api
      .post("/api/transactions/import/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        const { created, errors } = res.data;
        toast.success(t("history.imported", { count: created }));
        if (errors.length > 0) {
          toast.error(
            t("history.rowsSkipped", {
              count: errors.length,
              row: errors[0].row,
              error: errors[0].error,
            })
          );
        }
        getTransactions(1);
      })
      .catch((error) =>
        toast.error(error.response?.data?.error || t("history.importFailed"))
      );
  };

  useEffect(() => {
    getTransactions(1);
    api
      .get("/api/categories/")
      .then((res) => setCategories(res.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h2>{t("history.title")}</h2>

      <div className="flex flex-col space-y-8 py-6 justify-center items-center">
        <div className="flex space-x-8 py-6">
          <AddTransaction
            type="expense"
            callback={() => getTransactions()}
          ></AddTransaction>
          <AddTransaction
            type="income"
            callback={() => getTransactions()}
          ></AddTransaction>
        </div>
        <div className="w-full flex justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/recurring")}
          >
            <FontAwesomeIcon icon={faRotate} />
            {t("history.recurring")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters((s) => !s)}
          >
            {activeFilterCount > 0
              ? t("history.filtersCount", { count: activeFilterCount })
              : t("history.filters")}
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            {t("history.exportCsv")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("history.importCsv")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={importCSV}
            className="hidden"
          />
        </div>

        {showFilters && (
          <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyFilters();
              }}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label={t("history.search")}
                  placeholder={t("history.searchPlaceholder")}
                  value={filters.search}
                  onChange={(e) => setFilter("search", e.target.value)}
                />
                <Select
                  label={t("history.type")}
                  value={filters.type}
                  onChange={(e) => setFilter("type", e.target.value)}
                >
                  <option value="">{t("history.allTypes")}</option>
                  <option value="income">{t("chart.income")}</option>
                  <option value="expense">{t("history.expense")}</option>
                </Select>
                <Select
                  label={t("history.category")}
                  value={filters.category}
                  onChange={(e) => setFilter("category", e.target.value)}
                >
                  <option value="">{t("history.allCategories")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label={t("history.fromDate")}
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilter("date_from", e.target.value)}
                />
                <Input
                  label={t("history.toDate")}
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilter("date_to", e.target.value)}
                />
                <Input
                  label={t("history.minAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={filters.min_amount}
                  onChange={(e) => setFilter("min_amount", e.target.value)}
                />
                <Input
                  label={t("history.maxAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={filters.max_amount}
                  onChange={(e) => setFilter("max_amount", e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                >
                  {t("history.clear")}
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {t("history.apply")}
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="w-full">
          <div className="flex justify-between items-center pb-2 text-sm text-gray-600 dark:text-gray-300">
            <span>
              {t("history.countTransactions", { count })}
              {activeFilterCount > 0 ? t("history.filteredSuffix") : ""}
            </span>
          </div>
          <TransactionTable
            transactions={transactions}
            onDelete={deleteTransaction}
            onEdit={setEditing}
            sort={sort}
            onSortChange={changeSort}
          />
          {count > PAGE_SIZE && (
            <div className="flex items-center justify-center space-x-4 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => getTransactions(page - 1)}
                disabled={page <= 1}
              >
                {t("history.prev")}
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {t("history.pageOf", { page, total: totalPages })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => getTransactions(page + 1)}
                disabled={!hasNext}
              >
                {t("history.next")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditTransactionModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => getTransactions()}
        />
      )}
    </>
  );
};

export default History;
