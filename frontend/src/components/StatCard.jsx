import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const TONES = {
  neutral: "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400",
  positive: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  negative: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const StatCard = ({ icon, label, value, subtext, tone = "neutral" }) => (
  <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {icon && (
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
      >
        <FontAwesomeIcon icon={icon} className="text-lg" />
      </div>
    )}
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-1 truncate text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      {subtext && (
        <div className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
          {subtext}
        </div>
      )}
    </div>
  </div>
);

export default StatCard;
