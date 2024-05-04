import Dashboard from "./pages/Dashboard";
import { Route, Routes, BrowserRouter, Navigate } from "react-router-dom";
import SharedLayout from "./layouts/SharedLayout";
import MyAccount from "./pages/MyAccount";
import Categories from "./pages/Categories";
import Analytics from "./pages/Analytics";
import History from "./pages/History";
import ProtectedRoute from "./components/ProtectedRoute";

import {
  faGauge,
  faAddressBook,
  faGroupArrowsRotate,
  faChartBar,
  faHistory,
  faCalendar,
  faSignOut,
} from "@fortawesome/free-solid-svg-icons";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

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
  {
    name: "Log Out",
    icon: faSignOut,
    path: "/logout",
    element: <Logout />,
  },
];

function Logout() {
  localStorage.clear();
  return <Navigate to="/login" />;
}

function RegisterAndLogout() {
  localStorage.clear();
  return <Register></Register>;
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
          <Route
            path="/register"
            element={<RegisterAndLogout></RegisterAndLogout>}
          ></Route>
          <Route path="/notfound" element={<NotFound></NotFound>}></Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
