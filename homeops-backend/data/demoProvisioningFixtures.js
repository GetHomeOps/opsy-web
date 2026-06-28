"use strict";

/**
 * Rich fixture data for runtime demo account provisioning.
 * Identity, systems, maintenance, conversations, and broadcast communications.
 */

const DEMO_BROADCAST_COMMUNICATIONS = [
  {
    subject: "Welcome to Opsy — your home passport is ready",
    content: {
      layout: "classic",
      body:
        "<p>Hi there,</p>" +
        "<p>Welcome to <strong>Opsy</strong>! Your property passport is set up and ready to use. " +
        "Inside you'll find your home systems, maintenance history, and inspection insights — all in one place.</p>" +
        "<p>I'm here whenever you have questions about upkeep, contractors, or anything around the home. " +
        "Just reply in Opsy or send me a message anytime.</p>" +
        "<p>Looking forward to helping you stay ahead of seasonal maintenance.</p>" +
        "<p>Best,<br/>Your Opsy agent</p>",
      templateTheme: {
        primaryColor: "#456564",
        secondaryColor: "#f8faf9",
        brandName: "Opsy",
        footerText: "You're receiving this because you're connected with your agent on Opsy.",
      },
    },
    sentDaysAgo: 14,
  },
  {
    subject: "Seasonal maintenance suggestions for your home",
    content: {
      layout: "newsletter",
      body:
        "<p>As we head into the rainy season here in the Pacific Northwest, a few items are worth prioritizing on your home maintenance checklist:</p>" +
        "<ul>" +
        "<li><strong>Gutters &amp; downspouts</strong> — clean before heavy rain to prevent water intrusion</li>" +
        "<li><strong>Furnace tune-up</strong> — schedule service and replace HVAC filters</li>" +
        "<li><strong>Exterior caulking</strong> — check around windows and doors</li>" +
        "<li><strong>Safety devices</strong> — test smoke and CO detectors</li>" +
        "</ul>" +
        "<p>Reply in Opsy if you'd like help coordinating any of these — I'm happy to line up trusted contractors.</p>",
      newsletterTagline: "Your seasonal home care guide",
      newsletterInThisIssueLabel: "Priority items",
      newsletterFeaturedLabel: "Top recommendation",
      templateTheme: {
        primaryColor: "#456564",
        secondaryColor: "#f8faf9",
        brandName: "Opsy",
        footerText: "Questions? Reply in Opsy — I'm happy to help coordinate any of these.",
      },
    },
    sentDaysAgo: 7,
  },
  {
    subject: "Follow up on your inspection checklist",
    content: {
      layout: "classic",
      body:
        "<p>Hi,</p>" +
        "<p>I've reviewed the inspection analysis for your property. A few items are flagged for attention — " +
        "please open your <strong>inspection checklist</strong> in Opsy and let me know which repairs you'd like to tackle first.</p>" +
        "<p>I work with trusted local contractors and can make introductions for:</p>" +
        "<ul>" +
        "<li>Roofing and gutter work</li>" +
        "<li>HVAC tune-ups and filter replacement</li>" +
        "<li>Plumbing and electrical repairs</li>" +
        "</ul>" +
        "<p>Reply here with your priorities and I'll line up next steps.</p>" +
        "<p>Best,<br/>Your Opsy agent</p>",
      templateTheme: {
        primaryColor: "#456564",
        secondaryColor: "#f8faf9",
        brandName: "Opsy",
        footerText: "Sent via Opsy · Your home management platform",
      },
    },
    sentDaysAgo: 3,
  },
  {
    subject: "Spring prep checklist for your home",
    content: {
      layout: "announcement",
      announcementBadge: "Seasonal update",
      body:
        "<p>Spring is a great time to refresh your home maintenance plan. Here are the items I recommend tackling over the next few weeks:</p>" +
        "<ul>" +
        "<li><strong>AC condenser</strong> — coil cleaning before summer heat</li>" +
        "<li><strong>Exterior</strong> — paint and siding touch-ups</li>" +
        "<li><strong>Outdoor living</strong> — deck and patio inspection</li>" +
        "<li><strong>Irrigation</strong> — system startup check</li>" +
        "</ul>" +
        "<p>Your Opsy passport tracks due dates automatically. Reach out if you'd like me to schedule anything.</p>",
      templateTheme: {
        primaryColor: "#456564",
        secondaryColor: "#f8faf9",
        brandName: "Opsy",
        footerText: "Powered by Opsy · Home management made simple",
      },
    },
    sentDaysAgo: 1,
  },
];

