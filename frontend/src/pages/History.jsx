import AddTransaction from "../components/AddTransaction";
import TransactionTable from "../components/TransactionsTable";
import api from "../api";
import { useState, useEffect } from "react";

const History = () => {
  const [transactions, setTransactions] = useState([]);

  const getTransactions = () => {
    api
      .get("/api/transactions/")
      .then((response) => setTransactions(response.data))
      .catch((error) =>
        console.error("Error fetching the categories: ", error)
      );
  };

  const deleteTransaction = (id) => {
    api
      .delete(`/api/transactions/delete/${id}`)
      .then((res) => {
        if (res.status === 204) console.log("Transaction deleted!");
        else console.log("Failed to delete transaction.");
        getTransactions();
      })
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    getTransactions();
  }, []);
  return (
    <>
      <h2>History</h2>

      <div className="flex flex-col space-y-8 py-6 justify-center items-center">
        <div className="flex space-x-8 py-6">
          <AddTransaction
            type="expense"
            callback={getTransactions}
          ></AddTransaction>
          <AddTransaction
            type="income"
            callback={getTransactions}
          ></AddTransaction>
        </div>
        <div className="w-full">
          <TransactionTable
            transactions={transactions}
            onDelete={deleteTransaction}
          />
        </div>{" "}
      </div>
    </>
  );
};

export default History;
