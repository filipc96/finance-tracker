import Dashboard from "./components/Dashboard";
import { Route, Routes, BrowserRouter } from "react-router-dom";
import SharedLayout from "./components/SharedLayout";
import MyAccount from "./components/MyAccount";
import Categories from "./components/Categories";
import Analytics from "./components/Analytics";
import History from "./components/History";

import {
  faEnvelope,
  faGauge,
  faAddressBook,
  faGroupArrowsRotate,
  faChartBar,
  faHistory,
} from "@fortawesome/free-solid-svg-icons";
import Settings from "./components/Settings";

const menuItems = [
  {
    name: "Dashboard",
    icon: faGauge,
    link: "/",
    index: true,
    element: <Dashboard />,
  },
  {
    name: "My Account",
    icon: faAddressBook,
    link: "/myaccount",
    element: <MyAccount />,
  },
  {
    name: "Categories",
    icon: faGroupArrowsRotate,
    link: "/categories",
    element: <Categories />,
  },
  {
    name: "Settings",
    icon: faEnvelope,
    link: "/settings",
    element: <Settings />,
  },
  {
    name: "Analytics",
    icon: faChartBar,
    link: "/analytics",
    element: <Analytics />,
  },
  {
    name: "History",
    icon: faHistory,
    link: "/history",
    element: <History />,
  },
];

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SharedLayout menuItems={menuItems} />}>
            {menuItems.map((item, index) =>
              item?.index ? (
                <Route key={index} index element={item.element} />
              ) : (
                <Route key={index} path={item.link} element={item.element} />
              )
            )}
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;

{
  /* <Route index element={<Dashboard />} />
            <Route path="/myaccount" element={<MyAccoount />} />
            <Route path="/categories" element={<Categories />} /> */
}
