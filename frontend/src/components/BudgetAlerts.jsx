import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "../api";
import Card from "./ui/Card";
import { formatMoney } from "../utils/formatCurrency";

// Compact current-month budget status for the dashboard. Surfaces categories
// that are near (>=75%) or over their limit so the user sees trouble without
// visiting the Budgets page. The full bars/editing live on /budgets.
const NEAR_THRESHOLD = 75;

const BudgetAlerts = () => {
  const [budgets, setBudgets] = useState(null);

  useEffect(() => {
    api
      .get("/api/budgets/")
      .then((res) => setBudgets(res.data))
      .catch(() => setBudgets([]));
  }, []);

  // Nothing to say until we know there are budgets to report on.
  if (!budgets || budgets.length === 0) return null;

  const rows = budgets
    .map((b) => {
      const spent = Number(b.spent);
      const limit = Number(b.amount);
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      return { ...b, spent, limit, percent };
    })
    .filter((b) => b.percent >= NEAR_THRESHOLD)
    .sort((a, b) => b.percent - a.percent);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">Budget alerts</span>
        <Link
          to="/budgets"
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Manage
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          All budgets on track this month.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((b) => {
            const over = b.percent >= 100;
            const barColor = over ? "bg-red-500" : "bg-yellow-500";
            return (
              <div key={b.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-1.5">
                    {over && (
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        className="text-red-500"
                      />
                    )}
                    {b.category_name}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {formatMoney(b.spent)} / {formatMoney(b.limit)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.min(b.percent, 100)}%` }}
                  />
                </div>
                <div
                  className={`text-xs ${
                    over
                      ? "text-red-500"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {b.percent}% used{over ? " — over budget!" : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default BudgetAlerts;
