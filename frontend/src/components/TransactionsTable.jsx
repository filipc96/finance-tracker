import { faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import DataTable from "./ui/DataTable";
import { formatMoney } from "../utils/formatCurrency";

// Server-sorted table: column `key`s match the backend `ordering` whitelist, and
// History passes `sort`/`onSortChange` so header clicks refetch in the new order.
const TransactionTable = ({ transactions, onDelete, onEdit, sort, onSortChange }) => {
  const columns = [
    { key: "name", header: "Name", sortable: true },
    { key: "type", header: "Type", cellClassName: "capitalize" },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      render: (t) =>
        t.type === "expense" ? (
          <span className="text-red-500">-{formatMoney(t.amount)}</span>
        ) : (
          <span className="text-green-500">+{formatMoney(t.amount)}</span>
        ),
    },
    { key: "date", header: "Date", align: "right", sortable: true },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (t) => t.category_name,
    },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(t)}
              className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
              aria-label="Edit transaction"
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
          )}
          <button
            onClick={() => onDelete(t.id)}
            className="rounded p-1.5 text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
            aria-label="Delete transaction"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={transactions}
      getRowKey={(t) => t.id}
      emptyMessage="No transactions."
      sort={sort}
      onSortChange={onSortChange}
    />
  );
};

export default TransactionTable;
