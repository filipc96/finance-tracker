import { inputClasses } from "./Input";

const Select = ({ label, error, className = "", children, ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
      </label>
    )}
    <select className={inputClasses} {...props}>
      {children}
    </select>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

export default Select;
