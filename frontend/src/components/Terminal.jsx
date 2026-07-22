import { useState } from "react";
import { faTerminal } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "../api";

const HELP_LINES = [
  "Available commands:",
  "  help                                        Show this help",
  "  clear                                       Clear the terminal",
  "  add <expense|income> <category> <amount> [description...]",
  "                                              Add a transaction",
];

const Terminal = ({ isOpen, setIsOpen }) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);

  const appendLines = (lines) =>
    setHistory((prev) => [...prev, ...(Array.isArray(lines) ? lines : [lines])]);

  const handleAdd = async (args) => {
    const [type, categoryName, amountArg, ...descParts] = args;

    if (!type || !categoryName || !amountArg) {
      appendLines("Usage: add <expense|income> <category> <amount> [description...]");
      return;
    }
    if (type !== "expense" && type !== "income") {
      appendLines(`Invalid type "${type}". Use expense or income.`);
      return;
    }
    const amount = Number(amountArg);
    if (!Number.isFinite(amount) || amount <= 0) {
      appendLines(`Invalid amount "${amountArg}".`);
      return;
    }

    try {
      const res = await api.get("/api/categories/");
      const category = res.data.find(
        (c) =>
          c.type === type &&
          c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (!category) {
        const available = res.data
          .filter((c) => c.type === type)
          .map((c) => c.name)
          .join(", ");
        appendLines([
          `Category "${categoryName}" not found for type ${type}.`,
          available ? `Available: ${available}` : "No categories exist yet.",
        ]);
        return;
      }

      const name = descParts.join(" ") || category.name;
      await api.post("/api/transactions/", {
        date: new Date().toISOString().slice(0, 10),
        amount: amount.toFixed(2),
        name,
        category: category.id,
        type,
      });
      appendLines(`Added ${type} "${name}": ${amount.toFixed(2)} (${category.name})`);
    } catch (error) {
      appendLines(
        `Error: ${error.response?.data?.error || "failed to add transaction."}`
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    const args = trimmedInput.split(/\s+/);
    const command = args.shift() || "";

    setInput("");
    if (!command) return;

    if (command === "help") {
      appendLines(HELP_LINES);
    } else if (command === "clear") {
      setHistory([]);
    } else if (command === "add") {
      handleAdd(args);
    } else {
      appendLines(`Command not found: ${trimmedInput}`);
    }
  };
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[32rem] h-80 bg-gray-900 text-gray-100 rounded-lg shadow-2xl overflow-hidden border border-gray-700">
          <div className="flex flex-col h-full">
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
              <span className="text-sm font-semibold text-gray-300">
                Terminal
              </span>
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm space-y-1 bg-gradient-to-b from-gray-900 to-gray-800">
              {history.map((line, index) => (
                <div key={index} className="text-gray-300">
                  {line}
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-gray-700 bg-gray-800 p-3 flex items-center space-x-2"
            >
              <span className="text-green-400 font-mono">❯</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent outline-none font-mono text-sm text-gray-300 placeholder-gray-500"
                placeholder="Type a command..."
                autoFocus
              />
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Terminal;
