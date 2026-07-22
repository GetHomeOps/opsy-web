import React, {useState, useEffect, useReducer, useMemo, useRef} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";

import Sidebar from "../../partials/Sidebar";
import {useAuth} from "../../context/AuthContext";
import Header from "../../partials/Header";
import PaginationClassic from "../../components/PaginationClassic";
import SearchInput from "../../components/SearchInput";
import Banner from "../../partials/containers/Banner";
import ModalBlank from "../../components/ModalBlank";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import ListDropdown from "../../partials/buttons/ListDropdown";
import usePersistListUiSession, {
  HYDRATE_LIST_UI,
} from "../../hooks/usePersistListUiSession";
import useDropdownAlignment from "../../hooks/useDropdownAlignment";

const PAGE_STORAGE_KEY = "subscriptions_list_page";

const FILTER_CATEGORIES = [
  {type: "account", labelKey: "subscriptions.account"},
  {type: "subscriptionType", labelKey: "subscriptions.subscription"},
  {type: "status", labelKey: "subscriptions.status"},
  {type: "userType", labelKey: "subscriptions.userType"},
];

function subscriptionUserTypeDisplayLabel(raw, t) {
  const v = (raw || "").trim().toLowerCase();
  if (v === "agent") return t("subscriptions.userTypeAgents");
  if (v === "homeowner") return t("subscriptions.userTypeHomeowner");
  const s = (raw || "").trim();
  return s || "—";
}

/* Honest billing states derived on the backend:
   paid_active/trialing = Stripe-backed; free/comped = internal rows. */
const BILLING_STATE_ORDER = [
  "paid_active",
  "trialing",
  "past_due",
  "comped",
  "free",
  "signup_incomplete",
  "awaiting_payment",
  "incomplete",
  "canceled",
];

function billingStateLabel(state, t) {
  const labels = {
    paid_active: t("subscriptions.statusPaid"),
    trialing: t("subscriptions.statusTrialing"),
    past_due: t("subscriptions.statusPastDue"),
    comped: t("subscriptions.statusComped"),
    free: t("subscriptions.statusFree"),
    signup_incomplete: t("subscriptions.statusSignupIncomplete"),
    awaiting_payment: t("subscriptions.statusAwaitingPayment"),
    incomplete: t("subscriptions.statusIncomplete"),
    canceled: t("subscriptions.statusCanceled"),
  };
  return labels[state] || state || "—";
}

/* Rank subscriptions so the most billing-relevant row represents each account. */
function billingStateRank(sub) {
  const state = sub.billingState;
  if (state === "paid_active" || state === "trialing") return 0;
  if (state === "comped" || state === "free") return 1;
  if (state === "past_due") return 2;
  return 3;
}

