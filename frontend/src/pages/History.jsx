import AddTransaction from "../components/AddTransaction";
import EditTransactionModal from "../components/EditTransactionModal";
import RecurringManager from "../components/RecurringManager";
import TransactionTable from "../components/TransactionsTable";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import api from "../api";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";

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
          toast.error("Failed to load transactions.");
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
        toast.success("Transaction deleted.");
        getTransactions();
      })
      .catch(() => toast.error("Failed to delete transaction."));
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
      .catch(() => toast.error("Failed to export transactions."));
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
        toast.success(`Imported ${created} transaction${created === 1 ? "" : "s"}.`);
        if (errors.length > 0) {
          toast.error(
            `${errors.length} row${errors.length === 1 ? "" : "s"} skipped ` +
              `(first: row ${errors[0].row} — ${errors[0].error})`
          );
        }
        getTransactions(1);
      })
      .catch((error) =>
        toast.error(error.response?.data?.error || "Failed to import CSV.")
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
      <h2>History</h2>

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
            onClick={() => setShowFilters((s) => !s)}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
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
                  label="Search"
                  placeholder="Name contains…"
                  value={filters.search}
                  onChange={(e) => setFilter("search", e.target.value)}
                />
                <Select
                  label="Type"
                  value={filters.type}
                  onChange={(e) => setFilter("type", e.target.value)}
                >
                  <option value="">All types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </Select>
                <Select
                  label="Category"
                  value={filters.category}
                  onChange={(e) => setFilter("category", e.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="From date"
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilter("date_from", e.target.value)}
                />
                <Input
                  label="To date"
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilter("date_to", e.target.value)}
                />
                <Input
                  label="Min amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={filters.min_amount}
                  onChange={(e) => setFilter("min_amount", e.target.value)}
                />
                <Input
                  label="Max amount"
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
                  Clear
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Apply
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="w-full">
          <div className="flex justify-between items-center pb-2 text-sm text-gray-600 dark:text-gray-300">
            <span>
              {count} transaction{count === 1 ? "" : "s"}
              {activeFilterCount > 0 ? " (filtered)" : ""}
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
                Prev
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => getTransactions(page + 1)}
                disabled={!hasNext}
              >
                Next
              </Button>
            </div>
          )}
        </div>{" "}
        <RecurringManager onMaterialized={() => getTransactions()} />
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