/** Identity fixtures keyed by demo-properties.json index (2, 3, 4 for agent scenario). */
const IDENTITY_BY_INDEX = {
  2: {
    county: "King",
    tax_id: "788890-0150",
    owner_name: "Noel Jones",
    owner_name_2: "Jordan Jones",
    owner_city: "Mercer Island",
    occupant_name: "Noel Jones",
    occupant_type: "Owner",
    owner_phone: "2065551002",
    property_type: "Single Family",
    sub_type: "Detached",
    year_built: 1992,
    sq_ft_total: 3420,
    sq_ft_finished: 3180,
    garage_sq_ft: 480,
    total_dwelling_sq_ft: 3660,
    lot_size: "0.28 acres",
    bed_count: 4,
    bath_count: 3,
    full_baths: 2,
    three_quarter_baths: 1,
    half_baths: 1,
    number_of_showers: 2,
    number_of_bathtubs: 2,
    fireplaces: 1,
    fireplace_types: "Gas",
    basement: "Finished",
    parking_type: "Attached Garage",
    total_covered_parking: 2,
    total_uncovered_parking: 2,
    school_district: "Mercer Island School District",
    elementary_school: "Island Park Elementary",
    junior_high_school: "Islander Middle School",
    senior_high_school: "Mercer Island High School",
  },
  3: {
    county: "King",
    tax_id: "788890-0225",
    owner_name: "Tatum Walker",
    owner_name_2: "Chris Walker",
    owner_city: "Mercer Island",
    occupant_name: "Tatum Walker",
    occupant_type: "Owner",
    owner_phone: "2065551003",
    property_type: "Single Family",
    sub_type: "Detached",
    year_built: 1988,
    sq_ft_total: 2890,
    sq_ft_finished: 2650,
    garage_sq_ft: 400,
    total_dwelling_sq_ft: 3050,
    lot_size: "0.19 acres",
    bed_count: 3,
    bath_count: 2,
    full_baths: 2,
    three_quarter_baths: 0,
    half_baths: 1,
    number_of_showers: 2,
    number_of_bathtubs: 1,
    fireplaces: 2,
    fireplace_types: "Wood, Gas",
    basement: "Partial",
    parking_type: "Attached Garage",
    total_covered_parking: 2,
    total_uncovered_parking: 0,
    school_district: "Mercer Island School District",
    elementary_school: "Lakeridge Elementary",
    junior_high_school: "Islander Middle School",
    senior_high_school: "Mercer Island High School",
  },
  4: {
    county: "King",
    tax_id: "788890-0310",
    owner_name: "Alex Jackson",
    owner_name_2: "Sam Jackson",
    owner_city: "Mercer Island",
    occupant_name: "Alex Jackson",
    occupant_type: "Owner",
    owner_phone: "2065551004",
    property_type: "Single Family",
    sub_type: "Detached",
    year_built: 2001,
    sq_ft_total: 4100,
    sq_ft_finished: 3850,
    garage_sq_ft: 620,
    total_dwelling_sq_ft: 4470,
    lot_size: "0.35 acres",
    bed_count: 5,
    bath_count: 4,
    full_baths: 3,
    three_quarter_baths: 1,
    half_baths: 1,
    number_of_showers: 3,
    number_of_bathtubs: 2,
    fireplaces: 1,
    fireplace_types: "Gas",
    basement: "Daylight",
    parking_type: "Attached Garage",
    total_covered_parking: 3,
    total_uncovered_parking: 2,
    school_district: "Mercer Island School District",
    elementary_school: "West Mercer Elementary",
    junior_high_school: "Islander Middle School",
    senior_high_school: "Mercer Island High School",
  },
};

