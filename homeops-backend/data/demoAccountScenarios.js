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
  // Contractor companies
  {
    type: "company",
    name: "Northwest Roofing Co.",
    email: "office@nwroofing.demo",
    phone: "2065553100",
    website: "https://nwroofing.demo",
    city: "Seattle",
    state: "WA",
    role: "Roofing Contractor",
  },
  {
    type: "company",
    name: "Cascade HVAC Services",
    email: "office@cascadehvac.demo",
    phone: "2065553102",
    website: "https://cascadehvac.demo",
    city: "Bellevue",
    state: "WA",
    role: "HVAC Contractor",
  },
  {
    type: "company",
    name: "Sound Plumbing Pros",
    email: "office@soundplumbing.demo",
    phone: "2065553103",
    website: "https://soundplumbing.demo",
    city: "Mercer Island",
    state: "WA",
    role: "Plumbing Contractor",
  },
  {
    type: "company",
    name: "Kim Electric",
    email: "office@kimelectric.demo",
    phone: "2065552105",
    website: "https://kimelectric.demo",
    city: "Seattle",
    state: "WA",
    role: "Electrical Contractor",
  },
  {
    type: "company",
    name: "Green Lawn & Landscape",
    email: "office@greenlawncare.demo",
    phone: "2065552106",
    website: "https://greenlawncare.demo",
    city: "Bellevue",
    state: "WA",
    role: "Landscaping Contractor",
  },
  {
    type: "company",
    name: "Pacific Window & Door",
    email: "office@pacificwindows.demo",
    phone: "2065552107",
    website: "https://pacificwindows.demo",
    city: "Seattle",
    state: "WA",
    role: "Window Contractor",
  },
  // Contractor people
  {
    type: "individual",
    name: "Tom Bradley",
    email: "tom@nwroofing.demo",
    phone: "2065553111",
    role: "Roofing Project Manager",
  },
  {
    type: "individual",
    name: "Angela Moss",
    email: "angela@cascadehvac.demo",
    phone: "2065553112",
    role: "HVAC Service Manager",
  },
  {
    type: "individual",
    name: "Carlos Mendez",
    email: "carlos@soundplumbing.demo",
    phone: "2065553113",
    role: "Lead Plumber",
  },
  {
    type: "individual",
    name: "David Kim",
    email: "david.kim@heyopsy.demo",
    phone: "2065552115",
    role: "Master Electrician",
  },
  {
    type: "individual",
    name: "Maria Santos",
    email: "maria@greenlawncare.demo",
    phone: "2065552116",
    role: "Landscape Designer",
  },
  {
    type: "individual",
    name: "Ryan O'Brien",
    email: "ryan@pacificwindows.demo",
    phone: "2065552117",
    role: "Installation Manager",
  },
  // Real-estate partner companies
  {
    type: "company",
    name: "Puget Sound Title & Escrow",
    email: "office@pugettitle.demo",
    phone: "2065553201",
    website: "https://pugettitle.demo",
    city: "Seattle",
    state: "WA",
    role: "Title & Escrow",
  },
  {
    type: "company",
    name: "Evergreen Home Inspections",
    email: "office@evergreeninspect.demo",
    phone: "2065553202",
    website: "https://evergreeninspect.demo",
    city: "Bellevue",
    state: "WA",
    role: "Home Inspection",
  },
  {
    type: "company",
    name: "Northwest Staging Co.",
    email: "office@nwstaging.demo",
    phone: "2065553203",
    website: "https://nwstaging.demo",
    city: "Seattle",
    state: "WA",
    role: "Home Staging",
  },
  // Real-estate partner people
  {
    type: "individual",
    name: "Patricia Walsh",
    email: "pwalsh@pugettitle.demo",
    phone: "2065553211",
    role: "Escrow Officer",
  },
  {
    type: "individual",
    name: "James Chen",
    email: "jchen@photos.demo",
    phone: "2065553212",
    role: "Real Estate Photographer",
  },
  {
    type: "individual",
    name: "Lisa Morrison",
    email: "lisa@nwstaging.demo",
    phone: "2065553213",
    role: "Staging Lead",
  },
];

/** Preferred global directory professionals to favorite (must have profile_photo on demo). */
const DEMO_FAVORITE_PROFESSIONAL_HINTS = [
  "Green Spaces Landscaping",
  "Northwest Pro Cleaning",
  "Evergreen Electric",
  "Pacific Northwest Plumbing",
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
    personaKey: "noel",
    name: "Noel Jones",
    email: "noel.jones@demo.heyopsy.com",
    phone: "2065551002",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&fit=crop&q=80",
  },
  {
    personaKey: "tatum",
    name: "Tatum Walker",
    email: "tatum.walker@demo.heyopsy.com",
    phone: "2065551003",
    avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&fit=crop&q=80",
  },
  {
    personaKey: "alex",
    name: "Alex Jackson",
    email: "alex.jackson@demo.heyopsy.com",
    phone: "2065551004",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&fit=crop&q=80",
  },
];

/** Property index used for the login-able paired homeowner in bilateral demos. */
const PAIRED_HOMEOWNER_PROPERTY_INDEX = 4;

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

/** S3 keys for demo inspection report PDFs in the opsy-demo bucket (demo/ prefix). */
const DEMO_INSPECTION_REPORT_FILES = {
  1: {
    s3Key: "demo/Sample_Home_Inspection_Report_Opsy_Inspections.pdf",
    fileName: "Home Inspection Report.pdf",
  },
  2: {
    s3Key: "demo/Sample_Home_Inspection_Report_456_Main_Jones.pdf",
    fileName: "Home Inspection Report.pdf",
  },
};

const DEFAULT_DEMO_INSPECTION_REPORT = {
  s3Key: "demo/Sample_Home_Inspection_Report_Opsy_Inspections.pdf",
  fileName: "Home Inspection Report.pdf",
};

function getInspectionReportFileForIndex(index) {
  return DEMO_INSPECTION_REPORT_FILES[index] ?? DEFAULT_DEMO_INSPECTION_REPORT;
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
  DEMO_FAVORITE_PROFESSIONAL_HINTS,
  INSPECTION_FIXTURE,
  SYNTHETIC_HOMEOWNERS,
  PAIRED_HOMEOWNER_PROPERTY_INDEX,
  DEMO_BROADCAST_COMMUNICATIONS,
  getIdentityFixtureForIndex,
  getSystemFixturesForProperty,
  getMaintenanceRecordsForProperty,
  getConversationThread,
  getInspectionFixtureForIndex,
  getInspectionReportFileForIndex,
  getScenarioForRole,
};
