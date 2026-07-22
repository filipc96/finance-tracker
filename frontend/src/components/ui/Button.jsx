const VARIANTS = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 border border-transparent",
  secondary:
    "bg-gray-900 text-white hover:bg-gray-800 border border-transparent dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-300 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-800",
  danger:
    "bg-transparent text-red-600 hover:bg-red-50 border border-transparent dark:text-red-400 dark:hover:bg-red-950/40",
};

const SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
};

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const Button = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) => (
  <button
    disabled={disabled || isLoading}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium
      transition-colors focus:outline-none focus-visible:ring-2
      focus-visible:ring-primary-500 focus-visible:ring-offset-2
      dark:focus-visible:ring-offset-gray-900
      disabled:opacity-50 disabled:cursor-not-allowed
      ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  >
    {isLoading && <Spinner />}
    {children}
  </button>
);

export default Button;
