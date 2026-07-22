import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const CategoryTable = ({ categories, onDelete }) => {
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
              Transactions Sum
            </th>
            <th scope="col" className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            return (
              <tr
                className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                key={category.id}
              >
                <td className="px-6 py-4"> {category.name}</td>
                <td className="px-6 py-4"> {category.type}</td>
                {category.type === "expense" ? (
                  <td className="px-6 py-4 text text-red-500">
                    {" "}
                    -{category.transactions_sum}
                  </td>
                ) : (
                  <td className="px-6 py-4 text-green-500">
                    {" "}
                    +{category.transactions_sum}
                  </td>
                )}
                <td className="px-6 py-4">
                  <button
                    onClick={() => onDelete(category.id)}
                    className="rounded p-1.5 text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                    aria-label="Delete category"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CategoryTable;
