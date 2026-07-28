import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";
import DataTable from "./ui/DataTable";
import { formatMoney } from "../utils/formatCurrency";

// Client-sorted table over the full (already-loaded) category list.
const CategoryTable = ({ categories, onDelete }) => {
  const { t } = useTranslation();
  const columns = [
    { key: "name", header: t("txTable.name"), sortable: true },
    { key: "type", header: t("txTable.type"), sortable: true, cellClassName: "capitalize" },
    {
      key: "transactions_sum",
      header: t("categoryTable.transactionsSum"),
      align: "right",
      sortable: true,
      sortType: "number",
      sortAccessor: (c) => c.transactions_sum,
      render: (c) =>
        c.type === "expense" ? (
          <span className="text-red-500">
            -{formatMoney(c.transactions_sum)}
          </span>
        ) : (
          <span className="text-green-500">
            +{formatMoney(c.transactions_sum)}
          </span>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <button
          onClick={() => onDelete(c.id)}
          className="rounded p-1.5 text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
          aria-label={t("categoryTable.deleteAria")}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={categories}
      getRowKey={(c) => c.id}
      emptyMessage={t("categoryTable.empty")}
    />
  );
};

export default CategoryTable;
