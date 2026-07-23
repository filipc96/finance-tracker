import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import api from "../api";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";

const NEW_PREFIX = "new:";

const ScanReceipt = ({ callback, className = "max-w-md" }) => {
  const [categories, setCategories] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanDone, setScanDone] = useState(0);
  // One editable draft per scanned photo.
  const [drafts, setDrafts] = useState([]);

  const fileInput = useRef(null);

  const loadCategories = () =>
    api
      .get("/api/categories/")
      .then((response) => setCategories(response.data))
      .catch(() => toast.error("Failed to load categories."));

  useEffect(() => {
    loadCategories();
  }, []);

  const expenseCategories = categories.filter((c) => c.type === "expense");

  const reset = () => {
    setDrafts([]);
    setScanTotal(0);
    setScanDone(0);
    if (fileInput.current) fileInput.current.value = "";
  };

  const updateDraft = (key, patch) =>
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d))
    );

  const removeDraft = (key) =>
    setDrafts((prev) => prev.filter((d) => d.key !== key));

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileInput.current) fileInput.current.value = "";
    if (files.length === 0) return;

    setScanTotal(files.length);
    setScanDone(0);
    setIsScanning(true);

    // Sequential: the OCR engine is a shared singleton and the LLM has rate
    // limits, so one photo at a time. Drafts appear as each finishes.
    for (const file of files) {
      const formData = new FormData();
      formData.append("image", file);
      try {
        const { data } = await api.post("/api/receipts/scan/", formData);
        setDrafts((prev) => [
          ...prev,
          {
            key: crypto.randomUUID(),
            fileName: file.name,
            name: data.name || "",
            amount: data.amount || "",
            date: data.date || format(new Date(), "yyyy-MM-dd"),
            suggested: data.suggested_category || "",
            confidence: data.confidence,
            category: data.category
              ? String(data.category)
              : data.suggested_category
              ? NEW_PREFIX + data.suggested_category
              : "",
          },
        ]);
      } catch (error) {
        toast.error(
          `${file.name}: ${
            error.response?.data?.error || "couldn't read that receipt."
          }`
        );
      } finally {
        setScanDone((n) => n + 1);
      }
    }

    setIsScanning(false);
  };

  const saveAll = async () => {
    if (drafts.length === 0) return;
    for (const d of drafts) {
      if (!d.name || !d.amount || !d.date || !d.category) {
        toast.error("Fill in every field on each receipt before saving.");
        return;
      }
    }

    setIsSaving(true);
    // Two receipts can suggest the same new category — create it once.
    const categoryCache = {};
    const savedKeys = [];
    try {
      for (const d of drafts) {
        let categoryId = d.category;
        if (String(d.category).startsWith(NEW_PREFIX)) {
          const newName = d.category.slice(NEW_PREFIX.length);
          const cacheKey = newName.toLowerCase();
          if (categoryCache[cacheKey]) {
            categoryId = categoryCache[cacheKey];
          } else {
            const { data } = await api.post("/api/categories/", {
              name: newName,
              type: "expense",
            });
            categoryId = data.id;
            categoryCache[cacheKey] = data.id;
          }
        }

        await api.post("/api/transactions/", {
          name: d.name,
          type: "expense",
          date: d.date,
          amount: d.amount,
          category: categoryId,
        });
        savedKeys.push(d.key);
      }

      toast.success(
        `Added ${savedKeys.length} expense${
          savedKeys.length === 1 ? "" : "s"
        } from receipts.`
      );
      reset();
      if (callback) callback();
    } catch {
      // Drop the ones that made it so a retry only reprocesses the rest.
      setDrafts((prev) => prev.filter((d) => !savedKeys.includes(d.key)));
      await loadCategories();
      if (savedKeys.length && callback) callback();
      toast.error("Some receipts couldn't be saved. Review the rest and retry.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasDrafts = drafts.length > 0;
  const progressLabel = isScanning
    ? `Reading receipt ${Math.min(scanDone + 1, scanTotal)} of ${scanTotal}…`
    : "";

  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm w-full h-auto p-6 ${className}`}
    >
      <div className="flex flex-col gap-4">
        <h3>Scan Receipts</h3>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />

        {!hasDrafts && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Upload one or several receipt photos. Each is read on your machine
              and turned into an expense you can review before saving.
            </p>
            <Button
              type="button"
              variant="secondary"
              isLoading={isScanning}
              className="w-full"
              onClick={() => fileInput.current?.click()}
            >
              {isScanning ? progressLabel : "Choose receipt photos"}
            </Button>
          </>
        )}

        {hasDrafts && (
          <div className="flex flex-col gap-4">
            {isScanning && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {progressLabel}
              </p>
            )}

            {drafts.map((d) => {
              const lowConfidence =
                d.confidence !== null &&
                d.confidence !== undefined &&
                d.confidence < 0.6;
              const showCreate =
                d.suggested &&
                !expenseCategories.some(
                  (c) => c.name.toLowerCase() === d.suggested.toLowerCase()
                );
              return (
                <div
                  key={d.key}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-400 dark:text-gray-500">
                      {d.fileName}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-gray-400 hover:text-red-500"
                      onClick={() => removeDraft(d.key)}
                    >
                      Remove
                    </button>
                  </div>

                  {lowConfidence && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      Low confidence — double-check the amount and date.
                    </p>
                  )}

                  <Input
                    label="Description"
                    type="text"
                    placeholder="Merchant"
                    value={d.name}
                    onChange={(e) => updateDraft(d.key, { name: e.target.value })}
                    required
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={d.amount}
                      onChange={(e) =>
                        updateDraft(d.key, { amount: e.target.value })
                      }
                      required
                    />
                    <Input
                      label="Date"
                      type="date"
                      value={d.date}
                      onChange={(e) =>
                        updateDraft(d.key, { date: e.target.value })
                      }
                      required
                    />
                  </div>

                  <Select
                    label="Category"
                    value={d.category}
                    onChange={(e) =>
                      updateDraft(d.key, { category: e.target.value })
                    }
                  >
                    <option value="">Select category</option>
                    {showCreate && (
                      <option value={NEW_PREFIX + d.suggested}>
                        + Create “{d.suggested}”
                      </option>
                    )}
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}

            <button
              type="button"
              className="self-start text-sm text-primary-600 hover:underline disabled:opacity-50"
              onClick={() => fileInput.current?.click()}
              disabled={isScanning || isSaving}
            >
              + Add more photos
            </button>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={reset}
                disabled={isSaving}
              >
                Discard all
              </Button>
              <Button
                type="button"
                variant="secondary"
                isLoading={isSaving}
                className="flex-1"
                onClick={saveAll}
              >
                {`Save ${drafts.length} expense${
                  drafts.length === 1 ? "" : "s"
                }`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanReceipt;
