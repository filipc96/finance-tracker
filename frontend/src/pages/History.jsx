import AddTransaction from "../components/AddTransaction";
import RecurringManager from "../components/RecurringManager";
import TransactionTable from "../components/TransactionsTable";
import api from "../api";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";

const History = () => {
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
        <div className="w-full">
          <TransactionTable
            transactions={transactions}
            onDelete={deleteTransaction}
          />
          {count > PAGE_SIZE && (
            <div className="flex items-center justify-center space-x-4 py-4">
              <button
                onClick={() => getTransactions(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => getTransactions(page + 1)}
                disabled={!hasNext}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>{" "}
        <RecurringManager onMaterialized={() => getTransactions()} />
      </div>
    </>
  );
};

export default History;
