import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";
import Button from "../components/ui/Button";

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
      <div className={`text-lg font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
};

const Stocks = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsCredentials, setNeedsCredentials] = useState(false);

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
          toast.error(message || "Failed to load portfolio.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getPortfolio();
  }, []);

  if (needsCredentials) {
    return (
      <>
        <h2>Stocks</h2>
        <div className="py-6 max-w-xl">
          <p className="text-gray-600 dark:text-gray-300">
            No Trading 212 API credentials configured. Generate an API key in
            the Trading 212 app (Settings → API) and add it on the{" "}
            <Link to="/settings" className="text-blue-600 underline">
              Settings page
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h2>Stocks</h2>

      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => getPortfolio(true)}
            isLoading={loading}
          >
            Refresh
          </Button>
          {portfolio && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              as of {new Date(portfolio.fetched_at).toLocaleString()}
              {portfolio.stale ? " (cached)" : ""}
            </span>
          )}
        </div>

        {portfolio && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl">
              <SummaryCard
                label={`Total value ${portfolio.currency}`}
                value={portfolio.total_value}
              />
              <SummaryCard label="Cash" value={portfolio.cash} />
              <SummaryCard label="Invested" value={portfolio.invested} />
              <SummaryCard
                label="Unrealized P/L"
                value={portfolio.unrealized_pl}
                colored
              />
            </div>

            {portfolio.positions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No open positions.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Ticker</th>
                      <th className="py-3 pr-4 text-right">Qty</th>
                      <th className="py-3 pr-4 text-right">Avg price</th>
                      <th className="py-3 pr-4 text-right">Current</th>
                      <th className="py-3 pr-4 text-right">Value</th>
                      <th className="py-3 text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((p) => {
                      const pl = Number(p.unrealized_pl);
                      return (
                        <tr
                          key={p.ticker}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-3 pr-4 font-medium">{p.name}</td>
                          <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                            {p.ticker}
                          </td>
                          <td className="py-3 pr-4 text-right">{p.quantity}</td>
                          <td className="py-3 pr-4 text-right">
                            {p.average_price}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {p.current_price}
                          </td>
                          <td className="py-3 pr-4 text-right">{p.value}</td>
                          <td
                            className={`py-3 text-right ${
                              pl >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {p.unrealized_pl}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Stocks;
