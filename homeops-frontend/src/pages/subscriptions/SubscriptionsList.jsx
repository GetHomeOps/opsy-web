import React, {useState, useEffect, useReducer, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PaginationClassic from "../../components/PaginationClassic";
import Banner from "../../partials/containers/Banner";
import ModalBlank from "../../components/ModalBlank";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import ListDropdown from "../../partials/buttons/ListDropdown";

const PAGE_STORAGE_KEY = "subscriptions_list_page";

const initialState = {
  currentPage: 1,
  itemsPerPage: 10,
  searchTerm: "",
  isLoading: true,
  isSubmitting: false,
  dangerModalOpen: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
  sidebarOpen: false,
  subscriptions: [],
  selectedItems: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CURRENT_PAGE":
      return {...state, currentPage: action.payload};
    case "SET_ITEMS_PER_PAGE":
      return {...state, itemsPerPage: action.payload};
    case "SET_SEARCH_TERM":
      return {...state, searchTerm: action.payload};
    case "SET_LOADING":
      return {...state, isLoading: action.payload};
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
    case "SET_SIDEBAR_OPEN":
      return {...state, sidebarOpen: action.payload};
    case "SET_SUBSCRIPTIONS":
      return {...state, subscriptions: action.payload};
    case "SET_SELECTED_ITEMS":
      return {...state, selectedItems: action.payload};
    default:
      return state;
  }
}

