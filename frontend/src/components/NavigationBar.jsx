import {
  faEnvelope,
  faGauge,
  faAddressBook,
  faGroupArrowsRotate,
} from "@fortawesome/free-solid-svg-icons";

import ReactLogo from "./../assets/react.svg";
import NavigationItem from "./NavigationItem";

const navLinks = [
  {
    name: "Dashboard",
    icon: faGauge,
    link: "/",
  },
  {
    name: "My Account",
    icon: faAddressBook,
    link: "/myaccount",
  },
  {
    name: "Categories",
    icon: faGroupArrowsRotate,
    link: "/categories",
  },
  {
    name: "Meni 4",
    icon: faEnvelope,
    link: "/",
  },
];
// "#61DBFB"

const NavigationBar = () => {
  return (
    <div className="px-10 py-12 flex flex-col border border-r-1 w-1/5 h-screen">
      <div className="logo-div flex space-x-3 items-center">
        <img src={ReactLogo} alt="react" />
        <span>Money Tracker</span>
      </div>

      <div className="mt-10 ms-3 flex flex-col space-y-8">
        {navLinks.map((item, index) => (
          <NavigationItem key={index} item={item}></NavigationItem>
        ))}
      </div>
    </div>
  );
};

export default NavigationBar;
