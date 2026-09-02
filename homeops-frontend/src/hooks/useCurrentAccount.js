import {useEffect, useMemo, useState} from "react";
import useLocalStorage from "./useLocalStorage";
import {useAuth} from "../context/AuthContext";

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

export default function useCurrentAccount() {
  const {currentUser} = useAuth();
  const [storedAccount, setStoredAccount] = useLocalStorage(
    "current-account",
    null,
  );
  const userId = currentUser?.id ?? null;
  const [accountUserId, setAccountUserId] = useState(userId);

  // Drop a selection from a previous session in the same render as the user
  // change (e.g. stop impersonation). AuthContext only clears localStorage, not
  // this hook's React state — and each caller has its own copy.
  if (accountUserId !== userId) {
    const previousUserId = accountUserId;
    setAccountUserId(userId);
    if (previousUserId != null && previousUserId !== userId && storedAccount) {
      setStoredAccount(null);
    }
  }

  const currentAccount = useMemo(
    () => resolveCurrentAccount(currentUser, storedAccount),
    [currentUser, storedAccount],
  );

  useEffect(() => {
    if (!currentUser) {
      if (storedAccount) setStoredAccount(null);
      return;
    }

    if (!currentAccount) {
      if (storedAccount) setStoredAccount(null);
      return;
    }

    const needsSync =
      storedAccount?.id !== currentAccount.id ||
      storedAccount?.userId !== currentUser.id;
    if (needsSync) {
      setStoredAccount(currentAccount);
    }
  }, [currentUser, currentAccount, storedAccount, setStoredAccount]);

  const setSelectedAccount = (accountIdentifier) => {
    if (!currentUser || !currentUser.accounts) return;

    let account;
    if (typeof accountIdentifier === "object" && accountIdentifier.id) {
      account = accountIdentifier;
    } else {
      account = currentUser.accounts.find(
        (a) => a.id === accountIdentifier || a.id === Number(accountIdentifier),
      );
    }

    if (account) {
      setStoredAccount(normalizeAccount(account, currentUser.id));
    }
  };

  return {currentAccount, setSelectedAccount};
}
