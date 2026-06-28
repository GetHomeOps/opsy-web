"use strict";

/**
 * Static templates for runtime demo account provisioning on demo.heyopsy.com.
 * Property addresses/photos are sourced from demo-properties.json indices.
 */

const demoProperties = require("./demo-properties.json");

const DEMO_AGENT_PERSONA = {
  email: "demo-agent-persona@demo.internal",
  name: "Sarah Chen",
  phone: "2065550199",
  role: "agent",
};

const PLAN_BY_ROLE = {
  homeowner: { code: "homeowner_maintain", label: "Maintain" },
  agent: { code: "agent_premium", label: "Win" },
};

const SYSTEM_KEYS = [
  "roof",
  "gutters",
  "heating",
  "ac",
  "plumbing",
  "electrical",
  "waterHeating",
  "windows",
];

const ACCOUNT_CONTACTS = [
  { name: "Tom Bradley", email: "tom@nwroofing.demo", phone: "2065553101", company: "Northwest Roofing Co.", role: "Roofing Contractor" },
  { name: "Angela Moss", email: "angela@cascadehvac.demo", phone: "2065553102", company: "Cascade HVAC Services", role: "HVAC Contractor" },
  { name: "Carlos Mendez", email: "carlos@soundplumbing.demo", phone: "2065553103", company: "Sound Plumbing Pros", role: "Plumbing Contractor" },
  { name: "David Kim", email: "david.kim@heyopsy.demo", phone: "2065552105", company: "Kim Electric", role: "Electrical Contractor" },
  { name: "Maria Santos", email: "maria@greenlawncare.demo", phone: "2065552106", company: "Green Lawn & Landscape", role: "Landscaping Contractor" },
  { name: "Ryan O'Brien", email: "ryan@pacificwindows.demo", phone: "2065552107", company: "Pacific Window & Door", role: "Window Contractor" },
];

const DEMO_CONTRACTORS = [
  {
    company_name: "Northwest Roofing Co.",
    contact_name: "Tom Bradley",
    phone: "2065553101",
    email: "tom@nwroofing.demo",
    city: "Seattle",
    state: "WA",
    description: "Residential roofing repair and replacement.",
  },
  {
    company_name: "Cascade HVAC Services",
    contact_name: "Angela Moss",
    phone: "2065553102",
    email: "angela@cascadehvac.demo",
    city: "Bellevue",
    state: "WA",
    description: "Heating and cooling installation and maintenance.",
  },
  {
    company_name: "Sound Plumbing Pros",
    contact_name: "Carlos Mendez",
    phone: "2065553103",
    email: "carlos@soundplumbing.demo",
    city: "Mercer Island",
    state: "WA",
    description: "Licensed plumbing for homes and small commercial.",
  },
  {
    company_name: "Kim Electric",
    contact_name: "David Kim",
    phone: "2065552105",
    email: "david.kim@heyopsy.demo",
    city: "Seattle",
    state: "WA",
    description: "Panel upgrades, EV chargers, and whole-home electrical.",
  },
  {
    company_name: "Green Lawn & Landscape",
    contact_name: "Maria Santos",
    phone: "2065552106",
    email: "maria@greenlawncare.demo",
    city: "Bellevue",
    state: "WA",
    description: "Seasonal lawn care, irrigation, and outdoor lighting.",
  },
];

const INSPECTION_FIXTURE = {
  condition_rating: "fair",
  condition_confidence: 0.82,
  condition_rationale: "Overall sound structure with several systems due for routine service.",
  summary: "The home is generally well maintained. Roof and HVAC show age-related wear; plumbing and electrical are serviceable.",
  needs_attention: [
    {
      systemType: "roof",
      title: "Missing shingles near ridge line",
      suggestedAction: "Schedule roof inspection and replace damaged shingles before winter.",
      severity: "medium",
      priority: "high",
      evidence: "Section 4.2 — visible wear at north ridge.",
    },
    {
      systemType: "heating",
      title: "Furnace filter overdue",
      suggestedAction: "Replace filter and schedule annual furnace tune-up.",
      severity: "low",
      priority: "medium",
    },
    {
      systemType: "plumbing",
      title: "Slow drain in guest bath",
      suggestedAction: "Snake drain and inspect vent stack if issue persists.",
      severity: "medium",
      priority: "medium",
    },
  ],
  maintenance_suggestions: [
    {
      systemType: "gutters",
      task: "Clean gutters and downspouts",
      rationale: "Prevent water intrusion at foundation.",
      priority: "medium",
      suggestedWhen: "Before rainy season",
    },
    {
      systemType: "ac",
      task: "AC condenser coil cleaning",
      rationale: "Improve efficiency before summer peak usage.",
      priority: "low",
      suggestedWhen: "Spring",
    },
  ],
};

