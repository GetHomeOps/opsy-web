/**
 * Helpers for filtering and converting suggested systems from inspection analysis
 * to API payloads for adding to a property.
 */

import {
  mapAiSystemTypeToIds,
  toDisplaySystemName,
} from "./aiSystemNormalization";
import {
  slugifyCustomSystemName,
  ensureUniqueSystemKey,
  MAX_SYSTEM_KEY_LENGTH,
} from "./systemKeyUtils";

/**
 * Build a set of existing system keys (lowercase) from property systems.
 * Includes predefined system_keys and custom slugs.
 */
function getExistingSystemKeys(propertySystems = [], customNames = []) {
  const keys = new Set();
  for (const s of propertySystems) {
    const k = (s.system_key ?? s.systemKey ?? "").toString().toLowerCase();
    if (k) keys.add(k);
  }
  for (const name of customNames) {
    const slug = slugifyCustomSystemName(name).toLowerCase();
    if (slug) keys.add(slug);
  }
  return keys;
}

/**
 * Filter suggested systems to only those not already on the property.
 *
 * @param {Array<{ systemType?: string, system_key?: string, reason?: string, confidence?: number }>} suggested
 * @param {Array<{ system_key?: string, systemKey?: string }>} propertySystems
 * @param {string[]} customNames - Custom system names from form
 * @returns {Array} Filtered suggested systems (non-existent only)
 */
export function filterSuggestedSystemsNotOnProperty(
  suggested,
  propertySystems = [],
  customNames = [],
) {
  if (!Array.isArray(suggested) || suggested.length === 0) return [];
  const existingKeys = getExistingSystemKeys(propertySystems, customNames);

  const result = [];
  const addedLabels = new Set();

  for (const s of suggested) {
    const raw = String(s.systemType ?? s.system_key ?? "").trim();
    if (!raw) continue;

    const mappedIds = mapAiSystemTypeToIds(raw);

    if (mappedIds.length > 0) {
      // Predefined: add only the mapped IDs that don't exist
      const toAdd = mappedIds.filter((id) => {
        const key = id.toLowerCase();
        const keySnake = id.replace(/([A-Z])/g, "_$1").toLowerCase();
        return !existingKeys.has(key) && !existingKeys.has(keySnake);
      });
      for (const id of toAdd) {
        if (!addedLabels.has(id.toLowerCase())) {
          addedLabels.add(id.toLowerCase());
          result.push({
            ...s,
            systemType: id,
            _resolvedId: id,
          });
        }
      }
    } else {
      // Custom system
      const displayName = toDisplaySystemName(raw);
      if (!displayName) continue;
      const slug = slugifyCustomSystemName(displayName).toLowerCase();
      if (existingKeys.has(slug)) continue;
      if (addedLabels.has(displayName.toLowerCase())) continue;
      addedLabels.add(displayName.toLowerCase());
      result.push({
        ...s,
        systemType: raw,
        _isCustom: true,
        _displayName: displayName,
      });
    }
  }

  return result;
}

/**
 * Build API payloads for adding suggested systems to a property.
 *
 * @param {Array<{ systemType?: string, _resolvedId?: string, _isCustom?: boolean, _displayName?: string }>} suggested - Filtered suggested systems
 * @param {number} propertyId
 * @returns {Array<{ property_id: number, system_key: string, data: Object, included: boolean }>}
 */
export function buildPayloadsForSuggestedSystems(suggested, propertyId) {
  if (!Array.isArray(suggested) || suggested.length === 0) return [];
  const payloads = [];
  const usedKeys = new Set();

  for (const s of suggested) {
    if (s._isCustom && s._displayName) {
      const systemKey = ensureUniqueSystemKey(
        slugifyCustomSystemName(s._displayName),
        usedKeys,
      );
      payloads.push({
        property_id: propertyId,
        system_key: systemKey,
        data: {},
        included: true,
      });
    } else if (s._resolvedId) {
      const systemKey = ensureUniqueSystemKey(
        s._resolvedId.slice(0, MAX_SYSTEM_KEY_LENGTH),
        usedKeys,
      );
      payloads.push({
        property_id: propertyId,
        system_key: systemKey,
        data: {},
        included: true,
      });
    }
  }

  return payloads;
}
