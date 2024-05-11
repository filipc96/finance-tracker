const CategoryTable = ({ categories }) => {
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
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            return (
              <tr
                className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700"
                key={category.id}
              >
                <td className="px-6 py-4"> {category.name}</td>
                <td className="px-6 py-4"> {category.type}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CategoryTable;
