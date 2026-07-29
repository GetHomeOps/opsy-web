/** Shared dynamic import targets for route-level prefetch (must match RoutesList lazy paths). */

export const contactsListImport = () => import("../contacts/ContactsList");

export function prefetchContactsList() {
  return contactsListImport();
}

export const propertiesListImport = () =>
  import("../properties/PropertiesList");

export function prefetchPropertiesList() {
  return propertiesListImport();
}

export const prePurchaseDashboardImport = () =>
  import("../pre-purchase/PrePurchaseDashboard");

export function prefetchPrePurchaseDashboard() {
  return prePurchaseDashboardImport();
}
