import {useEffect, useMemo, useState} from "react";
import useLocalStorage from "./useLocalStorage";
import {useAuth} from "../context/AuthContext";
import {normalizeAccount, resolveCurrentAccount} from "../utils/accountSelection";

// Re-export the pure helpers so existing imports (and tests) keep working.
export {normalizeAccount, resolveCurrentAccount};

export default function useCurrentAccount() {
  const {currentUser} = useAuth();
  const [storedAccount, setStoredAccount] = useLocalStorage(
    "current-account",
    null,
  );
  const userId = currentUser?.id ?? null;
  const [accountUserId, setAccountUserId] = useState(userId);

  // Drop a selection from a previous session in the same render as the user
  // change (e.g. stop impersonation). AuthContext writes the restored user's
  // canonical account to localStorage, but this hook keeps its own React copy —
  // so only clear a selection that belongs to a *different* user, and keep one
  // that already belongs to the new user (the canonical selection).
  if (accountUserId !== userId) {
    const previousUserId = accountUserId;
    setAccountUserId(userId);
    if (
      previousUserId != null &&
      previousUserId !== userId &&
      storedAccount &&
      storedAccount.userId !== userId
    ) {
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
