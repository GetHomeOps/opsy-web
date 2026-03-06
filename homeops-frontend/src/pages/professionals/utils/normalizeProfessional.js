/** 1x1 transparent pixel - avoids empty src warning, no network request */
const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function normalizeProfessional(apiPro) {
  if (!apiPro) return null;

  const serviceArea = apiPro.service_area
    || (apiPro.city && apiPro.state ? `${apiPro.city}, ${apiPro.state}` : null)
    || "";

  const projectPhotos = (apiPro.photos || []).map((p) => {
    const url = p.photo_url || p.url || PLACEHOLDER_IMG;
    return { id: p.id, url, caption: p.caption || "Project" };
  });

  const profileUrl = apiPro.profile_photo_url || apiPro.profile_photo || PLACEHOLDER_IMG;
  if (projectPhotos.length === 0) {
    projectPhotos.push({ id: "profile", url: profileUrl, caption: "Profile" });
  }

  return {
    id: apiPro.id,
    contactName: apiPro.contact_name || "",
    companyName: apiPro.company_name || "",
    name: apiPro.company_name || [apiPro.first_name, apiPro.last_name].filter(Boolean).join(" ") || "",
    categoryId: apiPro.category_id || apiPro.subcategory_id,
    categoryIds: [apiPro.category_id, apiPro.subcategory_id].filter(Boolean),
    categoryName: apiPro.subcategory_name || apiPro.category_name || "",
    location: apiPro.city && apiPro.state
      ? { label: `${apiPro.city}, ${apiPro.state} ${apiPro.zip_code || ""}`.trim(), city: apiPro.city, state: apiPro.state, zip: apiPro.zip_code }
      : null,
    serviceArea,
    rating: Number(apiPro.rating) || 0,
    reviewCount: Number(apiPro.review_count) || 0,
    yearsInBusiness: Number(apiPro.years_in_business) || 0,
    description: apiPro.description || "",
    languages: Array.isArray(apiPro.languages) ? apiPro.languages : [],
    phone: apiPro.phone || "",
    email: apiPro.email || "",
    photoUrl: profileUrl,
    website: apiPro.website || "",
    saved: Boolean(apiPro.saved),
    projectPhotos: projectPhotos.length > 0 ? projectPhotos : [],
    budgetLevel: apiPro.budget_level,
    isVerified: Boolean(apiPro.is_verified),
  };
}
