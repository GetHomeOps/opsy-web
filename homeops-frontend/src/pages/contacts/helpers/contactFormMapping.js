import {countries} from "../../../data/countries";

export const initialFormData = {
  name: "",
  email: "",
  phone: "",
  website: "",
  jobPosition: "",
  countryCode: "USA", // Default to USA
  contactType: "individual", // Default to individual
  image: "",
  image_url: "",
  // Contact tab fields
  street1: "",
  street2: "",
  city: "",
  zip: "",
  state: "",
  country: "USA",
  // Notes tab field
  notes: "",
  // New fields
  linkedCompany: "",
  tags: [],
};

/**
 * Maps backend contact data to frontend form format.
 * Handles country code conversion (2-letter to 3-letter) and type mapping.
 */
export function mapBackendToFrontend(backendData) {
  if (!backendData) return initialFormData;

  // Find country by code or name
  // Backend uses 2-letter codes (US), frontend uses 3-letter codes (USA)
  // IMPORTANT: Use country name as primary source since 2-letter codes can be ambiguous
  // (e.g., "ES" matches both Spain ESP and Estonia EST)
  let country = null;

  // First, try to find by country name (most reliable and unambiguous)
  if (backendData.country) {
    country = countries.find((c) => c.name === backendData.country);
  }

  // If country name not found, try to find by matching 2-letter code
  // But note: this can be ambiguous, so we only use it as a fallback
  if (!country && backendData.country_code) {
    const matchingCountries = countries.filter(
      (c) =>
        c.countryCode.substring(0, 2) ===
        backendData.country_code.toUpperCase(),
    );

    if (matchingCountries.length === 1) {
      country = matchingCountries[0];
    }
  }

  // Last resort: try by countryCode if provided (3-letter code)
  if (!country && backendData.countryCode) {
    country = countries.find((c) => c.countryCode === backendData.countryCode);
  }

  return {
    name: backendData.name || "",
    email: backendData.email || "",
    phone: backendData.phone || "",
    website: backendData.website || "",
    image: backendData.image || "",
    image_url: backendData.image_url || "",
    // Map backend 'type' (number) to frontend 'contactType' (string)
    // 1 = individual, 2 = company
    contactType:
      backendData.type === 2
        ? "company"
        : backendData.type === 1
          ? "individual"
          : backendData.contactType || "individual",
    // Map backend 'zip_code' to frontend 'zip'
    zip: backendData.zip_code || backendData.zip || "",
    state: backendData.state || "",
    city: backendData.city || "",
    street1: backendData.street1 || "",
    street2: backendData.street2 || "",
    // Map backend 'country_code' (2-letter) to frontend 'countryCode' (3-letter)
    countryCode: country?.countryCode || backendData.countryCode || "USA",
    // Map backend 'country' (full name) to frontend 'country'
    country: backendData.country || country?.name || "United States",
    notes: backendData.notes || "",
    // Keep UI-only fields (not in backend)
    jobPosition: backendData.jobPosition || "",
    linkedCompany: backendData.linkedCompany || "",
    // tags from backend: [{ id, name, color }, ...] -> form stores tag ids
    tags: Array.isArray(backendData.tags)
      ? backendData.tags.map((t) => (typeof t === "object" && t?.id != null ? t.id : t))
      : [],
  };
}

/**
 * Maps frontend form data to backend contact format.
 * Handles country code conversion (3-letter to 2-letter) and type mapping.
 */
export function mapFrontendToBackend(formData) {
  // Find country by countryCode (frontend uses 3-letter codes like "USA")
  // Always use countryCode as the source of truth to ensure consistency
  const country = countries.find((c) => c.countryCode === formData.countryCode);

  return {
    name: formData.name,
    image: formData.image || "",
    // Map frontend 'contactType' (string) to backend 'type' (number)
    // "individual" = 1, "company" = 2
    type:
      formData.contactType === "company"
        ? 2
        : formData.contactType === "individual"
          ? 1
          : 1,
    phone: formData.phone || "",
    email: formData.email || "",
    website: formData.website || "",
    street1: formData.street1 || "",
    street2: formData.street2 || "",
    city: formData.city || "",
    state: formData.state || "",
    zip_code: formData.zip || "",
    // Use the country name from the country object found by countryCode,
    // or fall back to formData.country if country object not found
    country: country?.name || formData.country || "United States",
    // Convert 3-letter code (USA) to 2-letter code (US) for backend
    // Always derive from countryCode to ensure consistency
    country_code:
      country?.countryCode?.substring(0, 2).toUpperCase() ||
      (formData.countryCode?.length >= 2
        ? formData.countryCode.substring(0, 2).toUpperCase()
        : "US"),
    notes: formData.notes || "",
    tagIds: Array.isArray(formData.tags)
      ? formData.tags.map((id) => Number(id)).filter((n) => !Number.isNaN(n))
      : [],
  };
}
