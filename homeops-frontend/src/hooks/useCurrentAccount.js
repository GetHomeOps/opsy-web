import {useEffect, useMemo} from "react";
import useLocalStorage from "./useLocalStorage";
import {useAuth} from "../context/AuthContext";

function normalizeAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    url: account.url?.replace(/^\/+/, "") || account.name,
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

    const belongsToUser =
      storedAccount?.id &&
      currentUser.accounts.some((a) => a.id === storedAccount.id);

    if (belongsToUser) {
      return normalizeAccount(storedAccount);
    }

    return normalizeAccount(currentUser.accounts[0]);
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

    if (storedAccount?.id !== currentAccount.id) {
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
      setStoredAccount(normalizeAccount(account));
    }
  };

  return {currentAccount, setSelectedAccount};
}
