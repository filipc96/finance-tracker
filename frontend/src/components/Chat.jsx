import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Tailwind element styles for the LLM's markdown, sized for the compact dark
// chat bubble. No @tailwindcss/typography plugin is installed, so each element
// is mapped explicitly. Links open externally; the strict Tauri CSP is fine
// because react-markdown renders to DOM nodes, not injected HTML strings.
const markdownComponents = {
  p: (props) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  ul: (props) => (
    <ul className="mb-2 last:mb-0 list-disc pl-5 space-y-1" {...props} />
  ),
  ol: (props) => (
    <ol className="mb-2 last:mb-0 list-decimal pl-5 space-y-1" {...props} />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  h1: (props) => <h1 className="mb-2 text-base font-semibold" {...props} />,
  h2: (props) => <h2 className="mb-2 text-base font-semibold" {...props} />,
  h3: (props) => <h3 className="mb-1 text-sm font-semibold" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => (
    <a
      className="text-blue-300 underline hover:text-blue-200"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: ({ inline, ...props }) =>
    inline ? (
      <code
        className="rounded bg-gray-800 px-1 py-0.5 text-[0.85em] font-mono"
        {...props}
      />
    ) : (
      <code className="font-mono text-[0.85em]" {...props} />
    ),
  pre: (props) => (
    <pre
      className="mb-2 last:mb-0 overflow-x-auto rounded bg-gray-800 p-2 text-[0.85em]"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="mb-2 last:mb-0 border-l-2 border-gray-500 pl-3 italic text-gray-300"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mb-2 last:mb-0 overflow-x-auto">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border border-gray-600 px-2 py-1 font-semibold" {...props} />
  ),
  td: (props) => (
    <td className="border border-gray-600 px-2 py-1" {...props} />
  ),
  hr: () => <hr className="my-2 border-gray-600" />,
};

const Chat = ({ isOpen }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: t("chatWidget.greeting"),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [providersLoaded, setProvidersLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || providersLoaded) return;
    api
      .get("/api/chat/providers/")
      .then((res) => {
        setProviders(res.data.providers);
        const active = res.data.active;
        const activeInfo = res.data.providers.find(
          (p) => p.name === active.provider
        );
        setProvider(active.provider);
        setModel(active.model || activeInfo?.default_model || "");
        setProvidersLoaded(true);
      })
      .catch(() => {});
  }, [isOpen, providersLoaded]);

  const currentProvider = providers.find((p) => p.name === provider);

  const persistSelection = (nextProvider, nextModel) => {
    api
      .post("/api/settings/", {
        llm_provider: nextProvider,
        llm_model: nextModel || "",
      })
      .catch(() => {});
  };

  const handleProviderChange = (e) => {
    const name = e.target.value;
    const info = providers.find((p) => p.name === name);
    const nextModel = info?.default_model || info?.models?.[0] || "";
    setProvider(name);
    setModel(nextModel);
    persistSelection(name, nextModel);
  };

  const handleModelChange = (e) => {
    setModel(e.target.value);
    persistSelection(provider, e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const payload = { message: input };
      if (provider) payload.provider = provider;
      if (model) payload.model = model;
      const response = await api.post("/api/chat/", payload);
      const assistantMessage = {
        role: "assistant",
        content: response.data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorText =
        error.response?.data?.error || t("chatWidget.errorGeneric");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorText },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-16 right-4 md:right-32 w-[min(400px,calc(100vw-2rem))] h-[500px] bg-gray-900 text-gray-100 rounded-lg shadow-2xl overflow-hidden border border-gray-700">
      <div className="flex flex-col h-full">
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-700">
          <span className="text-sm font-semibold text-gray-300 whitespace-nowrap">
            {t("chatWidget.assistant")}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <select
              value={provider}
              onChange={handleProviderChange}
              className="bg-gray-700 text-gray-200 text-xs rounded-md px-2 py-1 max-w-[110px] focus:outline-none focus:ring-1 focus:ring-blue-500"
              title={t("chatWidget.provider")}
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.configured}>
                  {p.label}
                  {!p.configured ? t("chatWidget.noKey") : ""}
                </option>
              ))}
            </select>
            {currentProvider?.models?.length > 0 ? (
              <select
                value={model}
                onChange={handleModelChange}
                className="bg-gray-700 text-gray-200 text-xs rounded-md px-2 py-1 max-w-[130px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                title={t("chatWidget.model")}
              >
                {!currentProvider.models.includes(model) && model && (
                  <option value={model}>{model}</option>
                )}
                {currentProvider.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={handleModelChange}
                placeholder={t("chatWidget.modelPlaceholder")}
                className="bg-gray-700 text-gray-200 text-xs rounded-md px-2 py-1 w-[110px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                title={currentProvider?.error || t("chatWidget.modelName")}
              />
            )}
          </div>
        </div>

        {currentProvider?.error && (
          <div className="bg-yellow-900/40 text-yellow-200 text-xs px-4 py-1.5 border-b border-gray-700">
            {currentProvider.error}
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-gray-900 to-gray-800">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 break-words ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100"
                }`}
              >
                {message.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 text-gray-100 rounded-lg px-4 py-2">
                <span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-700 bg-gray-800 p-4 flex items-center space-x-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-gray-700 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t("chatWidget.inputPlaceholder")}
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white rounded-lg p-2 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
