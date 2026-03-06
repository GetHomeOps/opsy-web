import React, {createContext, useState, useContext, useEffect} from "react";
import {useTableSort} from "../hooks/useTableSort";
import AppApi from "../api/api";
import {useAuth} from "./AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";

const UserContext = createContext();

/* Context for Users */
export function UserProvider({children}) {
  const [users, setUsers] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const {currentUser, isLoading} = useAuth();
  const {currentAccount} = useCurrentAccount();

  const customListComparators = {
    // Generic comparator that works for any field
    default: (a, b, direction, key) => {
      const valueA = (a[key] || "").toString().toLowerCase();
      const valueB = (b[key] || "").toString().toLowerCase();
      return direction === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    },
  };

  const {
    sortedItems: listSortedItems,
    sortConfig: listSortConfig,
    handleSort: handleListSort,
  } = useTableSort(users, "name", false, {
    storageKey: "users-sort",
    customComparators: customListComparators,
  });

  const fetchUsers = async () => {
    if (isLoading || !currentUser) return;

    try {
      let fetchedUsers;

      if (currentUser.role === "super_admin") {
        fetchedUsers = await AppApi.getAllUsers();
      } else if (currentUser.role === "admin" && currentAccount?.id) {
        fetchedUsers = await AppApi.getUsersByAccountId(currentAccount.id);
      } else {
        fetchedUsers = [];
      }

      setUsers(fetchedUsers);
    } catch (err) {
      console.error("There was an error retrieving users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isLoading, currentUser, currentAccount]);

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
      let res = await AppApi.deleteUser(id);

      if (res) {
        // Remove user from context immediately (like ContactContext does)
        setUsers((prevUsers) =>
          prevUsers.filter((user) => user.id !== Number(id)),
        );
        return res;
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  };

  // Generate unique email for duplicate users
  const generateUniqueEmail = (originalEmail) => {
    if (!originalEmail) return "";
    const [localPart, domain] = originalEmail.split("@");
    if (!domain) return originalEmail;

    let counter = 1;
    let newEmail = `${localPart}_copy${counter}@${domain}`;

    // Check if email already exists, increment counter if needed
    while (users.some((user) => user.email === newEmail)) {
      counter++;
      newEmail = `${localPart}_copy${counter}@${domain}`;
    }

    return newEmail;
  };

  // Generate unique name for duplicate users
  const generateUniqueName = (originalName) => {
    if (!originalName) return "";

    let counter = 1;
    let newName = `${originalName} (Copy ${counter})`;

    // Check if name already exists, increment counter if needed
    while (users.some((user) => (user.name || user.fullName) === newName)) {
      counter++;
      newName = `${originalName} (Copy ${counter})`;
    }

    return newName;
  };

  // Duplicate a user
  const duplicateUser = async (userToDuplicate) => {
    if (!userToDuplicate) return null;

    try {
      const uniqueEmail = generateUniqueEmail(userToDuplicate.email);
      const uniqueName = generateUniqueName(
        userToDuplicate.name || userToDuplicate.fullName,
      );

      // Generate a random password for the duplicate
      const generateRandomPassword = () => {
        const length = 16;
        const charset =
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        for (let i = 0; i < length; i++) {
          password += charset.charAt(
            Math.floor(Math.random() * charset.length),
          );
        }
        return password;
      };

      const userData = {
        name: uniqueName,
        email: uniqueEmail,
        phone: userToDuplicate.phone || "",
        role: userToDuplicate.role || "",
        contact: userToDuplicate.contact || 0,
        password: generateRandomPassword(),
        is_active: false,
      };

      const res = await createUser(userData);
      return res;
    } catch (error) {
      console.error("Error duplicating user:", error);
      throw error;
    }
  };

  // Handles bulk duplication of selected users
  const bulkDuplicateUsers = async (selectedUserIds) => {
    if (!selectedUserIds || selectedUserIds.length === 0) return [];

    const results = [];

    try {
      // Duplicate each selected user
      for (const userId of selectedUserIds) {
        const userToDuplicate = users.find((user) => user.id === userId);
        if (userToDuplicate) {
          const result = await duplicateUser(userToDuplicate);
          if (result) {
            results.push(result);
          }
        }
      }
      return results;
    } catch (error) {
      throw error;
    }
  };

  return (
    <UserContext.Provider
      value={{
        users,
        selectedItems,
        setSelectedItems,
        handleToggleSelection,
        setUsers,
        createUser,
        deleteUser,
        duplicateUser,
        bulkDuplicateUsers,
        createUserInvitation,
        confirmInvitation,
        sortedUsers: listSortedItems,
        sortConfig: listSortConfig,
        handleSort: handleListSort,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export default UserContext;
