import {
  faPause,
  faPlay,
  faForward,
  faPen,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";
import DataTable from "./ui/DataTable";
import { formatMoney } from "../utils/formatCurrency";
import { useCurrency } from "../contexts/CurrencyContext";

// Recurring rules table built on the shared DataTable so it matches the
// Transactions/other tables (same header/row styling + client-side column
// sorting). The list is loaded in full (not paginated), so sorting is
// uncontrolled — DataTable reorders in memory via each column's sortAccessor.
const RecurringTable = ({ items, onToggleActive, onSkip, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const { baseCurrency } = useCurrency();

  const columns = [
    {
      key: "name",
      header: t("recurringTable.name"),
      sortable: true,
      render: (item) => (
        <span
          className={`flex items-center gap-2 font-medium ${
            item.active ? "" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {item.name}
          {!item.active && (
            <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">
              {t("recurringTable.pausedBadge")}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      header: t("recurringTable.amount"),
      align: "right",
      sortable: true,
      sortType: "number",
      sortAccessor: (item) => Number(item.amount),
      // Amount is stored in the rule's own entry currency (converted to base
      // only when it fires), so show it in that currency at rate 1.
      render: (item) =>
        formatMoney(item.amount, item.currency || baseCurrency, 1),
    },
    { key: "type", header: t("recurringTable.type"), cellClassName: "capitalize" },
    {
      key: "category",
      header: t("recurringTable.category"),
      sortable: true,
      sortAccessor: (item) => item.category_name || "",
      render: (item) => item.category_name,
    },
    { key: "frequency", header: t("recurringTable.frequency"), cellClassName: "capitalize" },
    {
      key: "next_due",
      header: t("recurringTable.nextDue"),
      align: "right",
      sortable: true,
      render: (item) => item.next_due,
    },
    {
      key: "actions",
      header: "",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onToggleActive(item)}
            className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
            aria-label={item.active ? t("recurringTable.pause") : t("recurringTable.resume")}
            title={item.active ? t("recurringTable.pause") : t("recurringTable.resume")}
          >
            <FontAwesomeIcon icon={item.active ? faPause : faPlay} />
          </button>
          <button
            onClick={() => onSkip(item)}
            className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
            aria-label={t("recurringTable.skip")}
            title={t("recurringTable.skip")}
          >
            <FontAwesomeIcon icon={faForward} />
          </button>
          <button
            onClick={() => onEdit(item)}
            className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
            aria-label={t("recurringTable.edit")}
            title={t("recurringTable.edit")}
          >
            <FontAwesomeIcon icon={faPen} />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="rounded p-1.5 text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
            aria-label={t("recurringTable.delete")}
            title={t("recurringTable.delete")}
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
      rows={items}
      getRowKey={(item) => item.id}
      emptyMessage={t("recurringTable.empty")}
    />
  );
};

export default RecurringTable;
