import {
  CircleDollarSign,
  Shield,
  Calendar,
  Lightbulb,
} from "lucide-react";

/**
 * Illustrative financials data shared by the Financials tab and the Overview
 * financial preview. Used until live mortgage integrations are available.
 */
export const FINANCIALS_DEMO = {
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
  trendLabels: [
    "May '25",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan '26",
    "Feb",
    "Mar",
    "Apr",
  ],
  valueTrend: [
    1095000, 1102000, 1110000, 1118000, 1125000, 1132000, 1140000, 1148000,
    1155000, 1162000, 1170000, 1180000,
  ],
  equityTrend: [
    415000, 430000, 443000, 456000, 467000, 478000, 490000, 500000, 509000,
    517000, 527000, 537500,
  ],
  paymentTrend: [
    3980, 3980, 3980, 4050, 4050, 4050, 4120, 4120, 4120, 4167, 4167, 4167,
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
    {
      id: "settle",
      label: "Settlement Statement",
      detail: "May 2021",
      type: "pdf",
    },
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

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatShortCurrency(value) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return formatCurrency(value);
}
