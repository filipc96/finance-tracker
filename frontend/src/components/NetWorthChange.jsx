import { Bar } from "react-chartjs-2";
import {
  faWallet,
  faPiggyBank,
  faChartLine,
  faScaleBalanced,
} from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { buildLineOptions, CHART_COLORS, withAlpha } from "../utils/chartTheme";
import { formatWhole } from "../utils/formatCurrency";
import StatCard from "./StatCard";
import ChartHeader from "./ui/ChartHeader";

// How much net worth rose (or fell) over the selected period, split into the
// three sources the user tracks: cash balance, savings, and stocks. `change`
// is the `net_worth_change` object from /api/analytics/period-summary/.
const NetWorthChange = ({ change, periodLabel }) => {
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();

  if (!change || !change.available) {
    return (
      <>
        <ChartHeader title="Net worth change" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No snapshots yet — net worth change accrues from your first app load
          each day.
        </p>
      </>
    );
  }

  // Signed money label with an explicit "+" on gains so a rise reads clearly.
  const signed = (v) => {
    const n = Number(v) || 0;
    const money = formatWhole(Math.abs(n), displayCurrency, displayRate);
    return n < 0 ? `−${money}` : `+${money}`;
  };
  const tone = (v) => (Number(v) >= 0 ? "positive" : "negative");

  const subtext = change.since_first_record
    ? "since first record"
    : periodLabel;

  const data = {
    labels: ["Balance", "Savings", "Stocks"],
    datasets: [
      {
        label: "Change",
        data: [change.balance, change.savings, change.stocks],
        backgroundColor: [
          withAlpha(CHART_COLORS.balance, 0.85),
          withAlpha(CHART_COLORS.savings, 0.85),
          withAlpha(CHART_COLORS.stocks, 0.85),
        ],
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  const options = buildLineOptions(darkMode, {
    currency: displayCurrency,
    rate: displayRate,
    plugins: { legend: { display: false } },
  });

  return (
    <>
      <ChartHeader
        title="Net worth change"
        subtitle={`How much your net worth moved ${subtext}.`}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={faScaleBalanced}
          label="Total change"
          value={signed(change.total)}
          subtext={subtext}
          tone={tone(change.total)}
        />
        <StatCard
          icon={faWallet}
          label="Balance"
          value={signed(change.balance)}
          subtext={subtext}
          tone={tone(change.balance)}
        />
        <StatCard
          icon={faPiggyBank}
          label="Savings"
          value={signed(change.savings)}
          subtext={subtext}
          tone={tone(change.savings)}
        />
        <StatCard
          icon={faChartLine}
          label="Stocks"
          value={signed(change.stocks)}
          subtext={subtext}
          tone={tone(change.stocks)}
        />
      </div>
      <div className="relative mt-6 h-64">
        <Bar data={data} options={options} />
      </div>
    </>
  );
};

export default NetWorthChange;