function baseSystemData() {
  return {
    roof: {
      material: "Architectural asphalt shingle",
      install_date: "2014-06-01",
      installer: "Northwest Roofing Co.",
      condition: "Good",
      warranty: "25-year transferable",
      last_inspection: "2024-09-15",
      issues: "Minor granule loss on south slope; ridge cap secure",
      next_service_date_offset: 180,
    },
    gutters: {
      material: "Aluminum seamless",
      install_date: "2014-06-01",
      installer: "Northwest Roofing Co.",
      condition: "Fair",
      warranty: "10-year workmanship",
      last_inspection: "2024-03-10",
      issues: "Debris accumulation; one downspout extension loose",
      next_service_date_offset: 30,
    },
    heating: {
      system_type: "Forced air gas furnace",
      install_date: "2016-11-01",
      installer: "Cascade HVAC Services",
      condition: "Good",
      warranty: "10-year parts",
      last_inspection: "2024-10-01",
      issues: "Filter due for replacement; heat exchanger within spec",
      next_service_date_offset: 60,
    },
    ac: {
      system_type: "Central split system",
      install_date: "2018-04-15",
      installer: "Cascade HVAC Services",
      condition: "Good",
      warranty: "10-year compressor",
      last_inspection: "2024-05-20",
      issues: "Condenser coil could use cleaning before summer",
      next_service_date_offset: 90,
    },
    plumbing: {
      supply_materials: "Copper supply, PVC drain",
      install_date: "1992-01-01",
      installer: "Sound Plumbing Pros",
      condition: "Good",
      warranty: "N/A — original",
      last_inspection: "2024-08-01",
      issues: "Guest bath drain slow; main line clear",
      next_service_date_offset: 120,
    },
    electrical: {
      service_amperage: "200 amp",
      install_date: "2010-03-01",
      installer: "Kim Electric",
      condition: "Good",
      warranty: "N/A",
      last_inspection: "2024-07-12",
      issues: "Panel labeled; GFCI outlets functional in kitchen and baths",
      next_service_date_offset: 365,
    },
    waterHeating: {
      system_type: "Gas tank 50 gal",
      install_date: "2019-02-01",
      installer: "Sound Plumbing Pros",
      condition: "Good",
      warranty: "6-year tank",
      last_inspection: "2024-11-01",
      issues: "Anode rod inspected; no leaks at connections",
      next_service_date_offset: 180,
    },
    windows: {
      type: "Double-pane vinyl",
      install_date: "2008-08-01",
      installer: "Pacific Window & Door",
      condition: "Fair",
      warranty: "Lifetime glass",
      last_inspection: "2024-06-01",
      issues: "Seal failure on two south-facing units; operable sashes functional",
      next_service_date_offset: 240,
    },
  };
}

/** Property-index variants so the three agent demo homes don't look identical. */
const SYSTEM_VARIANTS_BY_INDEX = {
  2: {
    roof: { condition: "Fair", issues: "Missing shingles near north ridge line — schedule repair before winter" },
    heating: { condition: "Fair", issues: "Furnace filter overdue; blower motor quiet" },
  },
  3: {
    gutters: { condition: "Fair", issues: "Heavy leaf buildup; recommend cleaning before November rains" },
    plumbing: { issues: "Slow drain in guest bath; snaking recommended" },
  },
  4: {
    roof: { issues: "Ridge-line wear noted in recent inspection; contractor quote pending" },
    ac: { condition: "Fair", issues: "Refrigerant levels normal; coil cleaning recommended" },
  },
};

function getIdentityFixtureForIndex(index, syntheticHomeowner) {
  const base = IDENTITY_BY_INDEX[index];
  if (!base) return null;
  const ownerName = syntheticHomeowner?.name || base.owner_name;
  return {
    ...base,
    owner_name: ownerName,
    occupant_name: ownerName,
    owner_phone: syntheticHomeowner?.phone || base.owner_phone,
  };
}

