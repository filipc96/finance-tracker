import NavigationItem from "./NavigationItem";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const NavigationBar = ({ menuItems }) => {
  const getNavigationItems = menuItems.map((item, index) => (
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
            Personal Finance
          </span>
        </div>
      </div>

      <nav className="mt-6 md:mt-10 ms-2 flex flex-col space-y-6 md:space-y-8 flex-grow overflow-y-auto">
        {getNavigationItems}
      </nav>
    </div>
  );
};

export default NavigationBar;
