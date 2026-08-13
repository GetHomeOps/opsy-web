import React, {
  useState,
  useEffect,
  useReducer,
  useMemo,
  useContext,
} from "react";
import {useNavigate, useParams} from "react-router-dom";

import {useTranslation} from "react-i18next";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PaginationClassic from "../../components/PaginationClassic";
import userContext from "../../context/UserContext";
import AppApi, {
  API_ERROR_CODES,
  getApiErrorMessage,
  getUserDeleteErrorMessage,
} from "../../api/api";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import FilterDropdown from "../../components/FilterDropdown";
import SearchInput from "../../components/SearchInput";
import UsersTable from "./UsersTable";
import ListDropdown from "../../partials/buttons/ListDropdown";
import SendPendingInvitationsModal from "../properties/partials/SendPendingInvitationsModal";
import {useAuth} from "../../context/AuthContext";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {canCreateUsersOnDemo, isDemoSite} from "../../utils/demoSite";
import usePersistListUiSession, {
  HYDRATE_LIST_UI,
} from "../../hooks/usePersistListUiSession";
import {getUserAccountStatus} from "./userSort";
import {isAdminRole} from "../../utils/roles";

const USER_FILTER_CATEGORIES = [
  {type: "role", labelKey: "role"},
  {type: "status", labelKey: "status"},
];

const STATUS_OPTIONS = [
  {value: "active", labelKey: "active", color: "#2a9f52"},
  {value: "onboarding", labelKey: "users.statusOnboarding", color: "#ca8a04"},
  {value: "pending", labelKey: "pending", color: "#e63939"},
  {value: "expired", labelKey: "demoAccountExpiredBadge", color: "#d97706"},
];

const ROLE_COLORS = {
  admin: "#6366f1",
  agent: "#3b82f6",
  assistant: "#0d9488",
  homeowner: "#22c55e",
  super_admin: "#9333ea",
  superadmin: "#9333ea",
};

const PAGE_STORAGE_KEY = "users_list_page";

function isSuperAdminUserRole(role) {
  const r = String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  return r === "super_admin" || r === "superadmin";
}

const initialState = {
  currentPage: 1,
  itemsPerPage: 10,
  searchTerm: "",
  activeFilters: [],
  isSubmitting: false,
  dangerModalOpen: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
  filteredUsers: [],
  sidebarOpen: false,
  ownershipTransferModalOpen: false,
  ownershipTransferLabels: [],
  accountHasPropertiesModalOpen: false,
  accountHasPropertiesLabels: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CURRENT_PAGE":
      return {...state, currentPage: action.payload};
    case "SET_ITEMS_PER_PAGE":
      return {...state, itemsPerPage: action.payload};
    case "SET_SEARCH_TERM":
      return {...state, searchTerm: action.payload};
    case "ADD_FILTER": {
      const exists = state.activeFilters.some(
        (f) =>
          f.type === action.payload.type && f.value === action.payload.value,
      );
      if (exists) return state;
      return {
        ...state,
        activeFilters: [...state.activeFilters, action.payload],
        currentPage: 1,
      };
    }
    case "REMOVE_FILTER":
      return {
        ...state,
        activeFilters: state.activeFilters.filter(
          (f) =>
            !(
              f.type === action.payload.type && f.value === action.payload.value
            ),
        ),
        currentPage: 1,
      };
    case "CLEAR_FILTERS":
      return {...state, activeFilters: [], currentPage: 1};
    case "SET_SUBMITTING":
      return {...state, isSubmitting: action.payload};
    case "SET_DANGER_MODAL":
      return {...state, dangerModalOpen: action.payload};
    case "SET_BANNER":
      return {
        ...state,
        bannerOpen: action.payload.open,
        bannerType: action.payload.type,
        bannerMessage: action.payload.message,
      };
    case "SET_FILTERED_USERS":
      return {
        ...state,
        filteredUsers: action.payload,
      };
    case "SET_SIDEBAR_OPEN":
      return {...state, sidebarOpen: action.payload};
    case "SET_OWNERSHIP_TRANSFER_MODAL":
      return {
        ...state,
        ownershipTransferModalOpen: action.payload.open,
        ownershipTransferLabels: action.payload.labels ?? [],
      };
    case "SET_ACCOUNT_HAS_PROPERTIES_MODAL":
      return {
        ...state,
        accountHasPropertiesModalOpen: action.payload.open,
        accountHasPropertiesLabels: action.payload.labels ?? [],
      };
    case HYDRATE_LIST_UI: {
      const p = action.payload || {};
      const next = {...state};
      if (typeof p.searchTerm === "string") next.searchTerm = p.searchTerm;
      if (Array.isArray(p.activeFilters)) next.activeFilters = p.activeFilters;
      if (Number.isFinite(Number(p.itemsPerPage)))
        next.itemsPerPage = Number(p.itemsPerPage);
      if (Number.isFinite(Number(p.currentPage)))
        next.currentPage = Number(p.currentPage);
      return next;
    }
    default:
      return state;
  }
}

