/**
 * DEPRECATED: Fallback plan definitions.
 * The OnboardingWizard now fetches plans dynamically from GET /billing/plans/:audience.
 * These arrays are only used as a fallback if the API call fails.
 * To edit tier features, limits, or Stripe pricing, use Super Admin > Billing Plans.
 */

/** Homeowner plans: Free, Maintain, Win only. Features from pricing spec. */
export const HOMEOWNER_PLANS = [
  {
    id: "homeowner_free",
    code: "homeowner_free",
    name: "Free",
    price: 0,
    priceLabel: "Free",
    description: "Get started with the essentials",
    popular: false,
    tier: "minimal",
    features: {
      core: [
        { label: "Storage", value: "1 per system", storageHint: true },
        { label: "Users", value: "1 seat (+1 view only)" },
        { label: "Contacts", value: "20" },
        { label: "Properties", value: "1" },
        { label: "Maintenance tracking", value: "Manual" },
      ],
      advanced: [
        { label: "AI", value: "None" },
        { label: "Data ingestion", value: "Manual" },
        { label: "Export", value: "PDF, DHP only" },
        { label: "Support", value: "FAQs, Bot, Videos, email (DIY)" },
      ],
    },
  },
  {
    id: "homeowner_maintain",
    code: "homeowner_maintain",
    name: "Maintain",
    price: 9.99,
    priceLabel: "$9.99",
    description: "Core protection: AI assistant, contractor scheduling",
    popular: true,
    tier: "standard",
    features: {
      core: [
        { label: "Storage", value: "3 per system", storageHint: true },
        { label: "Users", value: "3 seats (infinite view)" },
        { label: "Contacts", value: "40" },
        { label: "Properties", value: "1" },
        { label: "Maintenance tracking", value: "Assisted" },
      ],
      advanced: [
        { label: "AI", value: "AI Assisted" },
        { label: "Data ingestion", value: "100 tokens/month" },
        { label: "Export", value: "CSV, Excel, PDF" },
        { label: "Support", value: "24/7" },
      ],
    },
  },
  {
    id: "homeowner_win",
    code: "homeowner_win",
    name: "Win",
    price: 39.99,
    priceLabel: "$39.99",
    description: "Full control: unlimited AI, custom reports, 2+ properties",
    popular: false,
    tier: "premium",
    features: {
      core: [
        { label: "Storage", value: "Unlimited", storageHint: true },
        { label: "Users", value: "Unlimited" },
        { label: "Contacts", value: "Unlimited" },
        { label: "Properties", value: "2+ (add'l cost after 2)" },
        { label: "Maintenance tracking", value: "Automated" },
      ],
      advanced: [
        { label: "AI", value: "AI Automation" },
        { label: "Data ingestion", value: "300 tokens/month" },
        { label: "Export", value: "Custom reports" },
        { label: "Support", value: "Priority" },
      ],
    },
  },
];

/**
 * Agent plans: Basic, Pro, Premium.
 * Backend expects agent_basic, agent_pro, agent_premium.
 * Features inspired by agent pricing spec (Maintain/Growth/Win).
 */
export const AGENT_PLANS = [
  {
    id: "agent_basic",
    code: "agent_basic",
    name: "Basic",
    price: 99,
    priceLabel: "$99",
    description: "Up to 5 properties, essential tools",
    popular: false,
    tier: "standard",
    features: {
      core: [
        { label: "Properties", value: "Up to 5" },
        { label: "Users", value: "1 + TC" },
        { label: "Branding", value: "Opsy" },
        { label: "Onboarding", value: "30 min consult" },
      ],
      advanced: [
        { label: "AI", value: "None" },
        { label: "Data ingestion", value: "Manual" },
        { label: "Export", value: "PDF, DHP only" },
        { label: "Support", value: "FAQs, Bot, Videos, email (DIY)" },
        { label: "Integrations", value: "None" },
        { label: "Leads", value: "None" },
      ],
    },
  },
  {
    id: "agent_pro",
    code: "agent_pro",
    name: "Pro",
    price: 199,
    priceLabel: "$199",
    description: "Up to 25 properties, AI summaries, reporting",
    popular: true,
    tier: "standard",
    features: {
      core: [
        { label: "Properties", value: "Up to 25" },
        { label: "Users", value: "2 + TC" },
        { label: "Branding", value: "Co-branded" },
        { label: "Onboarding", value: "Dedicated specialist" },
      ],
      advanced: [
        { label: "AI", value: "AI Assisted" },
        { label: "Data ingestion", value: "Assisted" },
        { label: "Export", value: "CSV, Excel, PDF" },
        { label: "Support", value: "24/7" },
        { label: "Integrations", value: "SELECT CRM (TBD)" },
        { label: "Leads", value: "Zip code specific" },
      ],
    },
  },
  {
    id: "agent_premium",
    code: "agent_premium",
    name: "Premium",
    price: 299,
    priceLabel: "$299",
    description: "Up to 50 properties, API, white-label",
    popular: false,
    tier: "premium",
    features: {
      core: [
        { label: "Properties", value: "Up to 50" },
        { label: "Users", value: "Up to 5 total" },
        { label: "Branding", value: "Fully white-labeled" },
        { label: "Onboarding", value: "Dedicated account manager" },
      ],
      advanced: [
        { label: "AI", value: "AI Automation" },
        { label: "Data ingestion", value: "Automated" },
        { label: "Export", value: "Custom reports" },
        { label: "Support", value: "Priority" },
        { label: "Integrations", value: "API" },
        { label: "Leads", value: "City expand" },
      ],
    },
  },
];

/** Plan limits for confirmation summary (fallback when API not loaded). Editable in Super Admin. */
export const PLAN_LIMITS = {
  homeowner: {
    homeowner_free: { properties: 1, contacts: 20 },
    homeowner_maintain: { properties: 1, contacts: 40 },
    homeowner_win: { properties: "2+", contacts: "Unlimited" },
  },
  agent: {
    agent_basic: { properties: 5, contacts: "—" },
    agent_pro: { properties: 25, contacts: "—" },
    agent_premium: { properties: 50, contacts: "—" },
  },
};
