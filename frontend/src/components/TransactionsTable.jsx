import { faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatAmount } from "../utils/formatCurrency";

const TransactionTable = ({ transactions, onDelete, onEdit }) => {
  return (
    <div className="relative overflow-x-auto shadow-md rounded-md border">
      <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-6 py-3">
              Name
            </th>
            <th scope="col" className="px-6 py-3">
              Type
            </th>
            <th scope="col" className="px-6 py-3">
              Amount
            </th>
            <th scope="col" className="px-6 py-3">
              Date
            </th>
            <th scope="col" className="px-6 py-3">
              Category
            </th>
            <th scope="col" className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            return (
              <tr
                className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                key={transaction.id}
              >
                <td className="px-6 py-4"> {transaction.name}</td>
                <td className="px-6 py-4"> {transaction.type}</td>
                {transaction.type === "expense" ? (
                  <td className="px-6 py-4 text text-red-500">
                    {" "}
                    -{formatAmount(transaction.amount)}
                  </td>
                ) : (
                  <td className="px-6 py-4 text-green-500">
                    {" "}
                    +{formatAmount(transaction.amount)}
                  </td>
                )}
                <td className="px-6 py-4">{transaction.date}</td>
                <td className="px-6 py-4">{transaction.category_name}</td>

                <td className="px-6 py-4">
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(transaction)}
                        className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
                        aria-label="Edit transaction"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(transaction.id)}
                      className="rounded p-1.5 text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                      aria-label="Delete transaction"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;
