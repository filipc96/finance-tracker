import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import DataTable from "../components/ui/DataTable";
import { formatAmount } from "../utils/formatCurrency";

const buildPositionColumns = (t) => [
  { key: "name", header: t("stocks.colName"), sortable: true, cellClassName: "font-medium" },
  {
    key: "ticker",
    header: t("stocks.colTicker"),
    sortable: true,
    cellClassName: "text-gray-500 dark:text-gray-400",
  },
  {
    key: "quantity",
    header: t("stocks.colQty"),
    align: "right",
    sortable: true,
    sortType: "number",
  },
  {
    key: "average_price",
    header: t("stocks.colAvgPrice"),
    align: "right",
    sortable: true,
    sortType: "number",
    render: (p) => formatAmount(p.average_price),
  },
  {
    key: "current_price",
    header: t("stocks.colCurrent"),
    align: "right",
    sortable: true,
    sortType: "number",
    render: (p) => formatAmount(p.current_price),
  },
  {
    key: "value",
    header: t("stocks.colValue"),
    align: "right",
    sortable: true,
    sortType: "number",
    render: (p) => formatAmount(p.value),
  },
  {
    key: "unrealized_pl",
    header: t("stocks.colPl"),
    align: "right",
    sortable: true,
    sortType: "number",
    render: (p) => (
      <span
        className={
          Number(p.unrealized_pl) >= 0
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        }
      >
        {formatAmount(p.unrealized_pl)}
      </span>
    ),
  },
];

const SummaryCard = ({ label, value, colored }) => {
  const number = Number(value);
  const colorClass = !colored
    ? ""
    : number >= 0
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-lg font-semibold ${colorClass}`}>
        {formatAmount(value)}
      </div>
    </div>
  );
};

const Stocks = () => {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsCredentials, setNeedsCredentials] = useState(false);
  const [search, setSearch] = useState("");
  const positionColumns = buildPositionColumns(t);

  const getPortfolio = (refresh = false) => {
    setLoading(true);
    api
      .get(`/api/stocks/portfolio/${refresh ? "?refresh=1" : ""}`)
      .then((res) => {
        setPortfolio(res.data);
        setNeedsCredentials(false);
        if (res.data.warning) toast(res.data.warning, { icon: "⚠️" });
      })
      .catch((error) => {
        const message = error.response?.data?.error;
        if (
          error.response?.status === 400 &&
          message?.includes("credentials configured")
        ) {
          setNeedsCredentials(true);
        } else {
          toast.error(message || t("stocks.loadFailed"));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getPortfolio();
  }, []);

  // Filter positions by name or ticker; the table sorts what remains.
  const visiblePositions = useMemo(() => {
    const rows = portfolio?.positions || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.ticker.toLowerCase().includes(q)
    );
  }, [portfolio, search]);

  if (needsCredentials) {
    return (
      <>
        <h2>{t("stocks.title")}</h2>
        <div className="py-6 max-w-xl">
          <p className="text-gray-600 dark:text-gray-300">
            {t("stocks.needCredentials")}
            <Link to="/settings" className="text-blue-600 underline">
              {t("stocks.settingsPage")}
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h2>{t("stocks.title")}</h2>

      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => getPortfolio(true)}
            isLoading={loading}
          >
            {t("stocks.refresh")}
          </Button>
          {portfolio && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("stocks.asOf", {
                time: new Date(portfolio.fetched_at).toLocaleString(),
              })}
              {portfolio.stale ? t("stocks.cached") : ""}
            </span>
          )}
        </div>

        {portfolio && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl">
              <SummaryCard
                label={t("stocks.totalValue", { currency: portfolio.currency })}
                value={portfolio.total_value}
              />
              <SummaryCard label={t("stocks.cash")} value={portfolio.cash} />
              <SummaryCard
                label={t("stocks.invested")}
                value={portfolio.invested}
              />
              <SummaryCard
                label={t("stocks.unrealizedPl")}
                value={portfolio.unrealized_pl}
                colored
              />
            </div>

            {portfolio.positions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                {t("stocks.noOpenPositions")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Input
                  placeholder={t("stocks.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
                <DataTable
                  columns={positionColumns}
                  rows={visiblePositions}
                  getRowKey={(p) => p.ticker}
                  emptyMessage={t("stocks.noPositionsMatch")}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Stocks;
