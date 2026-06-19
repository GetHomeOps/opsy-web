/** Shared dynamic import targets for route-level prefetch (must match RoutesList lazy paths). */

export const contactsListImport = () => import("../contacts/ContactsList");

export function prefetchContactsList() {
  return contactsListImport();
}