const SYNTHETIC_HOMEOWNERS = [
  {
    name: "Noel Jones",
    email: "noel.jones@gmail.com",
    phone: "2065551002",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&fit=crop&q=80",
  },
  {
    name: "Tatum Walker",
    email: "tatum.walker@outlook.com",
    phone: "2065551003",
    avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&fit=crop&q=80",
  },
  {
    name: "Alex Jackson",
    email: "alex.jackson@heyopsy.com",
    phone: "2065551004",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&fit=crop&q=80",
  },
];

function propertyTemplateByIndex(index) {
  const entry = demoProperties.properties.find((p) => p.index === index);
  if (!entry) {
    throw new Error(`demo-properties.json missing index ${index}`);
  }
  return {
    index: entry.index,
    address: entry.address,
    main_photo: entry.main_photo,
    homeowner: entry.homeowner,
  };
}

function getHomeownerScenario() {
  return {
    plan: PLAN_BY_ROLE.homeowner,
    properties: [propertyTemplateByIndex(1)],
    focus: "balanced",
  };
}

function getAgentScenario() {
  return {
    plan: PLAN_BY_ROLE.agent,
    properties: [
      { ...propertyTemplateByIndex(2), focus: "inspections", syntheticHomeowner: SYNTHETIC_HOMEOWNERS[0] },
      { ...propertyTemplateByIndex(3), focus: "maintenance", syntheticHomeowner: SYNTHETIC_HOMEOWNERS[1] },
      { ...propertyTemplateByIndex(4), focus: "messages", syntheticHomeowner: SYNTHETIC_HOMEOWNERS[2] },
    ],
  };
}

function getScenarioForRole(role) {
  if (role === "homeowner") return getHomeownerScenario();
  if (role === "agent") return getAgentScenario();
  throw new Error(`Unsupported demo role: ${role}`);
}

const INSPECTION_BY_INDEX = {
  2: {
    condition_rating: "fair",
    condition_confidence: 0.78,
    condition_rationale: "Sound structure with roof and HVAC items due for attention.",
    summary: "Generally well maintained. Roof ridge wear and overdue furnace filter flagged.",
  },
  3: {
    condition_rating: "good",
    condition_confidence: 0.88,
    condition_rationale: "Well-maintained home with routine seasonal upkeep on track.",
    summary: "Strong overall condition. Gutters and exterior caulking are the next priorities.",
  },
  4: {
    condition_rating: "fair",
    condition_confidence: 0.74,
    condition_rationale: "Newer build with a few deferred maintenance items in plumbing and windows.",
    summary: "Solid bones. Guest bath drain and two window seals need follow-up this quarter.",
  },
};

function getInspectionFixtureForIndex(index) {
  const variant = INSPECTION_BY_INDEX[index];
  if (!variant) return INSPECTION_FIXTURE;
  return { ...INSPECTION_FIXTURE, ...variant };
}

const {
  DEMO_BROADCAST_COMMUNICATIONS,
  getIdentityFixtureForIndex,
  getSystemFixturesForProperty,
  getMaintenanceRecordsForProperty,
  getConversationThread,
} = require("./demoProvisioningFixtures");

module.exports = {
  DEMO_AGENT_PERSONA,
  PLAN_BY_ROLE,
  SYSTEM_KEYS,
  ACCOUNT_CONTACTS,
  DEMO_CONTRACTORS,
  INSPECTION_FIXTURE,
  SYNTHETIC_HOMEOWNERS,
  DEMO_BROADCAST_COMMUNICATIONS,
  getIdentityFixtureForIndex,
  getSystemFixturesForProperty,
  getMaintenanceRecordsForProperty,
  getConversationThread,
  getInspectionFixtureForIndex,
  getScenarioForRole,
};
