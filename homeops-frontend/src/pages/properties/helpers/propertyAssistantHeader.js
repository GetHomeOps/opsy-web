/**
 * Label lines for AI Assistant when scoping to a property (name + address).
 * Works with PropertyContext list items and property form `identity` objects.
 */
export function getPropertyAssistantHeaderLines(source) {
  if (!source || typeof source !== "object") {
    return {propertyDisplayName: null, propertyAddressLine: null};
  }
  const name =
    (
      source.nickname ||
      source.property_name ||
      source.propertyName ||
      ""
    ).trim() || null;

  let addr = (
    source.full_address ||
    source.fullAddress ||
    source.address ||
    source.street_address ||
    ""
  ).trim();

  if (!addr) {
    const parts = [
      source.address_line_1 || source.addressLine1,
      source.city,
      source.state,
      source.zip,
    ].filter(Boolean);
    if (parts.length) addr = parts.join(", ");
  }
  addr = (addr || "").trim() || null;

  if (name && addr && name === addr) {
    return {propertyDisplayName: name, propertyAddressLine: null};
  }
  return {propertyDisplayName: name, propertyAddressLine: addr};
}
