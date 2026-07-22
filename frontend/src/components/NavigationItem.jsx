import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NavLink } from "react-router-dom";

const NavigationItem = ({ item }) => {
  return (
    <NavLink
      to={item?.path}
      end={item?.path === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
        transition-colors focus:outline-none focus-visible:ring-2
        focus-visible:ring-primary-500 ${
          isActive
            ? "bg-primary-50 text-primary-700 dark:bg-gray-700 dark:text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white"
        }`
      }
    >
      <FontAwesomeIcon icon={item?.icon} className="w-4" />
      <span>{item?.name}</span>
    </NavLink>
  );
};

export default NavigationItem;
