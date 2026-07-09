import React, {createContext, useState, useContext, useEffect, useCallback, useMemo} from "react";
import {useTableSort} from "../hooks/useTableSort";
import AppApi, {isStaleUserRecordError} from "../api/api";
import {useAuth} from "./AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import {compareUsersForSort} from "../pages/users/userSort";

const UserContext = createContext();

/* Context for Users */
export function UserProvider({children}) {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const {currentUser, isLoading} = useAuth();
  const {currentAccount} = useCurrentAccount();

  const customListComparators = useMemo(
    () => ({
      name: (a, b, direction) => compareUsersForSort(a, b, "name", direction),
      email: (a, b, direction) => compareUsersForSort(a, b, "email", direction),
      role: (a, b, direction) => compareUsersForSort(a, b, "role", direction),
      status: (a, b, direction) => compareUsersForSort(a, b, "status", direction),
      demoExpiresAt: (a, b, direction) =>
        compareUsersForSort(a, b, "demoExpiresAt", direction),
      billingState: (a, b, direction) =>
        compareUsersForSort(a, b, "billingState", direction),
    }),
    [],
  );

  const {
    sortedItems: listSortedItems,
    sortConfig: listSortConfig,
    handleSort: handleListSort,
  } = useTableSort(users, "name", false, {
    storageKey: "users-sort",
    customComparators: customListComparators,
  });

  const fetchUsers = useCallback(async () => {
    if (isLoading || !currentUser) return;

    try {
      setUsersLoading(true);
      let fetchedUsers;

      if (currentUser.role === "super_admin") {
        fetchedUsers = await AppApi.getAllUsers();
      } else if (currentUser.role === "admin" && currentAccount?.id) {
        fetchedUsers = await AppApi.getUsersByAccountId(currentAccount.id);
      } else {
        fetchedUsers = [];
      }

      setUsers(fetchedUsers);
      setSelectedItems((prev) => {
        const validIds = new Set(fetchedUsers.map((user) => Number(user.id)));
        const next = prev.filter((id) => validIds.has(Number(id)));
        return next.length === prev.length ? prev : next;
      });
    } catch (err) {
      console.error("There was an error retrieving users:", err);
      setUsers([]);
      setSelectedItems([]);
    } finally {
      setUsersLoading(false);
    }
  }, [isLoading, currentUser, currentAccount?.id]);

  useEffect(() => {
    setUsers([]);
    setUsersLoading(true);
    setSelectedItems([]);
  }, [currentAccount?.id]);

  // The users list (admin/super-admin only) is not needed for first paint.
  // Defer the initial load to browser idle time so it does not compete with
  // the active page's own data fetches.
  useEffect(() => {
    if (isLoading || !currentUser) return;
    const schedule =
      typeof window !== "undefined" && window.requestIdleCallback
        ? window.requestIdleCallback
        : (cb) => setTimeout(cb, 200);
    const cancel =
      typeof window !== "undefined" && window.cancelIdleCallback
        ? window.cancelIdleCallback
        : clearTimeout;
    const handle = schedule(() => fetchUsers(), {timeout: 2000});
    return () => cancel(handle);
  }, [fetchUsers, isLoading, currentUser]);

  const refetchUsers = useCallback(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* Handle selection state */
  const handleToggleSelection = (ids, isSelected) => {
    if (Array.isArray(ids)) {
      if (typeof isSelected === "boolean") {
        setSelectedItems((prev) => {
          if (isSelected) {
            return [...new Set([...prev, ...ids])];
          } else {
            return prev.filter((id) => !ids.includes(id));
          }
        });
      } else {
        setSelectedItems(ids);
      }
    } else {
      setSelectedItems((prev) => {
        if (prev.includes(ids)) {
          return prev.filter((id) => id !== ids);
        } else {
          return [...prev, ids];
        }
      });
    }
  };

  // Create a new user (admin-created, pending until invitation is accepted)
  const createUser = async (userData) => {
    try {
      const user = await AppApi.adminCreateUser(userData);
      if (user && user.id) {
        setUsers((prevUsers) => [...prevUsers, user]);
        return user;
      }
      throw new Error("Could not create user");
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  };

  const createUserInvitation = async ({ inviteeEmail, accountId, propertyId, intendedRole, type = 'account' }) => {
    try {
      const res = await AppApi.createInvitation({
        type,
        inviteeEmail,
        accountId,
        propertyId,
        intendedRole,
      });

      const token = res?.token;

      if (token && inviteeEmail) {
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.email === inviteeEmail ? { ...user, confirmationToken: token } : user,
          ),
        );
        return { token, invitation: res.invitation };
      }

      throw new Error("Token not returned from backend");
    } catch (error) {
      console.error("Error creating invitation:", error);
      throw error;
    }
  };

  const confirmInvitation = async (data) => {
    try {
      const res = await AppApi.confirmInvitation(data);
      return res;
    } catch (error) {
      console.error("Error confirming invitation:", error);
      throw error;
    }
  };

  // Delete a user
  const deleteUser = async (id) => {
    try {
      const res = await AppApi.deleteUser(id);
      if (!res) {
        throw new Error("Could not delete user.");
      }
      // Remove user from context immediately (like ContactContext does)
      setUsers((prevUsers) =>
        prevUsers.filter((user) => user.id !== Number(id)),
      );
      return res;
    } catch (error) {
      if (isStaleUserRecordError(error)) {
        setUsers((prevUsers) =>
          prevUsers.filter((user) => user.id !== Number(id)),
        );
        return {deleted: id, alreadyDeleted: true};
      }
      console.error("Error deleting user:", error);
      throw error;
    }
  };

  const contextValue = useMemo(
    () => ({
      users,
      usersLoading,
      selectedItems,
      setSelectedItems,
      handleToggleSelection,
      setUsers,
      createUser,
      deleteUser,
      createUserInvitation,
      confirmInvitation,
      refetchUsers,
      sortedUsers: listSortedItems,
      sortConfig: listSortConfig,
      handleSort: handleListSort,
    }),
    [users, usersLoading, selectedItems, listSortedItems, listSortConfig, handleListSort, refetchUsers],
  );

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export default UserContext;
