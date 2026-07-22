export const inputClasses = `w-full rounded-lg border border-gray-300 bg-gray-50
  px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
  dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400`;

const Input = ({ label, error, className = "", ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
      </label>
    )}
    <input className={inputClasses} {...props} />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

export default Input;
