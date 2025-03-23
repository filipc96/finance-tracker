import NavigationItem from "./NavigationItem";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const NavigationBar = ({ menuItems }) => {
  const getNavigationItems = menuItems.map((item, index) => (
    <NavigationItem key={index} item={item}></NavigationItem>
  ));

  return (
    <div className="px-10 py-12 flex flex-col border border-r-1 w-1/5 h-screen">
      <div className="logo-div flex items-center space-x-3">
        <div className="bg-black dark:bg-gray-700 p-3 rounded-xl">
          <FontAwesomeIcon icon={faWallet} className="text-2xl text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold logo-text">Fintrax</span>
          <span className="text-sm text-gray-500">Personal Finance</span>
        </div>
      </div>

      <div className="mt-10 ms-3 flex flex-col space-y-8">
        {getNavigationItems}
      </div>
    </div>
  );
};

export default NavigationBar;
