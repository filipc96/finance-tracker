import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../api";
import Button from "../components/ui/Button";
import { useTheme } from "../contexts/ThemeContext";
import { buildLineOptions } from "../utils/chartTheme";
import { formatMoney } from "../utils/formatCurrency";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const AccountCard = ({ account, selected, onSelect, onAction, onDelete, onUpdateRate }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [editingRate, setEditingRate] = useState(false);
  const [rate, setRate] = useState(account.apy_rate);

  const act = (type) => {
    if (!amount || Number(amount) <= 0) {
      toast.error(t("savings.enterPositive"));
      return;
    }
    onAction(account.id, type, amount);
    setAmount("");
  };

  return (
    <div
      onClick={() => onSelect(account.id)}
      className={`rounded-lg border p-4 flex flex-col gap-3 cursor-pointer transition-colors ${
        selected
          ? "border-blue-500 dark:border-blue-400"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{account.name}</span>
          {!account.active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {t("savings.inactive")}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(account.id);
          }}
          className="text-red-500 text-sm hover:text-red-600"
        >
          {t("common.delete")}
        </button>
      </div>

      <div className="text-2xl font-bold">{formatMoney(account.balance)}</div>

      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        {editingRate ? (
          <>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
            />
            <span>{t("savings.perYear")}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateRate(account.id, rate);
                setEditingRate(false);
              }}
              className="text-blue-600"
            >
              {t("common.save")}
            </button>
          </>
        ) : (
          <>
            <span>
              {account.apy_rate}
              {t("savings.perYear")}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingRate(true);
              }}
              className="text-blue-600"
            >
              {t("common.edit")}
            </button>
          </>
        )}
      </div>

      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder={t("savings.amount")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
        />
        <button
          onClick={() => act("deposit")}
          className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700"
        >
          {t("savings.deposit")}
        </button>
        <button
          onClick={() => act("withdraw")}
          className="px-3 py-1 rounded bg-gray-600 text-white text-sm hover:bg-gray-700"
        >
          {t("savings.withdraw")}
        </button>
      </div>
    </div>
  );
};

const Savings = () => {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ name: "", apy_rate: "", starting_balance: "" });

  const getAccounts = () => {
    api
      .get("/api/savings/")
      .then((res) => {
        setAccounts(res.data);
        if (res.data.length > 0 && !selectedId) {
          setSelectedId(res.data[0].id);
        }
      })
      .catch(() => toast.error(t("savings.loadFailed")));
  };

  const getHistory = (id) => {
    if (!id) return;
    api
      .get(`/api/savings/${id}/transactions/`)
      .then((res) => setHistory(res.data))
      .catch(() => toast.error(t("savings.historyLoadFailed")));
  };

  useEffect(() => {
    getAccounts();
  }, []);

  useEffect(() => {
    getHistory(selectedId);
  }, [selectedId, accounts]);

  const addAccount = (e) => {
    e.preventDefault();
    if (!form.name || form.apy_rate === "") {
      toast.error(t("savings.nameRateRequired"));
      return;
    }
    const payload = { name: form.name, apy_rate: form.apy_rate };
    if (form.starting_balance) payload.starting_balance = form.starting_balance;
    api
      .post("/api/savings/", payload)
      .then(() => {
        toast.success(t("savings.created"));
        setForm({ name: "", apy_rate: "", starting_balance: "" });
        getAccounts();
      })
      .catch((error) => {
        const data = error.response?.data;
        toast.error(
          data?.apy_rate?.[0] ||
            data?.starting_balance?.[0] ||
            t("savings.createFailed")
        );
      });
  };

  const doAction = (id, type, amount) => {
    api
      .post(`/api/savings/${id}/transactions/`, { type, amount })
      .then(() => {
        toast.success(
          type === "deposit" ? t("savings.deposited") : t("savings.withdrawn")
        );
        getAccounts();
      })
      .catch((error) =>
        toast.error(
          error.response?.data?.error ||
            (type === "deposit"
              ? t("savings.depositFailed")
              : t("savings.withdrawFailed"))
        )
      );
  };

  const updateRate = (id, apy_rate) => {
    api
      .patch(`/api/savings/${id}/`, { apy_rate })
      .then(() => {
        toast.success(t("savings.rateUpdated"));
        getAccounts();
      })
      .catch(() => toast.error(t("savings.rateUpdateFailed")));
  };

  const deleteAccount = (id) => {
    if (!window.confirm(t("savings.confirmDelete"))) return;
    api
      .delete(`/api/savings/${id}/`)
      .then(() => {
        toast.success(t("savings.accountDeleted"));
        if (selectedId === id) setSelectedId(null);
        getAccounts();
      })
      .catch(() => toast.error(t("savings.deleteFailed")));
  };

  const selected = accounts.find((a) => a.id === selectedId);
  const chartData = {
    labels: history.map((h) => h.date),
    datasets: [
      {
        label: selected
          ? `${selected.name} ${t("savings.balance")}`
          : t("savings.balance"),
        data: history.map((h) => h.balance_after),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const inputClass =
    "px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100";

  return (
    <>
      <h2>{t("savings.title")}</h2>

      <div className="flex flex-col gap-8 py-6">
        <form
          onSubmit={addAccount}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-w-3xl"
        >
          <div className="flex flex-col">
            <label className="text-sm mb-1 text-gray-600 dark:text-gray-300">
              {t("savings.name")}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`${inputClass} w-44`}
              placeholder={t("savings.namePlaceholder")}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1 text-gray-600 dark:text-gray-300">
              {t("savings.annualRate")}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.apy_rate}
              onChange={(e) => setForm({ ...form, apy_rate: e.target.value })}
              className={`${inputClass} w-24`}
              placeholder="4.50"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm mb-1 text-gray-600 dark:text-gray-300">
              {t("savings.startingBalance")}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.starting_balance}
              onChange={(e) =>
                setForm({ ...form, starting_balance: e.target.value })
              }
              className={`${inputClass} w-36`}
            />
          </div>
          <Button type="submit" variant="secondary">
            {t("savings.addAccount")}
          </Button>
        </form>

        {accounts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            {t("savings.noAccounts")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                selected={account.id === selectedId}
                onSelect={setSelectedId}
                onAction={doAction}
                onDelete={deleteAccount}
                onUpdateRate={updateRate}
              />
            ))}
          </div>
        )}

        {selected && history.length > 0 && (
          <div className="max-w-4xl w-full rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold mb-4">
              {t("savings.balanceOverTime", { name: selected.name })}
            </h3>
            <div className="relative h-72">
              <Line data={chartData} options={buildLineOptions(darkMode)} />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Savings;