function SubscriptionsList() {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    currentPage: Number(localStorage.getItem(PAGE_STORAGE_KEY)) || 1,
  });

  const navigate = useNavigate();
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  // Sort state
  const [sortConfig, setSortConfig] = useState({key: null, direction: null});

  // Fetch subscriptions on mount
  useEffect(() => {
    async function fetchSubscriptions() {
      try {
        dispatch({type: "SET_LOADING", payload: true});
        const subscriptions = await AppApi.getAllSubscriptions();
        dispatch({type: "SET_SUBSCRIPTIONS", payload: subscriptions || []});
      } catch (err) {
        console.error("Error fetching subscriptions:", err);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: `${t("subscriptions.fetchError")}: ${err.message || err}`,
          },
        });
      } finally {
        dispatch({type: "SET_LOADING", payload: false});
      }
    }
    fetchSubscriptions();
  }, [t]);

  // Persist page number
  useEffect(() => {
    if (state.currentPage) {
      localStorage.setItem(PAGE_STORAGE_KEY, state.currentPage);
    }
  }, [state.currentPage]);

  // Banner timeout
  useEffect(() => {
    if (state.bannerOpen) {
      const timer = setTimeout(() => {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: false,
            type: state.bannerType,
            message: state.bannerMessage,
          },
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.bannerOpen, state.bannerType, state.bannerMessage]);

  // Sorting
  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return {key, direction: "desc"};
        if (prev.direction === "desc") return {key: null, direction: null};
      }
      return {key, direction: "asc"};
    });
  }

  // Filtered and sorted subscriptions
  const filteredSubscriptions = useMemo(() => {
    let items = [...state.subscriptions];

    // Search
    if (state.searchTerm) {
      const searchLower = state.searchTerm.toLowerCase();
      items = items.filter((sub) => {
        const dbName = (sub.databaseName || "").toLowerCase();
        const userName = (sub.userName || "").toLowerCase();
        const userEmail = (sub.userEmail || "").toLowerCase();
        const subType = (sub.subscriptionType || "").toLowerCase();
        const subStatus = (sub.subscriptionStatus || "").toLowerCase();
        const productName = (sub.subscriptionProductName || "").toLowerCase();

        return (
          dbName.includes(searchLower) ||
          userName.includes(searchLower) ||
          userEmail.includes(searchLower) ||
          subType.includes(searchLower) ||
          subStatus.includes(searchLower) ||
          productName.includes(searchLower)
        );
      });
    }

    // Sort
    if (sortConfig.key && sortConfig.direction) {
      items.sort((a, b) => {
        const aVal = (a[sortConfig.key] || "").toString().toLowerCase();
        const bVal = (b[sortConfig.key] || "").toString().toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [state.subscriptions, state.searchTerm, sortConfig]);

  // Current page items
  const currentSubscriptions = useMemo(() => {
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    return filteredSubscriptions.slice(start, end);
  }, [filteredSubscriptions, state.currentPage, state.itemsPerPage]);

  // Reset page if needed
  useEffect(() => {
    if (filteredSubscriptions.length > 0) {
      const maxPage = Math.ceil(
        filteredSubscriptions.length / state.itemsPerPage,
      );
      if (state.currentPage > maxPage) {
        dispatch({type: "SET_CURRENT_PAGE", payload: 1});
      }
    }
  }, [filteredSubscriptions.length, state.itemsPerPage, state.currentPage]);

  // Selection handlers
  function handleToggleSelection(idOrIds, forceState) {
    dispatch({
      type: "SET_SELECTED_ITEMS",
      payload: (() => {
        if (Array.isArray(idOrIds)) {
          if (forceState === false) {
            return state.selectedItems.filter(
              (id) => !idOrIds.includes(id),
            );
          }
          // Toggle all
          const allSelected = idOrIds.every((id) =>
            state.selectedItems.includes(id),
          );
          if (allSelected) {
            return state.selectedItems.filter(
              (id) => !idOrIds.includes(id),
            );
          }
          return [
            ...state.selectedItems,
            ...idOrIds.filter((id) => !state.selectedItems.includes(id)),
          ];
        }
        // Single item toggle
        if (state.selectedItems.includes(idOrIds)) {
          return state.selectedItems.filter((id) => id !== idOrIds);
        }
        return [...state.selectedItems, idOrIds];
      })(),
    });
  }

  const allSelected = useMemo(() => {
    return (
      currentSubscriptions.length > 0 &&
      currentSubscriptions.every((sub) =>
        state.selectedItems.includes(sub.id),
      )
    );
  }, [currentSubscriptions, state.selectedItems]);

  // Navigate to subscription detail (pass nav state for prev/next in form)
  function handleSubscriptionClick(subscription) {
    const visibleIds = filteredSubscriptions.map((s) => s.id);
    const currentIndex = visibleIds.indexOf(subscription.id) + 1;
    navigate(`/${accountUrl}/subscriptions/${subscription.id}`, {
      state: {
        currentIndex,
        totalItems: visibleIds.length,
        visibleSubscriptionIds: visibleIds,
      },
    });
  }

  // Delete handlers
  function handleDeleteClick() {
    if (state.selectedItems.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: t("subscriptions.selectToDelete"),
        },
      });
      return;
    }
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  async function handleDelete() {
    if (state.selectedItems.length === 0) return;

    dispatch({type: "SET_DANGER_MODAL", payload: false});
    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const deletedIds = [];
      for (const subId of state.selectedItems) {
        try {
          await AppApi.deleteSubscription(subId);
          deletedIds.push(subId);
        } catch (error) {
          console.error(`Error deleting subscription ${subId}:`, error);
        }
      }

      if (deletedIds.length > 0) {
        dispatch({
          type: "SET_SUBSCRIPTIONS",
          payload: state.subscriptions.filter(
            (sub) => !deletedIds.includes(sub.id),
          ),
        });
        dispatch({
          type: "SET_SELECTED_ITEMS",
          payload: state.selectedItems.filter(
            (id) => !deletedIds.includes(id),
          ),
        });
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: `${deletedIds.length} ${t("subscriptions.deletedSuccessfully")}`,
          },
        });
      }
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptions.deleteError")}: ${error}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  // Status badge renderer
  function renderStatusBadge(value) {
    const statusColors = {
      active:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      inactive:
        "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300",
      cancelled:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      expired:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      trial:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    };

    const colorClasses =
      statusColors[(value || "").toLowerCase()] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colorClasses}`}
      >
        {value || "—"}
      </span>
    );
  }

  // Table columns
  const columns = [
    {
      key: "databaseName",
      label: t("subscriptions.account"),
      sortable: true,
      render: (value) => value || "—",
    },
    {
      key: "userName",
      label: t("subscriptions.adminUser"),
      sortable: true,
      render: (value) => (
        <span className="font-medium text-gray-800 dark:text-gray-100">
          {value || "—"}
        </span>
      ),
    },
    {
      key: "userEmail",
      label: t("email"),
      sortable: true,
      render: (value) => value || "—",
    },
    {
      key: "subscriptionProductName",
      label: t("subscriptions.subscription"),
      sortable: true,
      render: (value) => (
        <span className="capitalize">{value || "—"}</span>
      ),
    },
    {
      key: "subscriptionStatus",
      label: t("subscriptions.status"),
      sortable: true,
      render: (value) => renderStatusBadge(value),
    },
  ];

  // Custom row renderer
  const renderItem = (item, handleSelect, selectedItems, onItemClick) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selectedItems.includes(item.id)}
      onItemClick={onItemClick}
    />
  );

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
        {/* Site header */}
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
              <div>
                <div className="mb-2">
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {t("subscriptions.deleteTitle", {
                      count: state.selectedItems.length,
                    })}
                  </div>
                </div>
                <div className="text-sm mb-10">
                  <div className="space-y-2">
                    <p>
                      {t("subscriptions.deleteConfirmation")}{" "}
                      {t("actionCantBeUndone")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end space-x-2">
                  <button
                    className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({type: "SET_DANGER_MODAL", payload: false});
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                    onClick={handleDelete}
                    disabled={state.isSubmitting}
                  >
                    {state.isSubmitting ? t("subscriptions.deleting") : t("accept")}
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
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  {t("subscriptions.title")}
                </h1>
              </div>

              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
                {/* Actions dropdown */}
                <ListDropdown
                  align="right"
                  hasSelection={state.selectedItems.length > 0}
                  onDelete={handleDeleteClick}
                />

                {/* Add Subscription button */}
                <button
                  className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
                  onClick={() => navigate(`/${accountUrl}/subscriptions/new`)}
                >
                  <svg
                    className="fill-current shrink-0 xs:hidden"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span className="max-xs:sr-only">
                    {t("subscriptions.addSubscription")}
                  </span>
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm"
                    placeholder={t("subscriptions.searchPlaceholder")}
                    value={state.searchTerm}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_SEARCH_TERM",
                        payload: e.target.value,
                      })
                    }
                  />
                  <div className="absolute inset-0 flex items-center pointer-events-none pl-3">
                    <svg
                      className="shrink-0 fill-current text-gray-400 dark:text-gray-500 ml-1 mr-2"
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
              </div>
            </div>

            {/* Loading state */}
            {state.isLoading ? (
              <div className="flex justify-center items-center py-16">
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{t("subscriptions.loading")}</span>
                </div>
              </div>
            ) : (
              <>
                {/* Table */}
                <DataTable
                  items={currentSubscriptions}
                  columns={columns}
                  onItemClick={handleSubscriptionClick}
                  onSelect={handleToggleSelection}
                  selectedItems={state.selectedItems}
                  totalItems={filteredSubscriptions.length}
                  title="subscriptions.allSubscriptions"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  emptyMessage="subscriptions.noSubscriptionsFound"
                  renderItem={renderItem}
                  allSelected={allSelected}
                />

                {/* Pagination */}
                {filteredSubscriptions.length > 0 && (
                  <div className="mt-8">
                    <PaginationClassic
                      currentPage={state.currentPage}
                      totalItems={filteredSubscriptions.length}
                      itemsPerPage={state.itemsPerPage}
                      onPageChange={(page) =>
                        dispatch({type: "SET_CURRENT_PAGE", payload: page})
                      }
                      onItemsPerPageChange={(value) => {
                        dispatch({
                          type: "SET_ITEMS_PER_PAGE",
                          payload: Number(value),
                        });
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default SubscriptionsList;
