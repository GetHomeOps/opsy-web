import React, {
  useState,
  useEffect,
  useReducer,
  useMemo,
  useContext,
} from "react";
import {useNavigate, useLocation, useParams} from "react-router-dom";

import {useTranslation} from "react-i18next";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PaginationClassic from "../../components/PaginationClassic";
import userContext from "../../context/UserContext";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import ViewModeDropdown from "../../components/ViewModeDropdown";
import UsersTable from "./UsersTable";
import ListDropdown from "../../partials/buttons/ListDropdown";

const PAGE_STORAGE_KEY = "users_list_page";

const initialState = {
  currentPage: 1,
  itemsPerPage: 10,
  searchTerm: "",
  isSubmitting: false,
  dangerModalOpen: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
  filteredUsers: [],
  sidebarOpen: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CURRENT_PAGE":
      return {...state, currentPage: action.payload};
    case "SET_ITEMS_PER_PAGE":
      return {...state, itemsPerPage: action.payload};
    case "SET_SEARCH_TERM":
      return {...state, searchTerm: action.payload};
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
    selectedItems,
    setSelectedItems,
    handleToggleSelection,
    sortedUsers,
    sortConfig,
    handleSort,
    deleteUser,
    bulkDuplicateUsers,
  } = useContext(userContext);
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const {accountUrl} = useParams();

  // Set up component's initial state
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    currentPage: Number(localStorage.getItem(PAGE_STORAGE_KEY)) || 1,
  });

  // Memoize filtered users based on search term
  const filteredUsers = useMemo(() => {
    if (!users || users.length === 0) return [];

    // Get the sorted users from context
    if (!sortedUsers || sortedUsers.length === 0) return [];

    // If no search term, return all sorted users
    if (!state.searchTerm) return sortedUsers;

    // Filter the sorted users based on search term
    const searchLower = state.searchTerm.toLowerCase();
    const filtered = sortedUsers.filter((user) => {
      const userName = (user.name || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const phone = (user.phone || "").toLowerCase();
      const role = (user.role || "").toLowerCase();

      return (
        userName.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower) ||
        role.includes(searchLower)
      );
    });

    return filtered;
  }, [state.searchTerm, users, sortedUsers]);

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

  console.log("Users: ", users);

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
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  /* Handles bulk duplication of selected users */
  async function handleDuplicate() {
    if (selectedItems.length === 0) return;

    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      const duplicatedUsers = await bulkDuplicateUsers(selectedItems);

      // Show success message
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: `${duplicatedUsers.length} user${
            duplicatedUsers.length !== 1 ? "s" : ""
          } duplicated successfully`,
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Error duplicating users. Error: ${error}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
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

      // Delete each selected user
      for (const userId of selectedItems) {
        try {
          const res = await deleteUser(userId);
          if (res) {
            deletedIds.push(userId);
          }
        } catch (error) {
          console.error(`Error deleting user ${userId}:`, error);
          // Continue with other deletions even if one fails
        }
      }

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

        // Show success message
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: `${deletedIds.length} user${
              deletedIds.length !== 1 ? "s" : ""
            } deleted successfully`,
          },
        });
      } else {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: "No users were deleted. Please try again.",
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
          message: `Error deleting users. Please try again.`,
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
            id="danger-modal"
            modalOpen={state.dangerModalOpen}
            setModalOpen={(open) =>
              dispatch({type: "SET_DANGER_MODAL", payload: open})
            }
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
              <div>
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
                <div className="flex flex-wrap justify-end space-x-2">
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

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
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
                <ListDropdown
                  align="right"
                  hasSelection={selectedItems.length > 0}
                  onImport={() => navigate(`/${accountUrl}/users/import`)}
                  onDelete={handleDeleteClick}
                  onDuplicate={handleDuplicate}
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
              </div>
            </div>
            {/* Search bar with integrated view mode selector */}
            <div className="mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm "
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
                  <div className="absolute inset-0 flex items-center pointer-events-none pl-3">
                    <svg
                      className="shrink-0 fill-current text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400 ml-1 mr-2"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M7 14c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zM7 2C4.243 2 2 4.243 2 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
                      <path d="M15.707 14.293L13.314 11.9a8.019 8.019 0 01-1.414 1.414l2.393 2.393a.997.997 0 001.414 0 .999.999 0 000-1.414z" />
                    </svg>
                  </div>
                </div>
                <ViewModeDropdown
                /* viewMode={viewMode}
                  setViewMode={setViewMode} */
                />
              </div>
            </div>
            {/* Table or Grouped View */}
            <>
              <UsersTable
                users={filteredUsers}
                onToggleSelect={handleToggleSelection}
                selectedItems={selectedItems}
                totalUsers={filteredUsers.length}
                currentPage={state.currentPage}
                itemsPerPage={state.itemsPerPage}
                onUserClick={handleUserClick}
                sortConfig={sortConfig}
                onSort={handleSort}
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
    </div>
  );
}
export default UsersList;
