import {mapPropertyFromBackend} from "./preparePropertyValues";
import {splitFormDataByTabs} from "./formDataByTabs";
import {mapSystemsFromBackend} from "./mapSystemsFromBackend";

/**
 * Builds the SET_PROPERTY payload from refreshed property and systems data.
 * Used after a successful property update to sync form state with the backend.
 *
 * @param {Object} refreshed - Property from getPropertyById (or null)
 * @param {Array} systemsArr - Systems from getSystemsByPropertyId
 * @param {Object} res - Update response (fallback when refreshed is null)
 * @returns {Object} Payload for dispatch({ type: "SET_PROPERTY", payload })
 */
export function buildPropertyPayloadFromRefresh(refreshed, systemsArr, res) {
  const flat =
    mapPropertyFromBackend(refreshed ?? res) ?? refreshed ?? res;
  const tabbed = splitFormDataByTabs(flat);
  const includedSystems = (systemsArr ?? []).filter(
    (s) => s.included !== false
  );
  const fromSystems = mapSystemsFromBackend(includedSystems);
  const selectedIdsFromBackend = includedSystems
    .map((s) => s.system_key ?? s.systemKey)
    .filter((k) => k && !k.startsWith("custom-"));
  const customNamesFromBackend = Object.keys(
    fromSystems.customSystemsData ?? {}
  );

  return {
    ...tabbed,
    systems: {
      ...tabbed.systems,
      ...fromSystems,
      selectedSystemIds:
        selectedIdsFromBackend.length > 0
          ? selectedIdsFromBackend
          : tabbed.systems.selectedSystemIds ?? [],
      customSystemNames:
        customNamesFromBackend.length > 0
          ? customNamesFromBackend
          : tabbed.systems.customSystemNames ?? [],
      customSystemsData:
        fromSystems.customSystemsData ??
        tabbed.systems.customSystemsData ??
        {},
    },
  };
}
