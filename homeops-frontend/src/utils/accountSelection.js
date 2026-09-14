/**
 * Pure helpers for picking the active account for the logged-in user.
 *
 * Kept dependency-free (no React, no AuthContext) so both `AuthContext` and
 * `useCurrentAccount` can import them without a circular reference.
 */

/** Normalize an account row to the shape stored in `current-account`. */
export function normalizeAccount(account, userId) {
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    url: account.url?.replace(/^\/+/, "") || account.name,
    ...(userId != null ? {userId} : {}),
  };
}

/** Pick the active account, ignoring a selection that belongs to another user. */
export function resolveCurrentAccount(currentUser, storedAccount) {
  if (!currentUser?.accounts?.length) return null;

  const storedForThisUser =
    storedAccount?.id &&
    storedAccount.userId === currentUser.id &&
    currentUser.accounts.some((a) => a.id === storedAccount.id);

  if (storedForThisUser) {
    return normalizeAccount(storedAccount, currentUser.id);
  }

  return normalizeAccount(currentUser.accounts[0], currentUser.id);
}
