import React, {useCallback, useMemo, useReducer, useState, useEffect, useRef} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Building2, MapPin, Shield} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PaginationClassic from "../../components/PaginationClassic";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import ListDropdown from "../../partials/buttons/ListDropdown";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import ProfessionalsTable from "./ProfessionalsTable";

const PAGE_STORAGE_KEY = "professionals_list_page";

const FILTER_CATEGORIES = [
  {type: "category", label: "Category"},
  {type: "city", label: "City"},
  {type: "status", label: "Status"},
];

const initialState = {
  currentPage: 1,
  itemsPerPage: 10,
  searchTerm: "",
  activeFilters: [],
  sidebarOpen: false,
  isSubmitting: false,
  dangerModalOpen: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
  professionals: [],
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CURRENT_PAGE":
      return {...state, currentPage: action.payload};
    case "SET_ITEMS_PER_PAGE":
      return {...state, itemsPerPage: action.payload};
    case "SET_SEARCH_TERM":
      return {...state, searchTerm: action.payload, currentPage: 1};
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
              f.type === action.payload.type &&
              f.value === action.payload.value
            ),
        ),
        currentPage: 1,
      };
    case "CLEAR_FILTERS":
      return {...state, activeFilters: [], currentPage: 1};
    case "SET_SIDEBAR_OPEN":
      return {...state, sidebarOpen: action.payload};
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
    case "SET_PROFESSIONALS":
      return {...state, professionals: action.payload, loading: false};
    case "SET_LOADING":
      return {...state, loading: action.payload};
    default:
      return state;
  }
}

/* ─── Filter Dropdown ─────────────────────────────────────────── */