function getSystemFixturesForProperty(index, daysFromNow) {
  const base = baseSystemData();
  const variants = SYSTEM_VARIANTS_BY_INDEX[index] || {};
  const result = {};

  for (const [systemKey, fields] of Object.entries(base)) {
    const merged = { ...fields, ...(variants[systemKey] || {}) };
    const { next_service_date_offset, ...data } = merged;
    result[systemKey] = {
      data,
      next_service_date: daysFromNow(next_service_date_offset),
    };
  }
  return result;
}

function demoFile(key, name, size = 245000) {
  return { key, name, size };
}

function getMaintenanceRecordsForProperty(index, propertyId, focus, daysAgo, daysFromNow) {
  const shared = [
    {
      property_id: propertyId,
      system_key: "heating",
      completed_at: daysAgo(120),
      next_service_date: daysFromNow(60),
      status: "completed",
      record_status: "user_completed",
      data: {
        description: "Annual furnace tune-up",
        recordType: "Maintenance",
        source: "Manual",
        contractor: "Cascade HVAC Services",
        contractorEmail: "angela@cascadehvac.demo",
        contractorPhone: "2065553102",
        cost: "285",
        notes:
          "Replaced 16x25x1 filter, cleaned burners and flame sensor, checked heat exchanger and blower amp draw. " +
          "System cycling normally with 18°F temperature rise.",
        findings:
          "Heat exchanger intact with no visible cracks\nBlower motor amperage within manufacturer spec\nFlue draft adequate",
        nextStepsRecommendation:
          "Replace filter every 90 days\nSchedule next tune-up before heating season",
        materialsUsed: [
          { material: "HVAC filter 16x25x1", description: "MERV 11 pleated", cost: "18" },
        ],
        files: [demoFile("demo/furnace-service-report.pdf", "Furnace Service Report.pdf")],
      },
    },
    {
      property_id: propertyId,
      system_key: "gutters",
      completed_at: daysAgo(200),
      next_service_date: daysFromNow(30),
      status: "completed",
      record_status: "user_completed",
      data: {
        description: "Gutter cleaning and downspout flush",
        recordType: "Maintenance",
        source: "Manual",
        contractor: "Northwest Roofing Co.",
        contractorEmail: "tom@nwroofing.demo",
        contractorPhone: "2065553101",
        cost: "195",
        notes:
          "Removed leaves and debris from all gutters. Flushed downspouts and reattached loose extension at northeast corner.",
        findings:
          "No standing water after flush\nOne downspout extension needed re-securing",
        nextStepsRecommendation:
          "Clean gutters again before rainy season\nInspect fascia boards at next service",
        files: [demoFile("demo/gutter-service-invoice.pdf", "Gutter Service Invoice.pdf", 128000)],
      },
    },
    {
      property_id: propertyId,
      system_key: "roof",
      completed_at: null,
      next_service_date: daysFromNow(14),
      status: "pending",
      data: {
        description: "Roof inspection — ridge line assessment",
        recordType: "Inspection",
        source: "Manual",
        contractor: "Northwest Roofing Co.",
        notes: "Scheduled walk-through to assess ridge-line shingle wear identified in inspection report.",
        findings: "Preliminary visual from ground: possible missing shingles at north ridge",
        nextStepsRecommendation:
          "Complete on-roof inspection\nObtain repair quote if damage confirmed\nAddress before winter storms",
        files: [],
      },
    },
    {
      property_id: propertyId,
      system_key: "plumbing",
      completed_at: daysAgo(45),
      next_service_date: daysFromNow(90),
      status: "completed",
      record_status: "user_completed",
      data: {
        description: "Guest bath drain snaking",
        recordType: "Repair",
        source: "Manual",
        contractor: "Sound Plumbing Pros",
        contractorEmail: "carlos@soundplumbing.demo",
        contractorPhone: "2065553103",
        cost: "165",
        notes: "Snaked guest bath lavatory drain 25 ft. Removed hair and soap buildup. Tested flow — draining normally.",
        findings: "No root intrusion\nTrap and P-trap intact",
        nextStepsRecommendation: "Monitor drain speed over next 30 days\nConsider enzymatic maintenance treatment",
        files: [demoFile("demo/plumbing-repair-receipt.pdf", "Plumbing Repair Receipt.pdf", 89000)],
      },
    },
  ];

  if (focus === "inspections" || index === 2) {
    shared.push({
      property_id: propertyId,
      system_key: "electrical",
      completed_at: daysAgo(30),
      next_service_date: daysFromNow(335),
      status: "completed",
      record_status: "user_completed",
      data: {
        description: "Electrical panel inspection",
        recordType: "Inspection",
        source: "Manual",
        contractor: "Kim Electric",
        cost: "225",
        notes: "Inspected 200A panel, tested GFCI outlets in kitchen and baths, verified smoke detector interconnect.",
        findings: "Panel properly labeled\nNo double-tapped breakers\nGFCI protection functional",
        nextStepsRecommendation: "Replace smoke detectors older than 10 years\nAdd AFCI breakers on bedroom circuits at next upgrade",
        files: [demoFile("demo/electrical-inspection-report.pdf", "Electrical Inspection Report.pdf")],
      },
    });
  }

  if (focus === "maintenance" || index === 3) {
    shared.push({
      property_id: propertyId,
      system_key: "waterHeating",
      completed_at: daysAgo(60),
      next_service_date: daysFromNow(180),
      status: "completed",
      record_status: "user_completed",
      data: {
        description: "Water heater flush and anode inspection",
        recordType: "Maintenance",
        source: "Manual",
        contractor: "Sound Plumbing Pros",
        cost: "175",
        notes: "Drained and flushed tank, inspected anode rod (60% remaining), checked T&P valve and gas connections.",
        findings: "No sediment buildup beyond normal\nAnode rod serviceable",
        nextStepsRecommendation: "Replace anode rod in 2–3 years\nFlush tank annually",
        files: [demoFile("demo/water-heater-service.pdf", "Water Heater Service Report.pdf")],
      },
    });
  }

  return shared;
}

