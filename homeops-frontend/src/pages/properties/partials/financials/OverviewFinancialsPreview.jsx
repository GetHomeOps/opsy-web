import React, {useMemo} from "react";
import {Line} from "react-chartjs-2";
import {Home, PiggyBank, CreditCard, Wallet} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import {StatusBadge} from "../passport/StatusBadge";
import FinancialKpiCard from "./FinancialKpiCard";
import {
  FINANCIALS_DEMO,
  formatCurrency,
  formatShortCurrency,
} from "./financialsDemoData";
import "../../../home/components/chartConfig";

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {mode: "index", intersect: false},
  plugins: {
    legend: {display: false},
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      grid: {display: false},
      ticks: {
        font: {size: 10},
        color: "#9ca3af",
        maxRotation: 0,
        maxTicksLimit: 6,
      },
    },
    y: {
      grid: {color: "rgba(0,0,0,0.06)"},
      ticks: {
        font: {size: 10},
        color: "#9ca3af",
        maxTicksLimit: 4,
        callback: (v) => formatShortCurrency(v),
      },
    },
  },
};

function buildLineChart(labels, label, data, borderColor, backgroundColor) {
  return {
    labels,
    datasets: [
      {
        label,
        data,
        borderColor,
        backgroundColor,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };
}

function FinancialPreviewCard({title, icon: Icon, kpi, chartData}) {
  return (
    <SectionCard flat title={title} icon={Icon} className="min-w-0">
      <div className="relative overflow-hidden rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 bg-neutral-50/80 dark:bg-neutral-800/40 min-h-[14rem]">
        <div
          className="px-3 py-3 blur-[2px] saturate-[0.85] opacity-90 pointer-events-none select-none [mask-image:linear-gradient(to_bottom,#000_0%,#000_72%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_72%,transparent_100%)]"
          aria-hidden="true"
        >
          <FinancialKpiCard
            icon={kpi.icon}
            label={kpi.label}
            value={kpi.value}
            change={kpi.change}
            changeTone={kpi.changeTone}
            sparkline={kpi.sparkline}
            suffix={kpi.suffix}
            className="border-0 bg-transparent px-0 py-0 rounded-none shadow-none"
          />
          <div className="h-28 mt-2 px-1">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        <div
          className="absolute inset-0 z-10 flex items-center justify-center px-3 bg-white/55 dark:bg-neutral-950/60"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-3 text-center shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06] dark:ring-white/10">
            <StatusBadge tone="neutral" className="mb-1.5">
              Coming Soon
            </StatusBadge>
            <p className="text-xs font-semibold text-neutral-900 dark:text-white">
              {kpi.comingSoonTitle}
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * Coming Soon financial preview shown on the Overview tab. Three independent
 * cards for value, equity, and payments — each with a KPI and trend chart.
 */
function OverviewFinancialsPreview() {
  const data = FINANCIALS_DEMO;

  const valueChart = useMemo(
    () =>
      buildLineChart(
        data.trendLabels,
        "Estimated Value",
        data.valueTrend,
        "#456564",
        "rgba(69, 101, 100, 0.12)",
      ),
    [data.trendLabels, data.valueTrend],
  );

  const equityChart = useMemo(
    () =>
      buildLineChart(
        data.trendLabels,
        "Estimated Equity",
        data.equityTrend,
        "#10b981",
        "rgba(16, 185, 129, 0.10)",
      ),
    [data.trendLabels, data.equityTrend],
  );

  const paymentChart = useMemo(
    () =>
      buildLineChart(
        data.trendLabels,
        "Monthly Payment",
        data.paymentTrend,
        "#5a8a88",
        "rgba(90, 138, 136, 0.12)",
      ),
    [data.trendLabels, data.paymentTrend],
  );

  const cards = [
    {
      title: "Property Value",
      icon: Home,
      chartData: valueChart,
      kpi: {
        icon: Home,
        label: "Estimated Property Value",
        value: formatCurrency(data.propertyValue),
        change: "+ 5.2% vs last year",
        changeTone: "positive",
        sparkline: [1095, 1102, 1110, 1125, 1140, 1155, 1162, 1170, 1180],
        comingSoonTitle: "Live value tracking coming soon",
      },
    },
    {
      title: "Equity",
      icon: PiggyBank,
      chartData: equityChart,
      kpi: {
        icon: PiggyBank,
        label: "Estimated Equity",
        value: formatCurrency(data.equity),
        change: "+ 8.3% vs last year",
        changeTone: "positive",
        sparkline: [415, 430, 445, 460, 478, 495, 510, 525, 537],
        comingSoonTitle: "Live equity tracking coming soon",
      },
    },
    {
      title: "Payments",
      icon: CreditCard,
      chartData: paymentChart,
      kpi: {
        icon: CreditCard,
        label: "Monthly Payment",
        value: formatCurrency(data.monthlyPayment),
        suffix: "/mo",
        change: "No change vs last month",
        changeTone: "neutral",
        sparkline: [4167, 4167, 4167, 4167, 4167, 4167, 4167, 4167, 4167],
        comingSoonTitle: "Live payment tracking coming soon",
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-0.5">
        <Wallet className="w-4 h-4 shrink-0 text-neutral-400 dark:text-neutral-500 mt-0.5" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Financial Overview
            </h3>
            <StatusBadge tone="neutral">Coming Soon</StatusBadge>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Track your property&apos;s value, equity, and payments — coming soon.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <FinancialPreviewCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}

export default OverviewFinancialsPreview;
