import Dashboard from "./components/Dashboard";
import { Route, Routes, BrowserRouter } from "react-router-dom";
import SharedLayout from "./components/SharedLayout";
import MyAccoount from "./components/MyAccoount";
import Categories from "./components/Categories";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SharedLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/myaccount" element={<MyAccoount />} />
            <Route path="/categories" element={<Categories />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
