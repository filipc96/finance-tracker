const Card = ({ title, description, className = "", children, actions }) => (
  <div
    className={`rounded-xl border border-gray-200 bg-white shadow-sm
      dark:border-gray-700 dark:bg-gray-800 ${className}`}
  >
    {(title || actions) && (
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-700 px-6 py-4">
        <div>
          {title && <h3>{title}</h3>}
          {description && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export default Card;
