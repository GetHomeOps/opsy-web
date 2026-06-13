import React, {useMemo} from "react";
import {Line} from "react-chartjs-2";
import {
  Home,
  Banknote,
  PiggyBank,
  CreditCard,
  Landmark,
  BarChart3,
  TrendingUp,
  Calendar,
  FileText,
  ChevronRight,
  Download,
  MoreHorizontal,
  Lightbulb,
  RefreshCw,
  Shield,
  CircleDollarSign,
} from "lucide-react";
import SectionCard from "./partials/passport/SectionCard";
import LabelValue from "./partials/passport/LabelValue";
import {StatusBadge} from "./partials/passport/StatusBadge";
import FinancialKpiCard from "./partials/financials/FinancialKpiCard";
import PaymentDonutChart from "./partials/financials/PaymentDonutChart";
import "../home/components/chartConfig";

const DEMO = {
  propertyValue: 1180000,
  mortgageBalance: 642500,
  equity: 537500,
  monthlyPayment: 4167,
  ltv: 54,
  lastUpdated: "Apr 15, 2026",
  source: "Public Records & Market Estimates",
  lender: "Chase Home Lending",
  loanType: "30-year fixed",
  interestRate: "5.25%",
  originationDate: "May 2021",
  maturity: "May 2051",
  escrow: true,
  paymentBreakdown: [
    {id: "pi", label: "Principal & Interest", amount: 2426, pct: 58},
    {id: "tax", label: "Property Taxes", amount: 842, pct: 20},
    {id: "ins", label: "Homeowners Insurance", amount: 416, pct: 10},
    {id: "hoa", label: "HOA Dues", amount: 483, pct: 12},
  ],
  valueTrend: [
    {label: "May '25", value: 1095000},
    {label: "Jun", value: 1102000},
    {label: "Jul", value: 1110000},
    {label: "Aug", value: 1118000},
    {label: "Sep", value: 1125000},
    {label: "Oct", value: 1132000},
    {label: "Nov", value: 1140000},
    {label: "Dec", value: 1148000},
    {label: "Jan '26", value: 1155000},
    {label: "Feb", value: 1162000},
    {label: "Mar", value: 1170000},
    {label: "Apr", value: 1180000},
  ],
  obligations: [
    {
      id: "mortgage",
      label: "Mortgage Payment",
      date: "May 1, 2026",
      amount: 4167,
      status: "Upcoming",
      tone: "brand",
    },
    {
      id: "tax",
      label: "Property Taxes",
      date: "Jun 30, 2026",
      amount: 4892,
      status: "Due Soon",
      tone: "amber",
    },
    {
      id: "ins",
      label: "Homeowners Insurance",
      date: "Aug 12, 2026",
      amount: 1248,
      status: "Upcoming",
      tone: "brand",
    },
    {
      id: "hoa",
      label: "HOA Dues",
      date: "May 1, 2026",
      amount: 483,
      status: "Upcoming",
      tone: "brand",
    },
  ],
  linkedRecords: [
    {id: "stmt", label: "Mortgage Statement", detail: "Apr 2026", type: "pdf"},
    {id: "tax", label: "Property Tax Bill", detail: "2026", type: "pdf"},
    {
      id: "ins",
      label: "Insurance Declaration",
      detail: "Apr 2026 – Apr 2027",
      type: "doc",
    },
    {id: "settle", label: "Settlement Statement", detail: "May 2021", type: "pdf"},
  ],
  ownership: {
    status: "Owner-Occupied",
    occupancy: "Primary Residence",
    lender: "Chase Home Lending",
    mortgageStatus: "Current",
    refinanceOpportunity: "Good",
  },
  insights: [
    {icon: CircleDollarSign, text: "You have 46% equity in your home"},
    {icon: Shield, text: "Mortgage payments are current"},
    {icon: Calendar, text: "Property taxes due in 51 days"},
    {icon: Lightbulb, text: "Refinance could save ~$312/mo at today's rates"},
  ],
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortCurrency(value) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return formatCurrency(value);
}

/**
 * Financials tab — mortgage, equity, and payment dashboard.
 * Uses illustrative data until live mortgage integrations are available.
 */
