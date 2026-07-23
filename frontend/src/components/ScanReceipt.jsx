import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import api from "../api";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";

const NEW_PREFIX = "new:";

const ScanReceipt = ({ callback }) => {
  const [categories, setCategories] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(null);

  // Review-form fields (populated from the scan draft, then editable).
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [suggested, setSuggested] = useState("");
  const [confidence, setConfidence] = useState(null);

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
    setDraft(null);
    setName("");
    setAmount("");
    setDate("");
    setCategory("");
    setSuggested("");
    setConfidence(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    setIsScanning(true);
    api
      .post("/api/receipts/scan/", formData)
      .then(({ data }) => {
        setName(data.name || "");
        setAmount(data.amount || "");
        setDate(data.date || format(new Date(), "yyyy-MM-dd"));
        setSuggested(data.suggested_category || "");
        setConfidence(data.confidence);
        // Preselect the matched category; else offer to create the suggestion.
        if (data.category) {
          setCategory(String(data.category));
        } else if (data.suggested_category) {
          setCategory(NEW_PREFIX + data.suggested_category);
        } else {
          setCategory("");
        }
        setDraft(data);
      })
      .catch((error) =>
        toast.error(
          error.response?.data?.error || "Couldn't read that receipt."
        )
      )
      .finally(() => {
        setIsScanning(false);
        if (fileInput.current) fileInput.current.value = "";
      });
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    if (!name || !amount || !date || !category) {
      toast.error("Fill in every field before saving.");
      return;
    }

    setIsSaving(true);
    try {
      let categoryId = category;
      if (category.startsWith(NEW_PREFIX)) {
        const newName = category.slice(NEW_PREFIX.length);
        const { data } = await api.post("/api/categories/", {
          name: newName,
          type: "expense",
        });
        categoryId = data.id;
        await loadCategories();
      }

      await api.post("/api/transactions/", {
        name,
        type: "expense",
        date,
        amount,
        category: categoryId,
      });
      toast.success("Expense added from receipt.");
      reset();
      if (callback) callback();
    } catch {
      toast.error("Failed to save the expense.");
    } finally {
      setIsSaving(false);
    }
  };

  const lowConfidence = confidence !== null && confidence < 0.6;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm w-full max-w-md h-auto p-6">
      <div className="flex flex-col gap-4">
        <h3>Scan Receipt</h3>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />

        {!draft && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Snap or upload a photo of a receipt. It's read on your machine and
              turned into an expense you can review before saving.
            </p>
            <Button
              type="button"
              variant="secondary"
              isLoading={isScanning}
              className="w-full"
              onClick={() => fileInput.current?.click()}
            >
              {isScanning ? "Reading receipt…" : "Choose receipt photo"}
            </Button>
          </>
        )}

        {draft && (
          <form onSubmit={saveExpense} className="flex flex-col gap-4">
            {lowConfidence && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Low confidence on this scan — double-check the amount and date.
              </p>
            )}

            <Input
              label="Description"
              type="text"
              placeholder="Merchant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select category</option>
              {suggested &&
                !expenseCategories.some(
                  (c) => c.name.toLowerCase() === suggested.toLowerCase()
                ) && (
                  <option value={NEW_PREFIX + suggested}>
                    + Create “{suggested}”
                  </option>
                )}
              {expenseCategories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={reset}
              >
                Discard
              </Button>
              <Button
                type="submit"
                variant="secondary"
                isLoading={isSaving}
                className="flex-1"
              >
                Save expense
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ScanReceipt;
