import { Outlet } from "react-router";
import NavigationBar from "../components/NavigationBar";
import Terminal from "../components/Terminal";
import Chat from "../components/Chat";
import { useState, useEffect } from "react";
import {
  faBars,
  faXmark,
  faTerminal,
  faMessage,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const SharedLayout = ({ menuItems }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 726);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 726);
      if (window.innerWidth > 726) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === "j") {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen relative overflow-x-hidden">
      {isMobile && (
        <button
          onClick={toggleMobileMenu}
          className="md:hidden fixed top-4 right-4 z-[60] p-2 rounded-lg bg-gray-800 text-white"
          aria-label="Toggle Menu"
        >
          <FontAwesomeIcon
            icon={isMobileMenuOpen ? faXmark : faBars}
            className="text-xl"
          />
        </button>
      )}

      <div
        className={`
        fixed md:static
        w-[280px] md:w-[20%]
        h-screen
        z-[50]
        transform
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        ${!isMobile ? "translate-x-0" : ""}
        transition-transform duration-200
        bg-white dark:bg-gray-800
        border-r border-gray-200 dark:border-gray-700
      `}
      >
        <NavigationBar menuItems={menuItems} />
      </div>

      <main
        className={`
        flex-1
        min-h-screen w-full
        transition-[filter] duration-200
        ${isMobileMenuOpen && isMobile ? "blur-sm" : ""}
      `}
      >
        <div className="flex flex-col py-10 px-4 md:px-16 h-screen overflow-y-auto w-full">
          <Outlet />
        </div>
      </main>

      {isMobileMenuOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[45] transition-opacity duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="fixed bottom-4 right-4 z-50 flex space-x-4">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors duration-200 shadow-lg"
          aria-label="Toggle Chat"
        >
          <FontAwesomeIcon icon={faMessage} size="lg" />
        </button>

        <button
          onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors duration-200 shadow-lg"
          aria-label="Toggle Terminal"
        >
          <FontAwesomeIcon icon={faTerminal} size="lg" />
        </button>
      </div>

      <Terminal isOpen={isTerminalOpen} setIsOpen={setIsTerminalOpen} />
      <Chat isOpen={isChatOpen} />
    </div>
  );
};

export default SharedLayout;
