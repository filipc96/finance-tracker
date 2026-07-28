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
import { useTranslation } from "react-i18next";

// How much net worth rose (or fell) over the selected period, split into the
// three sources the user tracks: cash balance, savings, and stocks. `change`
// is the `net_worth_change` object from /api/analytics/period-summary/.
const NetWorthChange = ({ change, periodLabel }) => {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const { displayCurrency, displayRate } = useCurrency();

  if (!change || !change.available) {
    return (
      <>
        <ChartHeader title={t("netWorthChange.title")} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("netWorthChange.noSnapshots")}
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
    ? t("netWorthChange.sinceFirstRecord")
    : periodLabel;

  const data = {
    labels: [
      t("netWorthChange.balance"),
      t("netWorthChange.savings"),
      t("netWorthChange.stocks"),
    ],
    datasets: [
      {
        label: t("netWorthChange.change"),
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
        title={t("netWorthChange.title")}
        subtitle={t("netWorthChange.subtitle", { period: subtext })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={faScaleBalanced}
          label={t("netWorthChange.totalChange")}
          value={signed(change.total)}
          subtext={subtext}
          tone={tone(change.total)}
        />
        <StatCard
          icon={faWallet}
          label={t("netWorthChange.balance")}
          value={signed(change.balance)}
          subtext={subtext}
          tone={tone(change.balance)}
        />
        <StatCard
          icon={faPiggyBank}
          label={t("netWorthChange.savings")}
          value={signed(change.savings)}
          subtext={subtext}
          tone={tone(change.savings)}
        />
        <StatCard
          icon={faChartLine}
          label={t("netWorthChange.stocks")}
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
