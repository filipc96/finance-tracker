import { Outlet } from "react-router";
import NavigationBar from "../components/NavigationBar";
import Terminal from "../components/Terminal";

const SharedLayout = ({ menuItems }) => {
  return (
    <div className="flex">
      <NavigationBar menuItems={menuItems}></NavigationBar>
      <main className="grow">
        <div className="flex flex-col py-10 px-16 h-screen overflow-y-auto w-full">
          <Outlet />
        </div>
      </main>
      <Terminal />
    </div>
  );
};

export default SharedLayout;
