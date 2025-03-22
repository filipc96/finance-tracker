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
import { ThemeProvider } from "./contexts/ThemeContext";
import { useEffect } from "react";

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

function LoginWithCleanup() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("darkMode");
    return () => {
      const savedDarkMode = localStorage.getItem("darkMode");
      if (savedDarkMode === "true") {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);
  return <Login />;
}

function RegisterWithCleanup() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("darkMode");
    return () => {
      const savedDarkMode = localStorage.getItem("darkMode");
      if (savedDarkMode === "true") {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);
  return <Register />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes outside ThemeProvider */}
        <Route path="/login" element={<LoginWithCleanup />} />
        <Route path="/register" element={<RegisterWithCleanup />} />

        {/* Protected routes inside ThemeProvider */}
        <Route
          path="/"
          element={
            <ThemeProvider>
              <SharedLayout menuItems={menuItems} />
            </ThemeProvider>
          }
        >
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

        <Route path="/notfound" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
