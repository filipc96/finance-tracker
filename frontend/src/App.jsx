import { Route, Routes, BrowserRouter, Navigate } from "react-router-dom";
import SharedLayout from "./layouts/SharedLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import {
  faGauge,
  faAddressBook,
  faGroupArrowsRotate,
  faChartBar,
  faHistory,
  faGear,
  faSignOut,
  faWallet,
  faArrowTrendUp,
  faPiggyBank,
  faRotate,
} from "@fortawesome/free-solid-svg-icons";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { lazy, useEffect } from "react";
import { Toaster } from "react-hot-toast";

// Route pages are lazy so each becomes its own chunk; the chart-heavy pages
// (Dashboard/Analytics/Savings) pull chart.js only when actually visited.
// Login/Register/NotFound stay eager — they render outside the Suspense
// boundary and are the unauthenticated entry point.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyAccount = lazy(() => import("./pages/MyAccount"));
const Categories = lazy(() => import("./pages/Categories"));
const Analytics = lazy(() => import("./pages/Analytics"));
const History = lazy(() => import("./pages/History"));
const Recurring = lazy(() => import("./pages/Recurring"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Stocks = lazy(() => import("./pages/Stocks"));
const Savings = lazy(() => import("./pages/Savings"));
const Settings = lazy(() => import("./pages/Settings"));

// `name` is the English fallback; `labelKey` is the i18n key the sidebar renders
// (see components/NavigationItem.jsx). Keep `name` so anything still reading it
// keeps working.
const menuItems = [
  {
    name: "Dashboard",
    labelKey: "nav.dashboard",
    icon: faGauge,
    path: "/",
    index: true,
    element: <Dashboard />,
  },
  {
    name: "My Account",
    labelKey: "nav.myAccount",
    icon: faAddressBook,
    path: "/myaccount",
    element: <MyAccount />,
  },
  {
    name: "Categories",
    labelKey: "nav.categories",
    icon: faGroupArrowsRotate,
    path: "/categories",
    element: <Categories />,
  },
  {
    name: "Settings",
    labelKey: "nav.settings",
    icon: faGear,
    path: "/settings",
    element: <Settings />,
  },
  {
    name: "Analytics",
    labelKey: "nav.analytics",
    icon: faChartBar,
    path: "/analytics",
    element: <Analytics />,
  },
  {
    name: "History",
    labelKey: "nav.history",
    icon: faHistory,
    path: "/history",
    element: <History />,
  },
  {
    // Reached via a button on the History page, not the sidebar (hidden), so
    // the nav doesn't pile up. Still a real route so it can be linked/deep-linked.
    name: "Recurring",
    labelKey: "nav.recurring",
    icon: faRotate,
    path: "/recurring",
    element: <Recurring />,
    hidden: true,
  },
  {
    name: "Budgets",
    labelKey: "nav.budgets",
    icon: faWallet,
    path: "/budgets",
    element: <Budgets />,
  },
  {
    name: "Stocks",
    labelKey: "nav.stocks",
    icon: faArrowTrendUp,
    path: "/stocks",
    element: <Stocks />,
  },
  {
    name: "Savings",
    labelKey: "nav.savings",
    icon: faPiggyBank,
    path: "/savings",
    element: <Savings />,
  },
  {
    name: "Log Out",
    labelKey: "nav.logout",
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
      <Toaster position="top-right" />
      <Routes>
        {/* Auth routes outside ThemeProvider */}
        <Route path="/login" element={<LoginWithCleanup />} />
        <Route path="/register" element={<RegisterWithCleanup />} />

        {/* Protected routes inside ThemeProvider */}
        <Route
          path="/"
          element={
            <ThemeProvider>
              <CurrencyProvider>
                <SharedLayout menuItems={menuItems} />
              </CurrencyProvider>
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
