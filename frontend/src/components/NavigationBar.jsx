import NavigationItem from "./NavigationItem";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";

const NavigationBar = ({ menuItems }) => {
  const { t } = useTranslation();
  // `hidden` items are routed but kept off the sidebar (e.g. Recurring, which is
  // reached via a button on the History page).
  const getNavigationItems = menuItems
    .filter((item) => !item.hidden)
    .map((item, index) => (
      <NavigationItem key={index} item={item}></NavigationItem>
    ));

  return (
    <div className="h-screen px-6 md:px-10 py-8 md:py-12 flex flex-col">
      <div className="logo-div flex items-center space-x-3 mb-8 flex-shrink-0">
        <div className="bg-black dark:bg-gray-700 p-2 md:p-3 rounded-xl">
          <FontAwesomeIcon
            icon={faWallet}
            className="text-xl md:text-2xl text-white"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-lg md:text-xl font-bold logo-text">
            Fintrax
          </span>
          <span className="text-xs md:text-sm text-gray-500">
            {t("app.tagline")}
          </span>
        </div>
      </div>

      <nav className="mt-4 flex flex-col space-y-1 flex-grow overflow-y-auto">
        {getNavigationItems}
      </nav>
    </div>
  );
};

export default NavigationBar;
