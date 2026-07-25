// Standard header row for a chart inside a Card: a title (+ optional subtitle)
// on the left and any controls on the right. Every chart renders one of these so
// titles and control placement stay identical across the Analytics page.
const ChartHeader = ({ title, subtitle, children }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

export default ChartHeader;
