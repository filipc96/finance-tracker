import AddTransaction from "../components/AddTransaction";
import RecurringManager from "../components/RecurringManager";
import TransactionTable from "../components/TransactionsTable";
import Button from "../components/ui/Button";
import api from "../api";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";

const History = () => {
  const fileInputRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const getTransactions = (targetPage = page) => {
    api
      .get(`/api/transactions/?page=${targetPage}`)
      .then((response) => {
        setTransactions(response.data.results);
        setCount(response.data.count);
        setHasNext(Boolean(response.data.next));
        setPage(targetPage);
      })
      .catch((error) => {
        if (error.response?.status === 404 && targetPage > 1) {
          // Page no longer exists (e.g. deleted last item on last page)
          getTransactions(1);
        } else {
          toast.error("Failed to load transactions.");
        }
      });
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
        <div className="w-full">
          <TransactionTable
            transactions={transactions}
            onDelete={deleteTransaction}
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
    </>
  );
};

export default History;
