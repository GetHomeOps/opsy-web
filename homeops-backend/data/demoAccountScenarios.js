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
  { name: "Mike Thompson", email: "mike.thompson@email.com", phone: "2065552101", company: "Thompson Insurance" },
  { name: "Lisa Park", email: "lisa.park@email.com", phone: "2065552102", company: "Park Legal Services" },
  { name: "James Rivera", email: "james.rivera@email.com", phone: "2065552103", company: "Rivera HVAC" },
  { name: "Emma Wilson", email: "emma.wilson@email.com", phone: "2065552104", company: "Wilson Plumbing" },
  { name: "David Kim", email: "david.kim@email.com", phone: "2065552105", company: "Kim Electric" },
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
  { name: "Noel Moore", phone: "2065551001", avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&fit=crop&q=80" },
  { name: "Noel Jones", phone: "2065551002", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&fit=crop&q=80" },
  { name: "Ava Chen", phone: "2065551003", avatar_url: "https://images.unsplash.com/photo-1438761681033-6461eaded4ea?w=400&fit=crop&q=80" },
];

function propertyTemplateByIndex(index) {
  const entry = demoProperties.properties.find((p) => p.index === index);
  if (!entry) {
    throw new Error(`demo-properties.json missing index ${index}`);
  }
  return {
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

module.exports = {
  DEMO_AGENT_PERSONA,
  PLAN_BY_ROLE,
  SYSTEM_KEYS,
  ACCOUNT_CONTACTS,
  DEMO_CONTRACTORS,
  INSPECTION_FIXTURE,
  SYNTHETIC_HOMEOWNERS,
  getScenarioForRole,
};
