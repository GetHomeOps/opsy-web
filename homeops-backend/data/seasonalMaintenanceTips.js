"use strict";

const { DEFAULT_REGION } = require("../constants/usClimateRegions");

const SEASONS = ["winter", "spring", "summer", "fall"];

/**
 * Region + season maintenance tips for Customer.io seasonal follow-ups.
 * Keys must match resolveClimateRegion() labels.
 */
const TIPS_BY_REGION = {
  "Pacific Northwest": {
    winter:
      "Check attic insulation and seal attic hatches — heat loss here drives ice dams on wet PNW winters.",
    spring:
      "Clear moss from the roof and gutters before spring rains pick up; moss holds moisture against shingles.",
    summer:
      "Trim branches back from the roof and siding before dry-season wildfire smoke and heat stress the envelope.",
    fall:
      "Clear leaves from gutters and downspouts before the first heavy rain — drainage failures are the top fall call-out here.",
  },
  California: {
    winter:
      "Inspect weatherstripping and door sweeps before winter storms — small gaps let in more moisture than you'd expect.",
    spring:
      "Service irrigation and check for leaks before summer watering restrictions and higher bills kick in.",
    summer:
      "Clear dry brush and debris within five feet of the house — defensible space matters most in peak fire season.",
    fall:
      "Clean roof valleys and gutters before the first atmospheric river — clogged drains cause most fall water intrusion.",
  },
  Southwest: {
    winter:
      "Run ceiling fans on low, clockwise, to circulate warm air without cranking the heat on cool desert nights.",
    spring:
      "Service your AC before the first triple-digit week — capacitors and filters fail most often on the first hot day.",
    summer:
      "Check irrigation drip lines and soaker hoses; a silent leak in summer can spike water bills fast in dry heat.",
    fall:
      "Flush outdoor hose bibs and shut off irrigation to exposed lines before the first overnight freeze in the high desert.",
  },
  "Mountain West": {
    winter:
      "Reverse ceiling fans to clockwise on low so warm air circulates down during cold snaps at altitude.",
    spring:
      "Inspect the roof for winter ice-dam damage and reseal flashing before spring snowmelt runoff peaks.",
    summer:
      "Clear pine needles and debris from gutters and roof valleys — afternoon thunderstorms hit hardest on clogged drainage.",
    fall:
      "Drain and winterize outdoor faucets and sprinkler lines before the first hard freeze — burst pipes are common here.",
  },
  "South Central": {
    winter:
      "Insulate exposed pipes in attics, crawl spaces, and garages — a single hard freeze can crack lines fast.",
    spring:
      "Check the roof and attic for hail damage after spring storm season before leaks show up as stains.",
    summer:
      "Service the AC and replace filters before sustained heat — systems run hardest from June through August.",
    fall:
      "Clear gutters and check downspout extensions so heavy fall rains drain away from the foundation.",
  },
  Southeast: {
    winter:
      "Test your sump pump and backup before winter rains — saturated soil keeps basements vulnerable year-round here.",
    spring:
      "Treat for termites and inspect crawl-space vents before humidity climbs — spring is peak swarming season.",
    summer:
      "Check attic ventilation and AC condensate drains — humidity and heat together drive mold and overflow damage.",
    fall:
      "Clear gutters and trim branches over the roof before hurricane season tail and heavy fall rains arrive.",
  },
  "Mid-Atlantic": {
    winter:
      "Seal drafty windows and add door sweeps before sustained cold — small air leaks add up on older row homes and colonials.",
    spring:
      "Inspect the roof and flashing after winter freeze-thaw cycles — lifted shingles often show up in spring.",
    summer:
      "Service the AC and clear condensate lines before the first heat wave — clogged drains are a top summer call.",
    fall:
      "Clean gutters and extend downspouts away from the foundation before nor'easter season ramps up.",
  },
  Northeast: {
    winter:
      "Shut off and drain exterior hose bibs before the first hard freeze — burst pipes in walls are expensive and common.",
    spring:
      "Check the roof for ice-dam damage and reseal attic penetrations once snow melts — leaks follow the thaw.",
    summer:
      "Run dehumidifiers in basements during humid stretches — moisture control prevents musty summers downstairs.",
    fall:
      "Clear leaves from gutters and storm drains before the first freeze — ice dams start with clogged drainage.",
  },
  Midwest: {
    winter:
      "Replace furnace filters and test carbon-monoxide detectors before heating season peaks — furnaces run hard here.",
    spring:
      "Inspect the sump pump and discharge line after snowmelt — spring groundwater is the busiest season for basements.",
    summer:
      "Check window wells and basement window seals before summer storms — heavy rain finds the weakest seal fast.",
    fall:
      "Winterize outdoor faucets and drain sprinkler systems before the first overnight freeze.",
  },
  Alaska: {
    winter:
      "Keep attic ventilation clear so warm air doesn't melt roof snow unevenly — ice dams are severe in long winters.",
    spring:
      "Check roof and siding for frost-heave damage once thaw completes — freeze cycles loosen fasteners quietly.",
    summer:
      "Inspect weatherstripping and thresholds — cool summers still bring heavy rain that finds every gap.",
    fall:
      "Service the heating system and seal drafts before daylight shortens — heating season starts early and runs long.",
  },
  Hawaii: {
    winter:
      "Check lanai and window seals before winter trade-wind rains — wind-driven rain penetrates worn caulking fast.",
    spring:
      "Inspect the roof for lifted tabs or membrane wear before spring shower season intensifies.",
    summer:
      "Clear debris from gutters and roof valleys before hurricane season — drainage fails first in heavy downpours.",
    fall:
      "Trim trees away from the roof before winter swells — falling branches are the most common storm damage here.",
  },
  National: {
    winter:
      "Test smoke and carbon-monoxide detectors and replace HVAC filters before heating season peaks.",
    spring:
      "Walk the exterior and check caulking around windows, doors, and penetrations before spring rains.",
    summer:
      "Service the AC and clear condensate drains before the hottest weeks — most summer failures are preventable.",
    fall:
      "Clear gutters and downspouts before the first heavy rain — ten minutes now saves a headache later.",
  },
};

function getTipsForRegion(region) {
  const key = String(region || "").trim() || DEFAULT_REGION;
  return TIPS_BY_REGION[key] || TIPS_BY_REGION[DEFAULT_REGION];
}

module.exports = {
  SEASONS,
  TIPS_BY_REGION,
  getTipsForRegion,
};