/* List of Users + Create new User button

Props:

State:
- filteredUsers: filtered list of users by search term (on search bar)
- currentPage: current page number
- itemsPerPage: number of items per page
- searchTerm: search term
- isSubmitting: whether the form is being submitted
- dangerModalOpen: whether the danger modal is open
- sidebarOpen: whether the sidebar is open

UsersList -> UsersTable, PaginationClassic

*/
function UsersList() {
  const {
    users,
    usersLoading,
    selectedItems,
    setSelectedItems,
    handleToggleSelection,
    sortedUsers,
    sortConfig,
    handleSort,
    deleteUser,
    createUserInvitation,
    refetchUsers,
  } = useContext(userContext);
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const {accountUrl} = useParams();
  const {currentUser, startImpersonation, impersonation} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const canCreateUser = canCreateUsersOnDemo(currentUser);
  const [impersonateTarget, setImpersonateTarget] = useState(null);
  const [resendingInvitationUserId, setResendingInvitationUserId] =
    useState(null);
  const [sendPendingInvitesOpen, setSendPendingInvitesOpen] = useState(false);
  const isPlatformAdmin = isAdminRole(currentUser?.role);
  const listScopeId = accountUrl ? `users:${accountUrl}` : "";

  // Set up component's initial state
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    currentPage: Number(localStorage.getItem(PAGE_STORAGE_KEY)) || 1,
  });

  usePersistListUiSession(listScopeId, {
    dispatch,
    searchTerm: state.searchTerm,
    activeFilters: state.activeFilters,
    itemsPerPage: state.itemsPerPage,
    currentPage: state.currentPage,
  });

  // Refetch users when navigating to this page to ensure all users are loaded
  useEffect(() => {
    refetchUsers?.();
  }, [refetchUsers]);

  // Derive filter options from users (unique roles)
  const uniqueRoles = useMemo(() => {
    if (!sortedUsers || sortedUsers.length === 0) return [];
    const roles = [
      ...new Set(
        sortedUsers
          .map((u) => (u.role || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const roleLabels = {
      admin: "Admin",
      agent: "Agent",
      assistant: "Assistant",
      homeowner: "Homeowner",
      super_admin: "Super Admin",
      superadmin: "Super Admin",
    };
    return roles
      .sort((a, b) => (roleLabels[a] || a).localeCompare(roleLabels[b] || b))
      .map((r) => ({
        value: r,
        label: roleLabels[r] || r.charAt(0).toUpperCase() + r.slice(1),
        dot: ROLE_COLORS[r] || "#6b7280",
      }));
  }, [sortedUsers]);

  const filterOptions = useMemo(() => {
    const statusOptions = STATUS_OPTIONS.filter(
      (s) => s.value !== "expired" || isDemoSite(),
    ).map((s) => ({
      value: s.value,
      label:
        t(s.labelKey) ||
        (s.value === "expired"
          ? "Expired"
          : s.value === "onboarding"
            ? "Onboarding"
            : s.value),
      dot: s.color,
    }));
    return {
      role: uniqueRoles,
      status: statusOptions,
    };
  }, [uniqueRoles, t]);

  // Memoize filtered users based on search term and active filters
  const filteredUsers = useMemo(() => {
    if (!users || users.length === 0) return [];

    // Get the sorted users from context
    if (!sortedUsers || sortedUsers.length === 0) return [];

    const filtersByType = {};
    state.activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    let filtered = sortedUsers;

    // Apply search filter
    if (state.searchTerm) {
      const searchLower = state.searchTerm.toLowerCase();
      filtered = filtered.filter((user) => {
        const userName = (user.name || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        const phone = (user.phone || "").toLowerCase();
        const role = (user.role || "").toLowerCase();
        const accountUrl = (user.accountUrl || "").toLowerCase();

        return (
          userName.includes(searchLower) ||
          email.includes(searchLower) ||
          phone.includes(searchLower) ||
          role.includes(searchLower) ||
          accountUrl.includes(searchLower)
        );
      });
    }

    // Apply role filter
    if (filtersByType.role?.length) {
      filtered = filtered.filter((user) => {
        const userRole = (user.role || "").trim().toLowerCase();
        return filtersByType.role.includes(userRole);
      });
    }

    // Apply status filter (expired wins over active/pending on demo)
    if (filtersByType.status?.length) {
      filtered = filtered.filter((user) => {
        const userStatus = getUserAccountStatus(user);
        return filtersByType.status.includes(userStatus);
      });
    }

    return filtered;
  }, [state.searchTerm, state.activeFilters, users, sortedUsers]);

  // Validate current page - reset to page 1 if current page is invalid
  useEffect(() => {
    if (filteredUsers.length > 0) {
      const maxPage = Math.ceil(filteredUsers.length / state.itemsPerPage);
      if (state.currentPage > maxPage) {
        dispatch({type: "SET_CURRENT_PAGE", payload: 1});
      }
    }
  }, [filteredUsers.length, state.itemsPerPage, state.currentPage]);

  // Update localStorage when page changes
  useEffect(() => {
    if (state.currentPage) {
      localStorage.setItem(PAGE_STORAGE_KEY, state.currentPage);
    }
  }, [state.currentPage]);

  // Handle navigation to user details
  const handleUserClick = (user) => {
    if (!user || !user.id) return;

    const currentIndex = filteredUsers.findIndex((c) => c.id === user.id) + 1;
    const totalItems = filteredUsers.length;
    const visibleUserIds = filteredUsers.map((c) => c.id);

    navigate(`/${accountUrl}/users/${user.id}`, {
      state: {
        currentIndex,
        totalItems,
        visibleContactIds: visibleUserIds,
      },
    });
  };

  // Handle page change
  const handlePageChange = (page) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: page});
  };

  // Handle items per page change
  function handleItemsPerPageChange(value) {
    dispatch({type: "SET_ITEMS_PER_PAGE", payload: Number(value)});
  }

  function handleNewUserClick() {
    navigate(`/${accountUrl}/users/new`);
    dispatch({type: "SET_SIDEBAR_OPEN", payload: false});
  }

  /* Handles delete button click */
  function handleDeleteClick() {
    if (selectedItems.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: "Please select at least one user to delete",
        },
      });
      return;
    }
    const selectedUserObjs = filteredUsers.filter((u) =>
      selectedItems.includes(u.id),
    );
    if (selectedUserObjs.some((u) => isSuperAdminUserRole(u.role))) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message:
            t("userDeleteSuperAdminBlocked") ||
            "Super admin accounts cannot be deleted.",
        },
      });
      return;
    }
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  /* Handles bulk deletion of selected users */
  async function handleDelete() {
    if (selectedItems.length === 0) return;

    // Close modal immediately when Accept is clicked
    dispatch({type: "SET_DANGER_MODAL", payload: false});

    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      // Store the IDs of successfully deleted users
      const deletedIds = [];
      const alreadyDeletedIds = [];
      const failureMessages = [];

      const ownershipTransferLabels = [];
      const accountHasPropertiesLabels = [];

      // Delete each selected user
      for (const userId of selectedItems) {
        const row = filteredUsers.find((x) => x.id === Number(userId));
        if (row && isSuperAdminUserRole(row.role)) {
          failureMessages.push(
            t("userDeleteSuperAdminBlocked") ||
              "Super admin accounts cannot be deleted.",
          );
          continue;
        }
        try {
          const res = await deleteUser(userId);
          if (res) {
            deletedIds.push(userId);
            if (res.alreadyDeleted) {
              alreadyDeletedIds.push(userId);
            }
          }
        } catch (error) {
          if (error?.code === API_ERROR_CODES.PROPERTY_OWNER) {
            const u = filteredUsers.find((x) => x.id === Number(userId));
            ownershipTransferLabels.push(u?.name || u?.email || `#${userId}`);
          } else if (error?.code === API_ERROR_CODES.ACCOUNT_HAS_PROPERTIES) {
            const u = filteredUsers.find((x) => x.id === Number(userId));
            accountHasPropertiesLabels.push(u?.name || u?.email || `#${userId}`);
          } else {
            failureMessages.push(
              getUserDeleteErrorMessage(error, "Could not delete user."),
            );
          }
          // Continue with other deletions even if one fails
        }
      }

      if (alreadyDeletedIds.length > 0) {
        await refetchUsers?.();
      }

      if (ownershipTransferLabels.length > 0) {
        dispatch({
          type: "SET_OWNERSHIP_TRANSFER_MODAL",
          payload: {
            open: true,
            labels: [...new Set(ownershipTransferLabels)],
          },
        });
      }

      if (accountHasPropertiesLabels.length > 0) {
        dispatch({
          type: "SET_ACCOUNT_HAS_PROPERTIES_MODAL",
          payload: {
            open: true,
            labels: [...new Set(accountHasPropertiesLabels)],
          },
        });
      }

      const uniqueFailures = [...new Set(failureMessages)];
      const failedCount = selectedItems.length - deletedIds.length;
      const staleDeleteMessage =
        t("userDeleteStaleRecordMessage") ||
        "This user no longer exists. The list has been refreshed.";

      // Only show success if at least one user was deleted
      if (deletedIds.length > 0) {
        // Clear all successfully deleted items from selection at once
        handleToggleSelection(deletedIds, false);

        // If we're on a page that might be empty after deletion, go back one page
        const remainingItems = filteredUsers.length - deletedIds.length;
        const currentPageItems = state.itemsPerPage;
        if (
          state.currentPage > 1 &&
          remainingItems <= (state.currentPage - 1) * currentPageItems
        ) {
          dispatch({type: "SET_CURRENT_PAGE", payload: state.currentPage - 1});
        }

        let bannerType = "success";
        let message = `${deletedIds.length} user${
          deletedIds.length !== 1 ? "s" : ""
        } deleted successfully`;
        if (alreadyDeletedIds.length > 0 && alreadyDeletedIds.length === deletedIds.length) {
          bannerType = "warning";
          message = staleDeleteMessage;
        } else if (alreadyDeletedIds.length > 0) {
          bannerType = "warning";
          message = `${message}. ${alreadyDeletedIds.length} user${
            alreadyDeletedIds.length !== 1 ? "s were" : " was"
          } already removed from the system.`;
        }
        if (uniqueFailures.length > 0) {
          bannerType = "warning";
          const detail =
            uniqueFailures.length === 1
              ? uniqueFailures[0]
              : uniqueFailures.join("; ");
          message = `${message}. ${failedCount} user${
            failedCount !== 1 ? "s" : ""
          } could not be deleted: ${detail}`;
        }

        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: bannerType,
            message,
          },
        });
      } else if (uniqueFailures.length > 0) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message:
              uniqueFailures.length === 1
                ? uniqueFailures[0]
                : uniqueFailures.join("; "),
          },
        });
      } else {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message:
              t("userBulkDeleteNoResultMessage") ||
              "Unable to delete the selected user(s). Please refresh and try again.",
          },
        });
      }
    } catch (error) {
      console.error("Error in bulk deletion:", error);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: getApiErrorMessage(
            error,
            t("userBulkDeleteFailedMessage") ||
              "Could not delete users. Please try again.",
          ),
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  async function handleReconcileBilling(user) {
    if (!user?.id) return;
    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      const res = await AppApi.reconcileUserBilling(user.id);
      await refetchUsers?.();
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: res?.message
            ? `${res.message}${res.updated ? ` (${res.updated} subscription${res.updated !== 1 ? "s" : ""} synced)` : ""}`
            : "Billing reconciliation completed.",
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: getApiErrorMessage(
            error,
            "Billing reconciliation failed. Please retry or check Stripe configuration.",
          ),
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  async function handleResendInvitation(user) {
    const email = user?.email;
    if (!user?.id || !email) return;
    if (!currentAccount?.id) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message:
            t("invitationAccountMissing") ||
            "Could not determine an account to send the invitation from.",
        },
      });
      return;
    }
    setResendingInvitationUserId(user.id);
    try {
      const result = await createUserInvitation({
        inviteeEmail: email,
        accountId: currentAccount.id,
        intendedRole: "member",
        type: "account",
      });
      if (result?.invitation) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message:
              t("confirmationEmailMessage")?.replace("{{email}}", email) ||
              `Invitation email sent to ${email}.`,
          },
        });
      } else {
        throw new Error("No invitation returned");
      }
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: getApiErrorMessage(
            error,
            "Failed to send invitation email. Please try again.",
          ),
        },
      });
    } finally {
      setResendingInvitationUserId(null);
    }
  }

  function handleImpersonateClick(user) {
    setImpersonateTarget(user);
  }

  async function handleConfirmImpersonate() {
    if (!impersonateTarget?.id) return;
    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      const user = await startImpersonation(impersonateTarget.id);
      setImpersonateTarget(null);
      const targetAccountUrl =
        user?.accounts?.[0]?.url ||
        impersonateTarget?.accountUrl ||
        accountUrl;
      navigate(targetAccountUrl ? `/${targetAccountUrl}/home` : "/");
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: getApiErrorMessage(
            error,
            "Unable to impersonate this user. Please try again.",
          ),
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        sidebarOpen={state.sidebarOpen}
        setSidebarOpen={(open) =>
          dispatch({type: "SET_SIDEBAR_OPEN", payload: open})
        }
      />

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header
          sidebarOpen={state.sidebarOpen}
          setSidebarOpen={(open) =>
            dispatch({type: "SET_SIDEBAR_OPEN", payload: open})
          }
        />

        {/* Banner */}
        <div className="fixed right-0 w-auto sm:w-full z-50">
          <Banner
            type={state.bannerType}
            open={state.bannerOpen}
            setOpen={(open) =>
              dispatch({
                type: "SET_BANNER",
                payload: {
                  open,
                  type: state.bannerType,
                  message: state.bannerMessage,
                },
              })
            }
            className={`transition-opacity duration-600 ${
              state.bannerOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {state.bannerMessage}
          </Banner>
        </div>

        {/* Danger Modal */}
        <div className="m-1.5">
          <ModalBlank
            id="impersonate-modal"
            modalOpen={!!impersonateTarget}
            setModalOpen={(open) => {
              if (!open) setImpersonateTarget(null);
            }}
            contentClassName="max-w-lg"
          >
            <div className="p-5 flex space-x-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30">
                <svg
                  className="shrink-0 text-amber-600 dark:text-amber-400"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Impersonate {impersonateTarget?.name || "user"}?
                  </div>
                </div>
                <div className="text-sm mb-10 text-gray-600 dark:text-gray-300">
                  <p>
                    You will view the app as{" "}
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {impersonateTarget?.name}
                    </span>{" "}
                    ({impersonateTarget?.email}). All actions during this session
                    are logged.
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                    onClick={() => setImpersonateTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-sm bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleConfirmImpersonate}
                    disabled={state.isSubmitting}
                  >
                    {state.isSubmitting ? "Starting..." : "Impersonate"}
                  </button>
                </div>
              </div>
            </div>
          </ModalBlank>
        </div>

        <div className="m-1.5">
          <ModalBlank
            id="danger-modal"
            modalOpen={state.dangerModalOpen}
            setModalOpen={(open) =>
              dispatch({type: "SET_DANGER_MODAL", payload: open})
            }
            contentClassName="max-w-lg"
          >
            <div className="p-5 flex space-x-4">
              {/* Icon */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
                <svg
                  className="shrink-0 fill-current text-red-500"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
                </svg>
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Modal header */}
                <div className="mb-2">
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Delete {selectedItems.length} user
                    {selectedItems.length !== 1 ? "s" : ""}?
                  </div>
                </div>
                {/* Modal content */}
                <div className="text-sm mb-10">
                  <div className="space-y-2">
                    <p>
                      {t("userDeleteConfirmationMessage") ||
                        "Are you sure you want to delete this user?"}
                      {selectedItems.length !== 1 ? "s" : ""}?{" "}
                      {t("actionCantBeUndone") ||
                        "This action cannot be undone."}
                    </p>
                  </div>
                </div>
                {/* Modal footer */}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({type: "SET_DANGER_MODAL", payload: false});
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                    onClick={handleDelete}
                    disabled={state.isSubmitting}
                  >
                    {state.isSubmitting ? "Deleting..." : "Accept"}
                  </button>
                </div>
              </div>
            </div>
          </ModalBlank>
        </div>

        <div className="m-1.5">
          <ModalBlank
            id="ownership-transfer-modal"
            modalOpen={state.ownershipTransferModalOpen}
            setModalOpen={(open) =>
              dispatch({
                type: "SET_OWNERSHIP_TRANSFER_MODAL",
                payload: {
                  open,
                  labels: open ? state.ownershipTransferLabels : [],
                },
              })
            }
          >
            <div className="p-5 flex space-x-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30">
                <svg
                  className="shrink-0 fill-current text-amber-600 dark:text-amber-400"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  aria-hidden
                >
                  <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2">
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {t("userDeleteTransferOwnershipTitle") ||
                      "Transfer ownership first"}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-6 space-y-3">
                  <p>
                    {t("userDeleteTransferOwnershipBody") ||
                      "This user still owns one or more properties. Transfer property ownership to another team member (Share / Team on the property), then try deleting again."}
                  </p>
                  {state.ownershipTransferLabels.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 text-gray-800 dark:text-gray-200">
                      {state.ownershipTransferLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap justify-end">
                  <button
                    type="button"
                    className="btn-sm bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "SET_OWNERSHIP_TRANSFER_MODAL",
                        payload: {open: false, labels: []},
                      });
                    }}
                  >
                    {t("ok") || "OK"}
                  </button>
                </div>
              </div>
            </div>
          </ModalBlank>
        </div>

        <div className="m-1.5">
          <ModalBlank
            id="account-has-properties-modal"
            modalOpen={state.accountHasPropertiesModalOpen}
            setModalOpen={(open) =>
              dispatch({
                type: "SET_ACCOUNT_HAS_PROPERTIES_MODAL",
                payload: {
                  open,
                  labels: open ? state.accountHasPropertiesLabels : [],
                },
              })
            }
          >
            <div className="p-5 flex space-x-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30">
                <svg
                  className="shrink-0 fill-current text-amber-600 dark:text-amber-400"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  aria-hidden
                >
                  <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2">
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {t("userDeleteAccountHasPropertiesTitle") ||
                      "Account still has properties"}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-6 space-y-3">
                  <p>
                    {t("userDeleteAccountHasPropertiesBody") ||
                      "This user owns a workspace account that still has properties. Assign another account owner or remove all properties first, then try deleting again."}
                  </p>
                  {state.accountHasPropertiesLabels.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 text-gray-800 dark:text-gray-200">
                      {state.accountHasPropertiesLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap justify-end">
                  <button
                    type="button"
                    className="btn-sm bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "SET_ACCOUNT_HAS_PROPERTIES_MODAL",
                        payload: {open: false, labels: []},
                      });
                    }}
                  >
                    {t("ok") || "OK"}
                  </button>
                </div>
              </div>
            </div>
          </ModalBlank>
        </div>

        <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* Page header */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
              {/* Left: Title */}
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  {t("users")}
                </h1>
              </div>

              {/* Right: Actions */}
              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
                {canCreateUser ? (
                  <>
                    <ListDropdown
                      align="right"
                      hasSelection={selectedItems.length > 0}
                      onImport={() => navigate(`/${accountUrl}/users/import`)}
                      onSendPendingInvitations={
                        isPlatformAdmin
                          ? () => setSendPendingInvitesOpen(true)
                          : undefined
                      }
                      onDelete={handleDeleteClick}
                    />

                    {/* Add User button */}
                    <button
                      className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
                      onClick={handleNewUserClick}
                    >
                      <svg
                        className="fill-current shrink-0 xs:hidden"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                      >
                        <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                      </svg>
                      <span className="max-xs:sr-only">{t("addUser")}</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            {/* Search bar with filter */}
            <div className="mb-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <SearchInput
                  placeholder={
                    t("searchUsersPlaceholder") ||
                    t("searchContactsPlaceholder")
                  }
                  value={state.searchTerm}
                  onChange={(e) => {
                    dispatch({
                      type: "SET_SEARCH_TERM",
                      payload: e.target.value,
                    });
                    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
                  }}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <FilterDropdown
                    filterCategories={USER_FILTER_CATEGORIES}
                    filterOptions={filterOptions}
                    activeFilters={state.activeFilters}
                    onAdd={(f) => dispatch({type: "ADD_FILTER", payload: f})}
                    onRemove={(f) =>
                      dispatch({type: "REMOVE_FILTER", payload: f})
                    }
                    t={t}
                  />
                </div>
              </div>

              {/* Active filter chips */}
              {state.activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {state.activeFilters.map((f) => (
                    <span
                      key={`${f.type}-${f.value}`}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                    >
                      <span className="text-emerald-400 dark:text-emerald-500 font-normal">
                        {t(
                          USER_FILTER_CATEGORIES.find((c) => c.type === f.type)
                            ?.labelKey ?? f.type,
                        )}
                        :
                      </span>
                      {f.label}
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({type: "REMOVE_FILTER", payload: f})
                        }
                        className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-colors"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => dispatch({type: "CLEAR_FILTERS"})}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    {t("clearAll", {defaultValue: "Clear all"})}
                  </button>
                </div>
              )}
            </div>
            {/* Table or Grouped View */}
            <>
              <UsersTable
                users={filteredUsers}
                loading={usersLoading}
                onToggleSelect={handleToggleSelection}
                selectedItems={selectedItems}
                totalUsers={filteredUsers.length}
                currentPage={state.currentPage}
                itemsPerPage={state.itemsPerPage}
                onUserClick={handleUserClick}
                sortConfig={sortConfig}
                onSort={handleSort}
                isPlatformAdmin={isPlatformAdmin}
                isSuperAdmin={currentUser?.role === "super_admin"}
                isImpersonating={!!impersonation?.active}
                currentUserId={currentUser?.id}
                onImpersonate={handleImpersonateClick}
                onReconcileBilling={handleReconcileBilling}
                onResendInvitation={handleResendInvitation}
                resendingInvitationUserId={resendingInvitationUserId}
                showDemoExpiry={isDemoSite()}
              />
              {/* Pagination */}
              {filteredUsers.length > 0 && (
                <div className="mt-8">
                  <PaginationClassic
                    currentPage={state.currentPage}
                    totalItems={filteredUsers.length}
                    itemsPerPage={state.itemsPerPage}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                  />
                </div>
              )}
            </>
          </div>
        </main>
      </div>
      <SendPendingInvitationsModal
        modalOpen={sendPendingInvitesOpen}
        setModalOpen={setSendPendingInvitesOpen}
        invitationType="account"
      />
    </div>
  );
}
export default UsersList;
