"use strict";

/**
 * Default System Maintenance Recommendations
 *
 * Master library of recommendation templates seeded into
 * `system_recommendation_templates` on first run. Each entry is copied into a
 * property's Action Items (`inspection_checklist_items`) the first time the
 * matching canonical system is added to a property.
 *
 * Keyed by canonical system_key (see services/systemTypes.js CANONICAL_SYSTEMS).
 *
 * Fields per template:
 * - title (string, required)
 * - description (string)
 * - frequency (integer | null)        recurring cadence amount
 * - frequencyUnit ('days'|'weeks'|'months'|'years' | null)
 * - priority ('urgent'|'high'|'medium'|'low')
 * - lifecycleReplacementYears (integer | null)  expected service life before replacement
 */

const DEFAULT_SYSTEM_RECOMMENDATIONS = {
  roof: [
    {
      title: "Annual roof inspection",
      description:
        "Inspect shingles, tiles, and flashing for damage, missing pieces, and wear.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Remove debris and clear valleys",
      description:
        "Clear leaves, branches, and debris from the roof surface and valleys to prevent water pooling.",
      frequency: 6,
      frequencyUnit: "months",
      priority: "low",
    },
    {
      title: "Inspect and reseal flashing",
      description:
        "Check flashing around chimneys, vents, and skylights and reseal as needed.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Replace roof covering",
      description:
        "Plan for full roof replacement once shingles reach the end of their expected service life.",
      frequency: null,
      frequencyUnit: null,
      priority: "high",
      lifecycleReplacementYears: 20,
    },
  ],
  gutters: [
    {
      title: "Clean gutters and downspouts",
      description:
        "Remove leaves and debris so water drains freely and away from the home.",
      frequency: 6,
      frequencyUnit: "months",
      priority: "medium",
    },
    {
      title: "Inspect gutter seams and brackets",
      description:
        "Check for loose brackets, leaking seams, and sagging sections; refasten or seal as needed.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Verify downspout drainage",
      description:
        "Confirm downspouts direct water at least several feet away from the foundation.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
  ],
  foundation: [
    {
      title: "Inspect foundation for cracks",
      description:
        "Look for new or widening cracks in the foundation, walls, and floors.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Check grading and drainage",
      description:
        "Ensure soil slopes away from the foundation to keep water from pooling against it.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Seal minor foundation cracks",
      description:
        "Monitor and seal small cracks before they allow water intrusion.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
  ],
  exterior: [
    {
      title: "Inspect siding and exterior finishes",
      description:
        "Check siding, trim, and finishes for damage, rot, or pest entry points.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Inspect and renew exterior caulking",
      description:
        "Reseal caulking around penetrations, joints, and trim to keep moisture out.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Repaint or reseal exterior surfaces",
      description:
        "Refresh paint or sealant to protect exterior surfaces from weathering.",
      frequency: 5,
      frequencyUnit: "years",
      priority: "medium",
    },
  ],
  windows: [
    {
      title: "Inspect and replace weatherstripping",
      description:
        "Check window weatherstripping and seals; replace worn material to improve efficiency.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Clean and lubricate window tracks",
      description:
        "Clean tracks and lubricate moving parts so windows open and close smoothly.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Recaulk window exteriors",
      description:
        "Inspect and renew exterior caulking around window frames to prevent leaks.",
      frequency: 3,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Replace aging windows",
      description:
        "Plan for window replacement once units reach the end of their service life or lose efficiency.",
      frequency: null,
      frequencyUnit: null,
      priority: "medium",
      lifecycleReplacementYears: 20,
    },
  ],
  heating: [
    {
      title: "Replace furnace air filter",
      description:
        "Swap the furnace/air handler filter to maintain airflow and efficiency.",
      frequency: 3,
      frequencyUnit: "months",
      priority: "medium",
    },
    {
      title: "Annual heating system tune-up",
      description:
        "Have a professional service the furnace or boiler before heating season.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "high",
    },
    {
      title: "Inspect and clean ductwork",
      description:
        "Check ducts for leaks and buildup; clean as needed to maintain airflow.",
      frequency: 3,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Replace heating system",
      description:
        "Plan for furnace or boiler replacement near the end of its expected service life.",
      frequency: null,
      frequencyUnit: null,
      priority: "high",
      lifecycleReplacementYears: 18,
    },
  ],
  ac: [
    {
      title: "Replace AC air filter",
      description:
        "Replace the air conditioner filter to maintain airflow and cooling efficiency.",
      frequency: 3,
      frequencyUnit: "months",
      priority: "medium",
    },
    {
      title: "Annual AC tune-up",
      description:
        "Have a professional service the cooling system before the warm season.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "high",
    },
    {
      title: "Clean condenser coils",
      description:
        "Clear debris and clean the outdoor condenser coils to maintain efficiency.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Replace air conditioning system",
      description:
        "Plan for AC replacement once the system reaches the end of its service life.",
      frequency: null,
      frequencyUnit: null,
      priority: "high",
      lifecycleReplacementYears: 15,
    },
  ],
  waterHeating: [
    {
      title: "Flush water heater tank",
      description:
        "Drain and flush sediment from the tank to extend life and maintain efficiency.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Test temperature & pressure relief valve",
      description:
        "Test the T&P relief valve to confirm it operates safely.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Inspect or replace anode rod",
      description:
        "Check the sacrificial anode rod and replace it to prevent tank corrosion.",
      frequency: 3,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Replace water heater",
      description:
        "Plan for water heater replacement near the end of its expected service life.",
      frequency: null,
      frequencyUnit: null,
      priority: "high",
      lifecycleReplacementYears: 10,
    },
  ],
  electrical: [
    {
      title: "Test GFCI and AFCI outlets",
      description:
        "Test GFCI/AFCI outlets and breakers to confirm they trip correctly.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Inspect electrical panel",
      description:
        "Visually inspect the panel for corrosion, scorching, or loose connections.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Verify breaker labeling",
      description:
        "Confirm breakers are correctly labeled and there are no signs of overload.",
      frequency: 2,
      frequencyUnit: "years",
      priority: "low",
    },
  ],
  plumbing: [
    {
      title: "Inspect for leaks under fixtures",
      description:
        "Check under sinks and around fixtures for leaks, corrosion, and moisture.",
      frequency: 6,
      frequencyUnit: "months",
      priority: "medium",
    },
    {
      title: "Test main and fixture shutoff valves",
      description:
        "Operate shutoff valves to keep them from seizing and confirm they hold.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
    {
      title: "Inspect water supply lines and hoses",
      description:
        "Check supply lines and appliance hoses for wear; replace aging hoses.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Clear slow drains",
      description:
        "Clean and clear slow-running drains to prevent clogs and backups.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "low",
    },
  ],
  safety: [
    {
      title: "Test smoke & CO detectors",
      description:
        "Test all smoke and carbon monoxide detectors to confirm they sound correctly.",
      frequency: 3,
      frequencyUnit: "months",
      priority: "high",
    },
    {
      title: "Replace detector batteries",
      description:
        "Replace batteries in smoke and CO detectors that are not hardwired.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "high",
    },
    {
      title: "Inspect fire extinguishers",
      description:
        "Check fire extinguisher pressure gauges and recharge or replace as needed.",
      frequency: 1,
      frequencyUnit: "years",
      priority: "medium",
    },
    {
      title: "Replace smoke & CO detectors",
      description:
        "Replace detectors once they reach the end of their rated service life.",
      frequency: null,
      frequencyUnit: null,
      priority: "medium",
      lifecycleReplacementYears: 10,
    },
  ],
};

module.exports = { DEFAULT_SYSTEM_RECOMMENDATIONS };
