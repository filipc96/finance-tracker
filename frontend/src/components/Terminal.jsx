import { useState } from "react";
import { faTerminal } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const Terminal = ({ isOpen, setIsOpen }) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const commands = new Map([
    ["help", () => setHistory([...history, "help"])],
    ["clear", () => setHistory([])],
    [
      "add",
      (args) =>
        setHistory([
          ...history,
          "add " +
            "Type: " +
            args[0] +
            " Category: " +
            args[1] +
            " Amount: " +
            args[2] +
            " RSD",
        ]),
    ],
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    let trimmedInput = input.trim();
    let args = trimmedInput.split(" ");
    let command = args.shift() || "";

    setInput("");

    if (commands.has(command)) {
      commands.get(command)(args || "");
    }
    // else if (input.trim().startsWith("add")) {
    //   const [_, ...args] = input.trim().split(" ");
    //   if (args.length == 0) {
    //     setHistory([...history, `Usage: add [task]`]);
    //   }
    //   if (args[0] == "expense") {
    //     setHistory([...history, `Adding expense ${args.join(" ")}`]);
    //   } else if (args[0] == "income") {
    //     setHistory([...history, `Adding income ${args.join(" ")}`]);
    //   }
    else {
      setHistory([...history, `Command not found: ${input}`]);
    }
  };
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors duration-200 shadow-lg"
        aria-label="Toggle Terminal"
      >
        <FontAwesomeIcon icon={faTerminal} size="lg" />
      </button>

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