/** Conversation thread definitions keyed by focus. */
const CONVERSATION_THREADS = {
  inspections: {
    messages: [
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message:
            "Hi — I reviewed the inspection report. The missing shingles near the ridge line worry me. How urgent is that repair?",
        },
        daysAgo: 5,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "Good question. I'd prioritize it before the first heavy rain — probably within the next few weeks. " +
            "It's not an emergency today, but water intrusion at the ridge can spread quickly. I can line up a roofer for a walk-through.",
        },
        daysAgo: 5,
      },
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message: "That would be great. Also, the furnace filter note — should we schedule the tune-up now or wait until fall?",
        },
        daysAgo: 4,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "Let's schedule the tune-up now while HVAC companies have availability. I'll send a few dates from Cascade HVAC — they're reliable for this neighborhood.",
        },
        daysAgo: 4,
      },
      {
        sender: "homeowner",
        kind: "referral_request",
        payload: {
          referralType: "Roofer",
          notes: "Licensed roofer for ridge-line shingle repair. Prefer someone who has worked on Mercer Island homes.",
        },
        daysAgo: 2,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "I'll introduce you to Tom at Northwest Roofing — he's done great work for other clients on the Island. Expect a call within a day or two.",
        },
        daysAgo: 2,
      },
    ],
    inquiries: [
      {
        kind: "message",
        payload: { message: "Can you review the inspection findings before we book contractors?" },
      },
    ],
  },
  maintenance: {
    messages: [
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message: "The furnace tune-up is done — thanks for coordinating that. What's next on our maintenance list?",
        },
        daysAgo: 6,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "Great — I saw the service report come through. Next up I'd recommend gutter cleaning before the rains hit, " +
            "and we still have the roof inspection on the calendar for later this month.",
        },
        daysAgo: 6,
      },
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message:
            "Gutters make sense. Any tips for keeping them clear between professional cleanings? We have a lot of maples on the property.",
        },
        daysAgo: 5,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "Maples are the worst for gutters! I'd suggest gutter guards on the south side where the canopy is heaviest, " +
            "and a quick visual check after windstorms. I can add a reminder in Opsy for a mid-season check in November.",
        },
        daysAgo: 5,
      },
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message: "Gutters make sense. Can you send someone for the week of the 15th?",
        },
        daysAgo: 3,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "Absolutely — I'll reach out to Northwest Roofing and confirm a morning slot. I'll add it to your Opsy calendar once booked.",
        },
        daysAgo: 3,
      },
    ],
    inquiries: [
      {
        kind: "message",
        payload: { message: "Is the water heater flush something we should do every year?" },
      },
    ],
  },
  messages: {
    messages: [
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message:
            "Hi — could you recommend a good roofer for the missing shingles we discussed?",
        },
        daysAgo: 7,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "I have a few trusted contractors — Northwest Roofing has done great work for other clients on the Island. " +
            "I can introduce you and coordinate a walk-through if you'd like.",
        },
        daysAgo: 7,
      },
      {
        sender: "homeowner",
        kind: "referral_request",
        payload: {
          referralType: "Roofer",
          notes: "Looking for licensed roofer for ridge-line repair, prefer local referrals.",
        },
        daysAgo: 5,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "I'll send Tom at Northwest Roofing your way — he knows these rooflines well. Expect a call within a day or two.",
        },
        daysAgo: 5,
      },
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message: "Perfect, thank you! Also — guest bath drain is still slow. Any plumber you'd recommend?",
        },
        daysAgo: 3,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "Sound Plumbing Pros handled a similar issue for another homeowner last month. I'll share their contact and can loop them in if you want.",
        },
        daysAgo: 3,
      },
      {
        sender: "homeowner",
        kind: "refer_agent",
        payload: {
          referName: "Megan & David Park",
          referContact: "megan.park@email.com",
          note: "Friends buying on Mercer Island this spring — they'd love an agent who knows the area and helps with home maintenance.",
        },
        daysAgo: 1,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "Thank you so much for the referral, Alex! I'll reach out to Megan and David this week. Really appreciate you thinking of me.",
        },
        daysAgo: 1,
      },
    ],
    inquiries: [
      {
        kind: "referral_request",
        payload: {
          referralType: "Plumber",
          notes: "Guest bath drain is slow — need someone this week if possible.",
        },
      },
      {
        kind: "message",
        payload: { message: "Thanks for the roofer intro — Tom called and we're scheduling for next Tuesday." },
      },
    ],
  },
  balanced: {
    messages: [
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message: "Thanks for setting up our home profile. When should we schedule the HVAC service?",
        },
        daysAgo: 4,
      },
      {
        sender: "agent",
        kind: "text",
        payload: {
          message:
            "I have a few trusted contractors — I'll share options and can coordinate scheduling for you.",
        },
        daysAgo: 4,
      },
      {
        sender: "homeowner",
        kind: "text",
        payload: {
          message: "Sounds good. Let's aim for sometime in the next two weeks.",
        },
        daysAgo: 3,
      },
    ],
    inquiries: [
      {
        kind: "message",
        payload: { message: "Can you review the inspection findings before we book contractors?" },
      },
    ],
  },
};