function FinancialsTab({propertyData = {}, onNavigateTab}) {
  const data = DEMO;

  const chartData = useMemo(
    () => ({
      labels: data.valueTrend.map((d) => d.label),
      datasets: [
        {
          label: "Property Value",
          data: data.valueTrend.map((d) => d.value),
          borderColor: "#456564",
          backgroundColor: "rgba(69, 101, 100, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    }),
    [data.valueTrend],
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {display: false},
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.y),
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
          },
        },
        y: {
          grid: {color: "rgba(0,0,0,0.04)"},
          ticks: {
            font: {size: 10},
            color: "#9ca3af",
            callback: (v) => formatShortCurrency(v),
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="relative">
      <div
        className="opacity-55 saturate-50 pointer-events-none select-none"
        aria-hidden="true"
      >
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_17.5rem] gap-4">
      <div className="space-y-4 min-w-0">
        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <FinancialKpiCard
            icon={Home}
            label="Estimated Property Value"
            value={formatCurrency(data.propertyValue)}
            change="+ 5.2% vs last year"
            changeTone="positive"
            sparkline={[1095, 1102, 1110, 1125, 1140, 1155, 1162, 1170, 1180]}
          />
          <FinancialKpiCard
            icon={Banknote}
            label="Remaining Mortgage Balance"
            value={formatCurrency(data.mortgageBalance)}
            change="− 3.1% vs last year"
            changeTone="positive"
            sparkline={[680, 672, 665, 658, 652, 648, 645, 643, 642]}
          />
          <FinancialKpiCard
            icon={PiggyBank}
            label="Estimated Equity"
            value={formatCurrency(data.equity)}
            change="+ 8.3% vs last year"
            changeTone="positive"
            sparkline={[415, 430, 445, 460, 478, 495, 510, 525, 537]}
          />
          <FinancialKpiCard
            icon={CreditCard}
            label="Monthly Payment"
            value={formatCurrency(data.monthlyPayment)}
            suffix="/mo"
            change="No change vs last month"
            changeTone="neutral"
            sparkline={[4167, 4167, 4167, 4167, 4167, 4167, 4167, 4167, 4167]}
          />
        </div>

        {/* Detail row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <SectionCard flat title="Property Financial Snapshot" icon={BarChart3}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <LabelValue
                label="Property Value"
                value={formatCurrency(data.propertyValue)}
              />
              <LabelValue
                label="Loan Balance"
                value={formatCurrency(data.mortgageBalance)}
              />
              <LabelValue
                label="Estimated Equity"
                value={formatCurrency(data.equity)}
                className="[&>div:last-child]:text-emerald-600 [&>div:last-child]:dark:text-emerald-400 [&>div:last-child]:font-bold"
              />
              <LabelValue label="LTV" value={`${data.ltv}%`} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span>Last Updated: {data.lastUpdated}</span>
              <span>Source: {data.source}</span>
            </div>
          </SectionCard>

          <SectionCard flat title="Mortgage & Lender" icon={Landmark}>
            <div className="space-y-2.5">
              <LabelValue label="Lender" value={data.lender} />
              <LabelValue label="Loan Type" value={data.loanType} />
              <LabelValue label="Interest Rate" value={data.interestRate} />
              <LabelValue label="Origination Date" value={data.originationDate} />
              <LabelValue label="Maturity" value={data.maturity} />
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Escrow
                </span>
                <StatusBadge tone="emerald">Enabled</StatusBadge>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            flat
            title="Monthly Payment Breakdown"
            icon={CreditCard}
            bodyClassName="!pb-3"
          >
            <div className="flex items-center gap-4">
              <PaymentDonutChart
                segments={data.paymentBreakdown.map((item) => ({
                  id: item.id,
                  value: item.amount,
                }))}
                total={formatCurrency(data.monthlyPayment)}
              />
              <ul className="flex-1 min-w-0 space-y-2">
                {data.paymentBreakdown.map((item, i) => (
                  <li key={item.id} className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          ["#456564", "#5a8a88", "#7fa3a1", "#a8c4c2"][i],
                      }}
                    />
                    <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate flex-1">
                      {item.label}
                    </span>
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white tabular-nums shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-[10px] text-neutral-400 shrink-0 w-7 text-right">
                      {item.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <SectionCard
            flat
            title="Home Value Trend"
            icon={TrendingUp}
            className="lg:col-span-1"
          >
            <div className="h-44">
              <Line data={chartData} options={chartOptions} />
            </div>
          </SectionCard>

          <SectionCard flat title="Upcoming Financial Obligations" icon={Calendar}>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.obligations.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {item.label}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {item.date}
                    </p>
                  </div>
                  <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums shrink-0">
                    {formatCurrency(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline"
            >
              View all obligations
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </SectionCard>

          <SectionCard flat title="Linked Financial Records" icon={FileText}>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.linkedRecords.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {doc.label}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {doc.detail}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    aria-label={`Download ${doc.label}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    aria-label={`More options for ${doc.label}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onNavigateTab?.("documents")}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline"
            >
              View all documents
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </SectionCard>
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="space-y-3 min-w-0">
        <SectionCard flat title="Ownership & Financing" icon={Landmark}>
          <div className="space-y-2.5">
            <LabelValue label="Ownership Status" value={data.ownership.status} />
            <LabelValue label="Occupancy" value={data.ownership.occupancy} />
            <LabelValue label="Lender" value={data.ownership.lender} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Mortgage Status
              </span>
              <StatusBadge tone="emerald">
                {data.ownership.mortgageStatus}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Refinance Opportunity
              </span>
              <StatusBadge tone="brand">
                {data.ownership.refinanceOpportunity}
              </StatusBadge>
            </div>
          </div>
        </SectionCard>

        <section className="rounded-2xl border border-[#456564]/20 dark:border-[#5a7a78]/30 bg-[#456564]/5 dark:bg-[#5a7a78]/10 px-4 py-4">
          <div className="flex items-start gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Refinance Opportunity
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                Based on current rates, refinancing could save you approximately{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  $312/mo
                </span>
                .
              </p>
            </div>
          </div>
          <button
            type="button"
            className="w-full mt-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#456564] hover:bg-[#34514f] transition-colors"
          >
            View Refinance Analysis
          </button>
        </section>

        <SectionCard flat title="At a Glance" icon={Lightbulb}>
          <ul className="space-y-2.5">
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2">
                <insight.icon className="w-3.5 h-3.5 text-[#456564] dark:text-[#7fa3a1] shrink-0 mt-0.5" />
                <span className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {insight.text}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline"
          >
            View all financial insights
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </SectionCard>

      </aside>
        </div>
      </div>

      <div
        className="absolute inset-0 z-10 flex items-center justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <div className="max-w-sm rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm px-6 py-5 text-center shadow-lg">
          <StatusBadge tone="neutral" className="mb-3">
            Coming Soon
          </StatusBadge>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            Financial insights are on the way
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
            Live mortgage, equity, and payment tracking coming soon!
          </p>
        </div>
      </div>
    </div>
  );
}

export default FinancialsTab;
