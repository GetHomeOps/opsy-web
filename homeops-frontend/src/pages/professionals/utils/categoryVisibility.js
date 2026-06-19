export function shouldShowEmptyCategories(userRole) {
  return userRole === "super_admin";
}

export function categoryHasProfessionals(category) {
  return (category?.proCount ?? category?.professional_count ?? 0) > 0;
}

export function filterVisibleCategories(categories, userRole) {
  if (shouldShowEmptyCategories(userRole)) return categories;
  return categories.filter(categoryHasProfessionals);
}