/* Collapse subscription rows to the current/best one per account. */
function pickCurrentPerAccount(subscriptions) {
  const accountsMap = new Map();
  for (const sub of subscriptions) {
    const accountId = sub.accountId ?? "unknown";
    if (!accountsMap.has(accountId)) accountsMap.set(accountId, []);
    accountsMap.get(accountId).push(sub);
  }
  const rows = [];
  for (const [, subs] of accountsMap) {
    const sorted = [...subs].sort((a, b) => {
      const rankDiff = billingStateRank(a) - billingStateRank(b);
      if (rankDiff !== 0) return rankDiff;
      const aTime = new Date(a.currentPeriodEnd || a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.currentPeriodEnd || b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    if (sorted[0]) rows.push({...sorted[0], _historyCount: subs.length});
  }
  return rows;
}

/* Monthly-normalized amount for a subscription row ($/month). */
function monthlyAmount(sub) {
  const price = Number(sub.subscriptionProductPrice) || 0;
  if (price <= 0) return 0;
  return sub.billingInterval === "year" ? price / 12 : price;
}

function formatAmount(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

const SUMMARY_CARD_FILTERS = {
  paying: ["paid_active"],
  trialing: ["trialing"],
  freeInternal: ["free", "comped"],
  attention: ["past_due", "incomplete", "signup_incomplete", "awaiting_payment"],
};

function matchesSummaryCard(statusValues, cardStates) {
  const sorted = [...statusValues].sort();
  const cardSorted = [...cardStates].sort();
  return (
    sorted.length === cardSorted.length &&
    sorted.every((value, index) => value === cardSorted[index])
  );
}

const initialState = {
  currentPage: 1,
  itemsPerPage: 10,
  searchTerm: "",
  activeFilters: [],
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
    case "SET_ACTIVE_FILTERS":
      return {...state, activeFilters: action.payload, currentPage: 1};
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

/* ─── Odoo-style Filter Dropdown ─────────────────────────────── */

function FilterDropdown({filterOptions, activeFilters, onAdd, onRemove, t}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const align = useDropdownAlignment(buttonRef, open);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setActiveCategory(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isFilterActive = (type, value) =>
    activeFilters.some((f) => f.type === type && f.value === value);

  const toggleFilter = (type, value, label) => {
    if (isFilterActive(type, value)) {
      onRemove({type, value});
    } else {
      onAdd({type, value, label});
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setActiveCategory(null);
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        {t("filter")}
        {activeFilters.length > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            {activeFilters.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1.5 z-30 min-w-[200px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {!activeCategory ? (
            <ul className="py-1.5">
              {FILTER_CATEGORIES.map((cat) => {
                const count = activeFilters.filter(
                  (f) => f.type === cat.type,
                ).length;
                return (
                  <li key={cat.type}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      onClick={() => setActiveCategory(cat.type)}
                    >
                      <span>{t(cat.labelKey)}</span>
                      <span className="flex items-center gap-1 text-gray-400">
                        {count > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            {count}
                          </span>
                        )}
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/60 transition-colors"
                onClick={() => setActiveCategory(null)}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t(
                  FILTER_CATEGORIES.find((c) => c.type === activeCategory)
                    ?.labelKey,
                )}
              </button>
              <ul className="py-1.5 max-h-64 overflow-y-auto">
                {(filterOptions[activeCategory] ?? []).map((opt) => {
                  const active = isFilterActive(activeCategory, opt.value);
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        onClick={() =>
                          toggleFilter(activeCategory, opt.value, opt.label)
                        }
                      >
                        <span
                          className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            active
                              ? "bg-violet-500 border-violet-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {active && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </span>
                        {opt.dot && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{backgroundColor: opt.dot}}
                          />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    </li>
                  );
                })}
                {(filterOptions[activeCategory] ?? []).length === 0 && (
                  <li className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">
                    {t("noItemsFound")}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubscriptionsList() {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    currentPage: Number(localStorage.getItem(PAGE_STORAGE_KEY)) || 1,
  });

  const navigate = useNavigate();
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const listScopeId = accountUrl ? `subscriptions:${accountUrl}` : "";

  // Sort state
  const [sortConfig, setSortConfig] = useState({key: null, direction: null});
  const [isSyncing, setIsSyncing] = useState(false);

  usePersistListUiSession(listScopeId, {
    dispatch,
    searchTerm: state.searchTerm,
    activeFilters: state.activeFilters,
    itemsPerPage: state.itemsPerPage,
    currentPage: state.currentPage,
    sortConfig,
    setSortConfig,
  });

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

  // Filter options derived from subscriptions
  const filterOptions = useMemo(() => {
    const subs = state.subscriptions;
    const accounts = [...new Set(subs.map((s) => (s.databaseName || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const products = [...new Set(subs.map((s) => (s.subscriptionProductName || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const statuses = BILLING_STATE_ORDER.filter((s) => subs.some((sub) => sub.billingState === s));
    const userTypes = [...new Set(subs.map((s) => (s.userType || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      account: accounts.map((v) => ({ value: v, label: v })),
      subscriptionType: products.map((v) => ({ value: v, label: v })),
      status: statuses.map((v) => ({ value: v, label: billingStateLabel(v, t) })),
      userType: userTypes.map((v) => ({
        value: v,
        label: subscriptionUserTypeDisplayLabel(v, t),
      })),
    };
  }, [state.subscriptions, t]);

  // Filtered subscriptions (Odoo-style: OR within same type, AND across types)
  const filteredSubscriptions = useMemo(() => {
    const filtersByType = {};
    state.activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    let items = state.subscriptions.filter((sub) => {
      const term = (state.searchTerm || "").toLowerCase();
      if (term) {
        const dbName = (sub.databaseName || "").toLowerCase();
        const userName = (sub.userName || "").toLowerCase();
        const userEmail = (sub.userEmail || "").toLowerCase();
        const subType = (sub.subscriptionType || "").toLowerCase();
        const userType = (sub.userType || "").toLowerCase();
        const subStatus = (sub.subscriptionStatus || "").toLowerCase();
        const stateLabel = billingStateLabel(sub.billingState, t).toLowerCase();
        const productName = (sub.subscriptionProductName || "").toLowerCase();
        const matchesSearch =
          dbName.includes(term) || userName.includes(term) || userEmail.includes(term) ||
          subType.includes(term) || userType.includes(term) || subStatus.includes(term) ||
          stateLabel.includes(term) || productName.includes(term);
        if (!matchesSearch) return false;
      }
      if (filtersByType.account) {
        const acc = (sub.databaseName || "").trim();
        if (!filtersByType.account.includes(acc)) return false;
      }
      if (filtersByType.subscriptionType) {
        const prod = (sub.subscriptionProductName || "").trim();
        if (!filtersByType.subscriptionType.includes(prod)) return false;
      }
      if (filtersByType.status) {
        if (!filtersByType.status.includes(sub.billingState)) return false;
      }
      if (filtersByType.userType) {
        const ut = (sub.userType || "").trim();
        if (!filtersByType.userType.includes(ut)) return false;
      }
      return true;
    });

    return items;
  }, [state.subscriptions, state.searchTerm, state.activeFilters, t]);

  const activeSummaryCard = useMemo(() => {
    const statusValues = state.activeFilters
      .filter((f) => f.type === "status")
      .map((f) => f.value);
    for (const [key, states] of Object.entries(SUMMARY_CARD_FILTERS)) {
      if (matchesSummaryCard(statusValues, states)) return key;
    }
    return null;
  }, [state.activeFilters]);

  function handleSummaryCardClick(cardKey) {
    const cardStates = SUMMARY_CARD_FILTERS[cardKey];
    const statusValues = state.activeFilters
      .filter((f) => f.type === "status")
      .map((f) => f.value);
    const isActive = matchesSummaryCard(statusValues, cardStates);
    const nonStatus = state.activeFilters.filter((f) => f.type !== "status");

    if (isActive) {
      dispatch({type: "SET_ACTIVE_FILTERS", payload: nonStatus});
      return;
    }

    const statusFilters = cardStates.map((value) => ({
      type: "status",
      value,
      label: billingStateLabel(value, t),
    }));
    dispatch({
      type: "SET_ACTIVE_FILTERS",
      payload: [...nonStatus, ...statusFilters],
    });
  }

  // Billing summary across ALL accounts (unfiltered), one row per account
  const billingSummary = useMemo(() => {
    const rows = pickCurrentPerAccount(state.subscriptions);
    const paying = rows.filter((r) => r.billingState === "paid_active");
    const trialing = rows.filter((r) => r.billingState === "trialing");
    const freeInternal = rows.filter((r) => r.billingState === "free" || r.billingState === "comped");
    const attention = rows.filter((r) =>
      ["past_due", "incomplete", "signup_incomplete", "awaiting_payment"].includes(r.billingState),
    );
    const mrr = paying.reduce((sum, r) => sum + monthlyAmount(r), 0);
    return {
      paying: paying.length,
      trialing: trialing.length,
      freeInternal: freeInternal.length,
      attention: attention.length,
      mrr,
    };
  }, [state.subscriptions]);

  // One row per account: pick the current/best subscription per account
  const accountRows = useMemo(() => {
    const rows = pickCurrentPerAccount(filteredSubscriptions);

    if (sortConfig.key && sortConfig.direction) {
      return [...rows].sort((a, b) => {
        const aVal = (a[sortConfig.key] || "").toString().toLowerCase();
        const bVal = (b[sortConfig.key] || "").toString().toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows.sort((a, b) =>
      (a.databaseName || "").localeCompare(b.databaseName || ""),
    );
  }, [filteredSubscriptions, sortConfig]);

  // Current page items
  const currentAccountRows = useMemo(() => {
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    return accountRows.slice(start, end);
  }, [accountRows, state.currentPage, state.itemsPerPage]);

  // Reset page if needed
  useEffect(() => {
    if (accountRows.length > 0) {
      const maxPage = Math.ceil(accountRows.length / state.itemsPerPage);
      if (state.currentPage > maxPage) {
        dispatch({type: "SET_CURRENT_PAGE", payload: 1});
      }
    }
  }, [accountRows.length, state.itemsPerPage, state.currentPage]);

  // Selection handlers
  function handleToggleSelection(idOrIds, forceState) {
    dispatch({
      type: "SET_SELECTED_ITEMS",
      payload: (() => {
        if (Array.isArray(idOrIds)) {
          if (forceState === false) {
            return state.selectedItems.filter((id) => !idOrIds.includes(id));
          }
          // Toggle all
          const allSelected = idOrIds.every((id) =>
            state.selectedItems.includes(id),
          );
          if (allSelected) {
            return state.selectedItems.filter((id) => !idOrIds.includes(id));
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
      currentAccountRows.length > 0 &&
      currentAccountRows.every((sub) => state.selectedItems.includes(sub.id))
    );
  }, [currentAccountRows, state.selectedItems]);

  // Navigate to subscription detail (pass nav state for prev/next in form)
  function handleSubscriptionClick(subscription) {
    const visibleIds = accountRows.map((s) => s.id);
    const currentIndex = visibleIds.indexOf(subscription.id) + 1;
    navigate(`/${accountUrl}/subscriptions/${subscription.id}`, {
      state: {
        currentIndex,
        totalItems: visibleIds.length,
        visibleSubscriptionIds: visibleIds,
      },
    });
  }

  function handleSelectVisibleRows() {
    const ids = currentAccountRows.map((sub) => sub.id);
    if (ids.length === 0) return;
    handleToggleSelection(ids);
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
          payload: state.selectedItems.filter((id) => !deletedIds.includes(id)),
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

  async function handleRefreshFromStripe() {
    try {
      setIsSyncing(true);
      const res = await AppApi.syncStripeSubscriptions();
      const subscriptions = await AppApi.getAllSubscriptions();
      dispatch({type: "SET_SUBSCRIPTIONS", payload: subscriptions || []});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: res?.message ?? t("subscriptions.syncSuccess"),
        },
      });
    } catch (err) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptions.syncError")}: ${err.message || err}`,
        },
      });
    } finally {
      setIsSyncing(false);
    }
  }

  // Billing state badge renderer (honest states: paid vs trial vs internal)
  function renderBillingStateBadge(item) {
    const stateColors = {
      paid_active:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      trialing:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      past_due:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      signup_incomplete:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      awaiting_payment:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      comped:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      free: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
      incomplete:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      canceled:
        "bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400",
    };

    const colorClasses =
      stateColors[item.billingState] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";

    return (
      <div className="flex flex-col items-start gap-0.5">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}
        >
          {billingStateLabel(item.billingState, t)}
        </span>
        {item.cancelAtPeriodEnd &&
          ["paid_active", "trialing"].includes(item.billingState) && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              {t("subscriptions.cancelsAtPeriodEnd")}
            </span>
          )}
      </div>
    );
  }

  // Subscription type badge renderer (colored pill similar to status)
  function renderSubscriptionTypeBadge(value) {
    const typeColors = {
      free:
        "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
      beta:
        "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
      maintain:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      growth:
        "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
      win:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      enterprise:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    };

    const normalized = (value || "").toLowerCase().trim();
    const colorClasses =
      typeColors[normalized] ||
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
      label: t("subscriptions.owner"),
      sortable: true,
      render: (value, item) => (
        <div className="min-w-0">
          <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
            {value || "—"}
          </div>
          {item.userEmail && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {item.userEmail}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "userType",
      label: t("subscriptions.userType"),
      sortable: true,
      render: (value) => (
        <span>{subscriptionUserTypeDisplayLabel(value, t)}</span>
      ),
    },
    {
      key: "subscriptionProductName",
      label: t("subscriptions.plan"),
      sortable: true,
      render: (value) => renderSubscriptionTypeBadge(value),
    },
    {
      key: "subscriptionProductPrice",
      label: t("subscriptions.amount"),
      sortable: true,
      render: (value, item) => {
        const price = Number(value) || 0;
        if (price <= 0) {
          return (
            <span className="text-gray-500 dark:text-gray-400">
              {t("subscriptions.statusFree")}
            </span>
          );
        }
        return (
          <span className="font-medium text-gray-800 dark:text-gray-100">
            {formatAmount(price)}
            <span className="font-normal text-gray-500 dark:text-gray-400">
              /{item.billingInterval === "year" ? t("subscriptions.perYear") : t("subscriptions.perMonth")}
            </span>
          </span>
        );
      },
    },
    {
      key: "source",
      label: t("subscriptions.source"),
      sortable: true,
      render: (value, item) =>
        value === "stripe" ? (
          <a
            href={`https://dashboard.stripe.com/subscriptions/${item.stripeSubscriptionId}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={t("subscriptions.sourceStripeHint")}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
          >
            {t("subscriptions.sourceStripe")}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        ) : (
          <span
            title={t("subscriptions.sourceInternalHint")}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400"
          >
            {t("subscriptions.sourceInternal")}
          </span>
        ),
    },
    {
      key: "currentPeriodStart",
      label: t("subscriptions.startDate"),
      sortable: true,
      render: (value) =>
        value
          ? new Date(value).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
    },
    {
      key: "currentPeriodEnd",
      label: t("subscriptions.endDate"),
      sortable: true,
      render: (value) =>
        value
          ? new Date(value).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
    },
    {
      key: "trialDaysRemaining",
      label: t("subscriptions.trialRemaining"),
      sortable: true,
      render: (value, item) => {
        if (item.billingState !== "trialing") {
          return <span className="text-gray-400 dark:text-gray-500">—</span>;
        }
        if (value == null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
        if (value === 0) {
          return (
            <span className="text-amber-600 dark:text-amber-400 font-medium text-sm">
              {t("subscriptions.trialEndsToday")}
            </span>
          );
        }
        if (value === 1) {
          return (
            <span className="text-blue-700 dark:text-blue-300 font-medium text-sm">
              {t("subscriptions.trialOneDayLeft")}
            </span>
          );
        }
        return (
          <span className="text-blue-700 dark:text-blue-300 font-medium text-sm">
            {t("subscriptions.trialDaysLeft", {count: value})}
          </span>
        );
      },
    },
    {
      key: "billingState",
      label: t("subscriptions.status"),
      sortable: true,
      render: (value, item) => renderBillingStateBadge(item),
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
            contentClassName="max-w-lg"
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
              <div className="flex-1 min-w-0">
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
                <div className="flex flex-wrap justify-end gap-2">
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
                    {state.isSubmitting
                      ? t("subscriptions.deleting")
                      : t("accept")}
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
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  {t("subscriptions.title")}
                </h1>
              </div>

              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
                <ListDropdown
                  align="right"
                  hasSelection={state.selectedItems.length > 0}
                  onDelete={handleDeleteClick}
                  onRefreshFromStripe={
                    isSuperAdmin ? handleRefreshFromStripe : undefined
                  }
                  isRefreshingFromStripe={isSyncing}
                />
              </div>
            </div>

            {/* Billing summary cards — click to filter the table by billing state */}
            {!state.isLoading && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  {
                    key: "paying",
                    label: t("subscriptions.summaryPaying"),
                    count: billingSummary.paying,
                    activeRing: "ring-green-500/40 border-green-300 dark:border-green-600",
                    children: (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {t("subscriptions.summaryMrr")} {formatAmount(billingSummary.mrr)}
                      </span>
                    ),
                  },
                  {
                    key: "trialing",
                    label: t("subscriptions.summaryTrialing"),
                    count: billingSummary.trialing,
                    activeRing: "ring-blue-500/40 border-blue-300 dark:border-blue-600",
                  },
                  {
                    key: "freeInternal",
                    label: t("subscriptions.summaryFreeInternal"),
                    count: billingSummary.freeInternal,
                    activeRing: "ring-gray-400/50 border-gray-300 dark:border-gray-500",
                  },
                  {
                    key: "attention",
                    label: t("subscriptions.summaryAttention"),
                    count: billingSummary.attention,
                    activeRing: "ring-red-500/40 border-red-300 dark:border-red-600",
                    countClass:
                      billingSummary.attention > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-800 dark:text-gray-100",
                  },
                ].map((card) => {
                  const isActive = activeSummaryCard === card.key;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleSummaryCardClick(card.key)}
                      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 px-4 py-3 text-left transition-all hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                        isActive ? `ring-2 ${card.activeRing}` : ""
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {card.label}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span
                          className={`text-2xl font-bold ${
                            card.countClass || "text-gray-800 dark:text-gray-100"
                          }`}
                        >
                          {card.count}
                        </span>
                        {card.children}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search bar + Filters */}
            <div className="mb-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <SearchInput
                  placeholder={t("subscriptions.searchPlaceholder")}
                  value={state.searchTerm}
                  onChange={(e) => {
                    dispatch({type: "SET_SEARCH_TERM", payload: e.target.value});
                    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
                  }}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <FilterDropdown
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
              {state.activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {state.activeFilters.map((f) => (
                    <span
                      key={`${f.type}-${f.value}`}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                    >
                      <span className="text-emerald-400 dark:text-emerald-500 font-normal">
                        {t(
                          FILTER_CATEGORIES.find((c) => c.type === f.type)
                            ?.labelKey ?? f.type,
                        )}
                        :
                      </span>
                      {f.type === "userType"
                        ? subscriptionUserTypeDisplayLabel(f.value, t)
                        : f.label}
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
                <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {accountRows.length} account{accountRows.length === 1 ? "" : "s"}
                  {filteredSubscriptions.length !== accountRows.length &&
                    ` (${filteredSubscriptions.length} total subscription record${filteredSubscriptions.length === 1 ? "" : "s"})`}
                </div>
                <DataTable
                  items={currentAccountRows}
                  columns={columns}
                  onItemClick={handleSubscriptionClick}
                  onSelect={handleToggleSelection}
                  selectedItems={state.selectedItems}
                  totalItems={accountRows.length}
                  title="subscriptions.allSubscriptions"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  emptyMessage="subscriptions.noSubscriptionsFound"
                  renderItem={renderItem}
                  allSelected={allSelected}
                  onSelectAll={handleSelectVisibleRows}
                />

                {/* Pagination */}
                {accountRows.length > 0 && (
                  <div className="mt-8">
                    <PaginationClassic
                      currentPage={state.currentPage}
                      totalItems={accountRows.length}
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
