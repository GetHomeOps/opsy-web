import {PROPERTY_SYSTEMS} from "../constants/propertySystems";

export function normalizeAiSystemToken(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

const AI_SYSTEM_ALIAS_TO_IDS = {
  hvac: ["heating", "ac"],
  heatingcooling: ["heating", "ac"],
  heatingandcooling: ["heating", "ac"],
  furnace: ["heating"],
  boiler: ["heating"],
  airconditioning: ["ac"],
  cooling: ["ac"],
  waterheater: ["waterHeating"],
  waterheating: ["waterHeating"],
  hotwater: ["waterHeating"],
  foundationstructure: ["foundation"],
  structure: ["foundation"],
  structural: ["foundation"],
  framing: ["foundation"],
  windowsdoors: ["windows"],
  doors: ["windows"],
  firesafety: ["safety"],
  smokedetectors: ["safety"],
  codetectors: ["safety"],
  electricalsystem: ["electrical"],
  plumbingsystem: ["plumbing"],
  roofingsystem: ["roof"],
  gutterdrainage: ["gutters"],
  guttersdrainage: ["gutters"],
};

export function toDisplaySystemName(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";
  const withSpaces = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Resolve AI system type into known setup/system IDs.
 * Returns [] when no canonical match exists (caller can treat as custom system).
 */
export function mapAiSystemTypeToIds(rawValue, availableSystems = PROPERTY_SYSTEMS) {
  const raw = String(rawValue || "").trim();
  if (!raw) return [];
  const normalized = normalizeAiSystemToken(raw);
  const allowedIds = new Set((availableSystems || []).map((s) => s.id));

  const aliased = AI_SYSTEM_ALIAS_TO_IDS[normalized] || [];
  if (aliased.length > 0) {
    return aliased.filter((id) => allowedIds.has(id));
  }

  const direct = (availableSystems || []).find((sys) => {
    const idNorm = normalizeAiSystemToken(sys.id);
    const nameNorm = normalizeAiSystemToken(sys.name);
    return (
      idNorm === normalized ||
      nameNorm === normalized ||
      normalized.includes(idNorm) ||
      normalized.includes(nameNorm)
    );
  });
  return direct ? [direct.id] : [];
}

export function getSystemLabelFromAiType(
  rawValue,
  availableSystems = PROPERTY_SYSTEMS,
) {
  const mapped = mapAiSystemTypeToIds(rawValue, availableSystems);
  if (mapped.length > 0) {
    const sys = (availableSystems || []).find((s) => s.id === mapped[0]);
    if (sys?.name) return sys.name;
  }
  return toDisplaySystemName(rawValue) || "General";
}