function FilterDropdown({filterOptions, activeFilters, onAdd, onRemove}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const dropdownRef = useRef(null);

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
        Filter
        {activeFilters.length > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
            {activeFilters.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[200px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
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
                      <span>{cat.label}</span>
                      <span className="flex items-center gap-1 text-gray-400">
                        {count > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
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
                {FILTER_CATEGORIES.find((c) => c.type === activeCategory)
                  ?.label}
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
                    No options available
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

/* ─── Professional Grid Card ─────────────────────────────────── */

const ProfessionalCard = ({professional, onClick, isSelected, onSelect}) => {
  const pro = professional;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(pro)}
      onKeyDown={(e) => e.key === "Enter" && onClick(pro)}
      className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/60 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="relative h-20 bg-gradient-to-br from-[#456564] via-[#3a5857] to-[#2d4443]">
        <div
          className="absolute top-2.5 left-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="inline-flex">
            <span className="sr-only">Select</span>
            <input
              type="checkbox"
              className="form-checkbox rounded"
              checked={isSelected}
              onChange={() => onSelect(pro.id)}
            />
          </label>
        </div>
        {pro.is_verified && (
          <div className="absolute top-2.5 right-2.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/90 text-white">
              <Shield className="w-3 h-3" />
              Verified
            </span>
          </div>
        )}
      </div>
      <div className="relative px-4 -mt-8">
        {pro.profile_photo_url ? (
          <img
            src={pro.profile_photo_url}
            alt=""
            className="w-14 h-14 rounded-xl object-cover border-2 border-white dark:border-gray-800 shadow-sm"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
            <span className="text-sm font-bold text-[#456564] dark:text-[#7aa3a2]">
              {(pro.first_name?.[0] || "").toUpperCase()}
              {(pro.last_name?.[0] || "").toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 pt-2">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {pro.first_name} {pro.last_name}
        </div>
        {pro.company_name && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{pro.company_name}</span>
          </div>
        )}
        {pro.category_name && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {pro.category_name}
            </span>
          </div>
        )}
        {(pro.city || pro.state) && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {[pro.city, pro.state].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────── */

function ProfessionalsList() {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const [selectedItems, setSelectedItems] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [sortConfig, setSortConfig] = useState({
    key: "company_name",
    direction: "asc",
  });

  const [state, dispatch] = useReducer(reducer, initialState, (base) => ({
    ...base,
    currentPage:
      Number(localStorage.getItem(PAGE_STORAGE_KEY)) || base.currentPage,
  }));

  /* ─── Load Professionals from API ──────────────────────────── */

  const fetchProfessionals = useCallback(async () => {
    try {
      dispatch({type: "SET_LOADING", payload: true});
      const pros = await AppApi.getAllProfessionals();
      dispatch({type: "SET_PROFESSIONALS", payload: pros || []});
    } catch (err) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: err?.message || "Failed to load professionals",
        },
      });
      dispatch({type: "SET_LOADING", payload: false});
    }
  }, []);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  /* ─── Banner auto-close ──────────────────────────────────────── */

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

  /* ─── Derive filter options from data ──────────────────────── */

  const uniqueCategories = useMemo(() => {
    const cats = [
      ...new Set(
        state.professionals
          .map((p) => (p.category_name || "").trim())
          .filter(Boolean),
      ),
    ];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [state.professionals]);

  const uniqueCities = useMemo(() => {
    const cities = [
      ...new Set(
        state.professionals
          .map((p) => (p.city || "").trim())
          .filter(Boolean),
      ),
    ];
    return cities.sort((a, b) => a.localeCompare(b));
  }, [state.professionals]);

  const filterOptions = useMemo(
    () => ({
      category: uniqueCategories.map((c) => ({value: c, label: c})),
      city: uniqueCities.map((c) => ({value: c, label: c})),
      status: [
        {value: "verified", label: "Verified", dot: "#22c55e"},
        {value: "active", label: "Active", dot: "#2a9f52"},
        {value: "inactive", label: "Inactive", dot: "#9ca3af"},
      ],
    }),
    [uniqueCategories, uniqueCities],
  );

  /* ─── Filter & Sort ────────────────────────────────────────── */

  const filteredProfessionals = useMemo(() => {
    const filtersByType = {};
    state.activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    const term = (state.searchTerm || "").toLowerCase();

    return state.professionals.filter((pro) => {
      if (term) {
        const name =
          `${pro.first_name || ""} ${pro.last_name || ""}`.toLowerCase();
        const company = (pro.company_name || "").toLowerCase();
        const city = (pro.city || "").toLowerCase();
        const cat = (pro.category_name || "").toLowerCase();
        const email = (pro.email || "").toLowerCase();
        const matchesSearch =
          name.includes(term) ||
          company.includes(term) ||
          city.includes(term) ||
          cat.includes(term) ||
          email.includes(term);
        if (!matchesSearch) return false;
      }

      if (filtersByType.category) {
        const cat = (pro.category_name || "").trim();
        if (!filtersByType.category.includes(cat)) return false;
      }

      if (filtersByType.city) {
        const city = (pro.city || "").trim();
        if (!filtersByType.city.includes(city)) return false;
      }

      if (filtersByType.status) {
        const matchesAny = filtersByType.status.some((sv) => {
          if (sv === "verified") return pro.is_verified;
          if (sv === "active") return pro.is_active !== false;
          if (sv === "inactive") return pro.is_active === false;
          return false;
        });
        if (!matchesAny) return false;
      }

      return true;
    });
  }, [state.searchTerm, state.professionals, state.activeFilters]);

  const sortedProfessionals = useMemo(() => {
    const items = [...filteredProfessionals];
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal = a[sortConfig.key] ?? "";
        let bVal = b[sortConfig.key] ?? "";
        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [filteredProfessionals, sortConfig]);

  const totalItems = sortedProfessionals.length;

  const paginatedProfessionals = useMemo(() => {
    const start = (state.currentPage - 1) * state.itemsPerPage;
    return sortedProfessionals.slice(start, start + state.itemsPerPage);
  }, [sortedProfessionals, state.currentPage, state.itemsPerPage]);

  useEffect(() => {
    if (sortedProfessionals.length === 0) return;
    const lastValidPage = Math.max(
      1,
      Math.ceil(sortedProfessionals.length / state.itemsPerPage),
    );
    if (state.currentPage > lastValidPage) {
      dispatch({type: "SET_CURRENT_PAGE", payload: 1});
    }
  }, [sortedProfessionals.length, state.itemsPerPage, state.currentPage]);

  /* ─── Handlers ─────────────────────────────────────────────── */

  const handleSearchChange = (e) => {
    dispatch({type: "SET_SEARCH_TERM", payload: e.target.value});
  };

  const handleItemsPerPageChange = (value) => {
    dispatch({type: "SET_ITEMS_PER_PAGE", payload: Number(value)});
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
  };

  const handlePageChange = (page) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: page});
    localStorage.setItem(PAGE_STORAGE_KEY, page);
  };

  const handleNewProfessional = () =>
    navigate(`/${accountUrl}/professionals/manage/new`);

  const handleProfessionalClick = useCallback(
    (pro) => {
      navigate(`/${accountUrl}/professionals/manage/${pro.id}`);
    },
    [navigate, accountUrl],
  );

  const handleSort = (columnKey) => {
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {key: columnKey, direction: "asc"};
    });
  };

  const handleToggleSelect = (ids, shouldSelect = null) => {
    if (Array.isArray(ids)) {
      if (shouldSelect) {
        const merged = new Set(selectedItems);
        ids.forEach((id) => merged.add(id));
        setSelectedItems(Array.from(merged));
      } else {
        setSelectedItems((prev) => prev.filter((id) => !ids.includes(id)));
      }
      return;
    }
    setSelectedItems((prev) =>
      prev.includes(ids) ? prev.filter((id) => id !== ids) : [...prev, ids],
    );
  };

  const handleDeleteClick = () => {
    if (selectedItems.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: "Please select at least one professional to delete",
        },
      });
      return;
    }
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  };

  const handleDelete = async () => {
    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      for (const id of selectedItems) {
        await AppApi.deleteProfessional(id);
      }
      const n = selectedItems.length;
      setSelectedItems([]);
      dispatch({type: "SET_DANGER_MODAL", payload: false});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: `${n} professional${n === 1 ? "" : "s"} deleted successfully`,
        },
      });
      await fetchProfessionals();
    } catch (err) {
      dispatch({type: "SET_DANGER_MODAL", payload: false});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: err?.message || "Failed to delete professionals",
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  };

  const hasActiveSearch = state.searchTerm || state.activeFilters.length > 0;

  /* ─── Render ───────────────────────────────────────────────── */

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar
        sidebarOpen={state.sidebarOpen}
        setSidebarOpen={(open) =>
          dispatch({type: "SET_SIDEBAR_OPEN", payload: open})
        }
      />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header
          sidebarOpen={state.sidebarOpen}
          setSidebarOpen={(open) =>
            dispatch({type: "SET_SIDEBAR_OPEN", payload: open})
          }
        />

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

        <div className="m-1.5">
          <ModalBlank
            id="professional-danger-modal"
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
                    Delete {selectedItems.length}{" "}
                    {selectedItems.length === 1
                      ? "professional"
                      : "professionals"}
                    ?
                  </div>
                </div>
                <div className="text-sm mb-10">
                  <div className="space-y-2">
                    <p>
                      Are you sure you want to delete the selected{" "}
                      {selectedItems.length === 1
                        ? "professional"
                        : "professionals"}
                      ? This action cannot be undone.
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
            {/* ─── Header row ─────────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-5">
              <div>
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  Professionals
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage professionals in your directory
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ListDropdown
                  align="right"
                  hasSelection={selectedItems.length > 0}
                  onImport={() => navigate(`/${accountUrl}/professionals/import`)}
                  onDelete={handleDeleteClick}
                />
                <button
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white shadow-sm"
                  onClick={handleNewProfessional}
                >
                  <svg
                    className="fill-current shrink-0 xs:hidden"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span className="max-xs:sr-only">Add Professional</span>
                </button>
              </div>
            </div>

            {/* ─── Search + Filter + View toggle ──────────────── */}
            <div className="mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                    placeholder="Search professionals..."
                    value={state.searchTerm}
                    onChange={handleSearchChange}
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                    <svg
                      className="shrink-0 fill-current text-gray-400 dark:text-gray-500 ml-1"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                    >
                      <path d="M7 14c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zM7 2C4.243 2 2 4.243 2 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
                      <path d="M15.707 14.293L13.314 11.9a8.019 8.019 0 01-1.414 1.414l2.393 2.393a.997.997 0 001.414 0 .999.999 0 000-1.414z" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <FilterDropdown
                    filterOptions={filterOptions}
                    activeFilters={state.activeFilters}
                    onAdd={(f) => dispatch({type: "ADD_FILTER", payload: f})}
                    onRemove={(f) =>
                      dispatch({type: "REMOVE_FILTER", payload: f})
                    }
                  />
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`px-2.5 py-2 ${
                        viewMode === "grid"
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      } transition-colors`}
                      title="Grid view"
                      aria-label="Grid view"
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
                          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`px-2.5 py-2 ${
                        viewMode === "list"
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      } transition-colors`}
                      title="List view"
                      aria-label="List view"
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
                          d="M4 6h16M4 10h16M4 14h16M4 18h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── Active filter chips ────────────────────────── */}
              {state.activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {state.activeFilters.map((f) => (
                    <span
                      key={`${f.type}-${f.value}`}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20"
                    >
                      <span className="text-violet-400 dark:text-violet-500 font-normal">
                        {FILTER_CATEGORIES.find((c) => c.type === f.type)
                          ?.label ?? f.type}
                        :
                      </span>
                      {f.label}
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({type: "REMOVE_FILTER", payload: f})
                        }
                        className="ml-0.5 p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/20 transition-colors"
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
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* ─── Content: Loading / Table / Grid ────────────── */}
            {state.loading ? (
              <div className="flex items-center justify-center py-12">
                <svg
                  className="animate-spin h-8 w-8 text-gray-400"
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
              </div>
            ) : viewMode === "list" ? (
              <>
                <ProfessionalsTable
                  professionals={sortedProfessionals}
                  onToggleSelect={handleToggleSelect}
                  selectedItems={selectedItems}
                  totalProfessionals={totalItems}
                  currentPage={state.currentPage}
                  itemsPerPage={state.itemsPerPage}
                  onProfessionalClick={handleProfessionalClick}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                {totalItems > 0 && (
                  <div className="mt-8">
                    <PaginationClassic
                      currentPage={state.currentPage}
                      totalItems={totalItems}
                      itemsPerPage={state.itemsPerPage}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {paginatedProfessionals.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60">
                    <div className="text-center py-16">
                      <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {hasActiveSearch
                          ? "No professionals found"
                          : "No professionals yet"}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                        {hasActiveSearch
                          ? "Try adjusting your search or filters"
                          : "Add your first professional to get started"}
                      </p>
                      {!hasActiveSearch && (
                        <button
                          className="btn bg-[#456564] hover:bg-[#34514f] text-white shadow-sm"
                          onClick={handleNewProfessional}
                        >
                          Add Professional
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {paginatedProfessionals.map((pro) => (
                      <ProfessionalCard
                        key={pro.id}
                        professional={pro}
                        onClick={handleProfessionalClick}
                        isSelected={selectedItems.includes(pro.id)}
                        onSelect={handleToggleSelect}
                      />
                    ))}
                  </div>
                )}
                {totalItems > 0 && (
                  <div className="mt-8">
                    <PaginationClassic
                      currentPage={state.currentPage}
                      totalItems={totalItems}
                      itemsPerPage={state.itemsPerPage}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
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

export default ProfessionalsList;
