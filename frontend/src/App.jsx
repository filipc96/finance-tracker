import Dashboard from "./components/Dashboard";
import { Route, Routes, BrowserRouter, Navigate } from "react-router-dom";
import SharedLayout from "./components/SharedLayout";
import MyAccount from "./components/MyAccount";
import Categories from "./components/Categories";
import Analytics from "./components/Analytics";
import History from "./components/History";
import ProtectedRoute from "./components/ProtectedRoute";

import {
  faGauge,
  faAddressBook,
  faGroupArrowsRotate,
  faChartBar,
  faHistory,
  faCalendar,
} from "@fortawesome/free-solid-svg-icons";
import Settings from "./components/Settings";
import Login from "./components/Login";
import Register from "./components/Register";
import NotFound from "./components/NotFound";

const menuItems = [
  {
    name: "Dashboard",
    icon: faGauge,
    path: "/",
    index: true,
    element: <Dashboard />,
  },
  {
    name: "My Account",
    icon: faAddressBook,
    path: "/myaccount",
    element: <MyAccount />,
  },
  {
    name: "Categories",
    icon: faGroupArrowsRotate,
    path: "/categories",
    element: <Categories />,
  },
  {
    name: "Settings",
    icon: faCalendar,
    path: "/settings",
    element: <Settings />,
  },
  {
    name: "Analytics",
    icon: faChartBar,
    path: "/analytics",
    element: <Analytics />,
  },
  {
    name: "History",
    icon: faHistory,
    path: "/history",
    element: <History />,
  },
];

function Logout() {
  localStorage.clear();
  return <Navigate to="/login" />;
}

function RegisterAndLogout() {
  localStorage.clear();
  return <Navigate to="/login" />;
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SharedLayout menuItems={menuItems} />}>
            {menuItems.map((item, index) =>
              item?.index ? (
                <Route
                  key={index}
                  index
                  element={<ProtectedRoute>{item.element}</ProtectedRoute>}
                />
              ) : (
                <Route
                  key={index}
                  path={item.path}
                  element={<ProtectedRoute>{item.element}</ProtectedRoute>}
                />
              )
            )}
          </Route>

          <Route path="/login" element={<Login></Login>}></Route>
          <Route path="/logout" element={<Logout></Logout>}></Route>
          <Route path="/register" element={<Register></Register>}></Route>
          <Route path="/404" element={<NotFound></NotFound>}></Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