function getConversationThread(focus) {
  return CONVERSATION_THREADS[focus] || CONVERSATION_THREADS.balanced;
}

/** Varied health scores so agent portfolio cards don't look identical. */
const HPS_BY_INDEX = {
  1: 76,
  2: 58,
  3: 84,
  4: 67,
};

/** Synthetic page-view counts (last 7 days) per demo property index. */
const VIEW_COUNTS_BY_INDEX = {
  1: 9,
  2: 14,
  3: 6,
  4: 11,
};

/**
 * Agent-facing calendar events keyed by demo-properties.json index.
 * Uses descriptive system_name values for the calendar UI.
 */
function getAgentCalendarEventsForProperty(index, propertyId, ownerName, daysAgo, daysFromNow) {
  const owner = ownerName || "Homeowner";
  const byIndex = {
    2: [
      {
        property_id: propertyId,
        system_key: "agentCalendar",
        system_name: `Home Anniversary — ${owner}`,
        scheduled_date: daysFromNow(18),
        recurrence_type: "annually",
        status: "scheduled",
        event_type: "maintenance",
        message_body: "Send a note or small gift celebrating their home purchase anniversary.",
      },
      {
        property_id: propertyId,
        system_key: "agentCalendar",
        system_name: "Listing Appointment — CMA walkthrough",
        scheduled_date: daysFromNow(5),
        scheduled_time: "10:00",
        status: "scheduled",
        event_type: "maintenance",
        message_body: "Prepare comps and recent inspection highlights before the listing consultation.",
      },
      {
        property_id: propertyId,
        system_key: "roof",
        system_name: "Roof inspection follow-up",
        scheduled_date: daysFromNow(12),
        status: "scheduled",
        event_type: "inspection",
        message_body: "Confirm contractor quote for ridge-line shingle repair.",
      },
    ],
    3: [
      {
        property_id: propertyId,
        system_key: "heating",
        system_name: "HVAC seasonal tune-up",
        scheduled_date: daysFromNow(9),
        status: "scheduled",
        event_type: "maintenance",
        contractor_name: "Cascade HVAC Services",
        message_body: "Coordinate furnace service before first cold snap.",
      },
      {
        property_id: propertyId,
        system_key: "agentCalendar",
        system_name: `Homeowner action item — ${owner}`,
        scheduled_date: daysFromNow(3),
        status: "scheduled",
        event_type: "maintenance",
        message_body: "Remind homeowner to approve gutter cleaning quote in Opsy.",
      },
      {
        property_id: propertyId,
        system_key: "gutters",
        system_name: "Gutter cleaning reminder",
        scheduled_date: daysAgo(10),
        status: "completed",
        event_type: "maintenance",
        message_body: "Completed pre-season gutter service.",
      },
    ],
    4: [
      {
        property_id: propertyId,
        system_key: "agentCalendar",
        system_name: "Quarterly check-in call",
        scheduled_date: daysFromNow(7),
        scheduled_time: "14:30",
        status: "scheduled",
        event_type: "maintenance",
        message_body: "Review open inspection checklist items and seasonal maintenance plan.",
      },
      {
        property_id: propertyId,
        system_key: "plumbing",
        system_name: "Homeowner action — guest bath drain",
        scheduled_date: daysFromNow(2),
        status: "scheduled",
        event_type: "maintenance",
        message_body: "Follow up on snaking appointment with Sound Plumbing Pros.",
      },
      {
        property_id: propertyId,
        system_key: "agentCalendar",
        system_name: `Home Anniversary — ${owner}`,
        scheduled_date: daysFromNow(25),
        recurrence_type: "annually",
        status: "scheduled",
        event_type: "maintenance",
        message_body: "Mark the purchase anniversary and send a personal note.",
      },
    ],
  };
  return byIndex[index] || [];
}

/**
 * Maps seeded maintenance events to action items by system_key + title substring.
 * Used after provisioning to populate the Scheduled column on action items.
 */
const DEMO_EVENT_ACTION_ITEM_LINKS = [
  { system_key: "roof", titleContains: "Missing shingles" },
  { system_key: "plumbing", titleContains: "Slow drain" },
  { system_key: "gutters", titleContains: "Clean gutters" },
  { system_key: "heating", titleContains: "Furnace filter" },
];

module.exports = {
  DEMO_BROADCAST_COMMUNICATIONS,
  DEMO_EVENT_ACTION_ITEM_LINKS,
  getIdentityFixtureForIndex,
  getSystemFixturesForProperty,
  getMaintenanceRecordsForProperty,
  getConversationThread,
  getAgentCalendarEventsForProperty,
  HPS_BY_INDEX,
  VIEW_COUNTS_BY_INDEX,
};
