// Compact select used for chart controls (year / timespan / type). Kept separate
// from ui/Select (which is a labelled form field) so the inline chart-header
// controls stay small and share one dark-mode-aware style everywhere.
const ChartSelect = ({ className = "", children, ...props }) => (
  <select
    className={`cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm
      text-gray-700 transition-colors hover:border-primary-400 focus:border-primary-500
      focus:outline-none focus:ring-2 focus:ring-primary-200
      dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-primary-500
      dark:focus:ring-primary-900/40 ${className}`}
    {...props}
  >
    {children}
  </select>
);

export default ChartSelect;
