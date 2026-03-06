import { useState, useEffect } from "react";
import useLocalStorage from "./useLocalStorage";
import { useAuth } from "../context/AuthContext";

export default function useCurrentAccount() {
  const { currentUser } = useAuth();
  const [currentAccount, setCurrentAccount] = useLocalStorage("current-account", null);

  useEffect(() => {
    if (!currentUser) {
      if (currentAccount) {
        setCurrentAccount(null);
      }
      return;
    }

    if (currentUser.accounts && currentUser.accounts.length > 0) {
      const storedAccountBelongsToUser =
        currentAccount?.id &&
        currentUser.accounts.some((a) => a.id === currentAccount.id);

      if (!storedAccountBelongsToUser) {
        const firstAccount = currentUser.accounts[0];
        setCurrentAccount({
          id: firstAccount.id,
          name: firstAccount.name,
          url: firstAccount.url?.replace(/^\/+/, "") || firstAccount.name,
        });
      }
    } else if (currentAccount) {
      setCurrentAccount(null);
    }
  }, [currentUser, currentAccount, setCurrentAccount]);

  const setSelectedAccount = (accountIdentifier) => {
    if (!currentUser || !currentUser.accounts) return;

    let account;
    if (typeof accountIdentifier === "object" && accountIdentifier.id) {
      account = accountIdentifier;
    } else {
      account = currentUser.accounts.find(
        (a) => a.id === accountIdentifier || a.id === Number(accountIdentifier)
      );
    }

    if (account) {
      setCurrentAccount({
        id: account.id,
        name: account.name,
        url: account.url?.replace(/^\/+/, "") || account.name,
      });
    }
  };

  return { currentAccount, setSelectedAccount };
}
