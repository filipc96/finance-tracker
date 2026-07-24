import { useState } from "react";
import { faSort, faSortUp, faSortDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Reusable table: one consistent style + column sorting for every table in the app.
//
// Column shape:
//   { key, header, align?: 'left'|'right',
//     sortable?, sortKey?, sortAccessor?: (row)=>value, sortType?: 'number'|'string',
//     render?: (row)=>node, headerClassName?, cellClassName? }
//
// Sort modes (chosen by whether `onSortChange` is passed):
//   - Controlled / server: parent passes `sort={{key,dir}}` + `onSortChange`. The
//     table only renders indicators and reports the next sort; the parent reorders
//     (e.g. refetches with an `ordering` param). Used for paginated data.
//   - Uncontrolled / client: no `onSortChange`. The table holds its own sort state
//     and sorts `rows` in memory via sortAccessor/sortType.
const nextDir = (dir) => (dir === "asc" ? "desc" : "asc");
const alignClass = (align) => (align === "right" ? "text-right" : "text-left");

const DataTable = ({
  columns,
  rows,
  getRowKey,
  emptyMessage = "Nothing to show.",
  sort: controlledSort,
  onSortChange,
}) => {
  const isControlled = typeof onSortChange === "function";
  const [clientSort, setClientSort] = useState(null); // { key, dir } | null
  const sort = isControlled ? controlledSort : clientSort;

  const handleSort = (col) => {
    if (!col.sortable) return;
    const dir = sort && sort.key === col.key ? nextDir(sort.dir) : "asc";
    const next = { key: col.key, dir };
    if (isControlled) onSortChange(next);
    else setClientSort(next);
  };

  // Client mode reorders here; controlled mode trusts the order the parent gives.
  let displayRows = rows;
  if (!isControlled && sort) {
    const col = columns.find((c) => c.key === sort.key);
    if (col) {
      const accessor = col.sortAccessor || ((row) => row[col.key]);
      const factor = sort.dir === "asc" ? 1 : -1;
      displayRows = [...rows].sort((a, b) => {
        const va = accessor(a);
        const vb = accessor(b);
        if (col.sortType === "number") {
          return ((Number(va) || 0) - (Number(vb) || 0)) * factor;
        }
        return (
          String(va ?? "").localeCompare(String(vb ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          }) * factor
        );
      });
    }
  }

  return (
    <div className="relative overflow-x-auto shadow-md rounded-md border dark:border-gray-700">
      <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            {columns.map((col) => {
              const active = sort && sort.key === col.key;
              const ariaSort = !col.sortable
                ? undefined
                : active
                ? sort.dir === "asc"
                  ? "ascending"
                  : "descending"
                : "none";
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`px-6 py-3 ${alignClass(col.align)} ${
                    col.headerClassName || ""
                  }`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className="inline-flex items-center gap-1.5 uppercase font-medium hover:text-gray-900 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
                    >
                      <span>{col.header}</span>
                      <FontAwesomeIcon
                        icon={
                          active
                            ? sort.dir === "asc"
                              ? faSortUp
                              : faSortDown
                            : faSort
                        }
                        className={active ? "" : "opacity-30"}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-8 text-center text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            displayRows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-4 ${alignClass(col.align)} ${
                      col.cellClassName || ""
                    }`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
