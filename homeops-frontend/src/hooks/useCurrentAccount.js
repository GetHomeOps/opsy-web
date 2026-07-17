import {useEffect, useMemo} from "react";
import useLocalStorage from "./useLocalStorage";
import {useAuth} from "../context/AuthContext";

function normalizeAccount(account, userId) {
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    url: account.url?.replace(/^\/+/, "") || account.name,
    ...(userId != null ? {userId} : {}),
  };
}

export default function useCurrentAccount() {
  const {currentUser} = useAuth();
  const [storedAccount, setStoredAccount] = useLocalStorage(
    "current-account",
    null,
  );

  const currentAccount = useMemo(() => {
    if (!currentUser?.accounts?.length) return null;

    // Ignore a selection from a different user session (e.g. after stopping
    // impersonation). AuthContext only clears localStorage, not React state.
    const storedForThisUser =
      storedAccount?.id &&
      storedAccount.userId === currentUser.id &&
      currentUser.accounts.some((a) => a.id === storedAccount.id);

    if (storedForThisUser) {
      return normalizeAccount(storedAccount, currentUser.id);
    }

    return normalizeAccount(currentUser.accounts[0], currentUser.id);
  }, [currentUser, storedAccount]);

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
