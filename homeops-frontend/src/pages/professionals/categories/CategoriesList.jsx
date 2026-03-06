import React, {useCallback, useMemo, useReducer, useState, useEffect, useRef} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ChevronRight, ChevronDown, Layers, Tag, Users, FolderTree} from "lucide-react";

import Sidebar from "../../../partials/Sidebar";
import Header from "../../../partials/Header";
import PaginationClassic from "../../../components/PaginationClassic";
import DataTable from "../../../components/DataTable";
import ModalBlank from "../../../components/ModalBlank";
import Banner from "../../../partials/containers/Banner";
import useCurrentAccount from "../../../hooks/useCurrentAccount";
import AppApi from "../../../api/api";

const PAGE_STORAGE_KEY = "categories_list_page";

const FILTER_CATEGORIES = [
  {type: "type", labelKey: "type"},
  {type: "parent", labelKey: "parentCategory"},
];

function FilterDropdown({filterOptions, activeFilters, onAdd, onRemove, t}) {
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
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {t("filter", {defaultValue: "Filter"})}
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
                const count = activeFilters.filter((f) => f.type === cat.type).length;
                return (
                  <li key={cat.type}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      onClick={() => setActiveCategory(cat.type)}
                    >
                      <span>{t(cat.labelKey, {defaultValue: cat.labelKey})}</span>
                      <span className="flex items-center gap-1 text-gray-400">
                        {count > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                            {count}
                          </span>
                        )}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t(FILTER_CATEGORIES.find((c) => c.type === activeCategory)?.labelKey ?? activeCategory, {defaultValue: activeCategory})}
              </button>
              <ul className="py-1.5 max-h-64 overflow-y-auto">
                {(filterOptions[activeCategory] ?? []).map((opt) => {
                  const active = isFilterActive(activeCategory, opt.value);
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        onClick={() => toggleFilter(activeCategory, opt.value, opt.label)}
                      >
                        <span className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          active ? "bg-violet-500 border-violet-500" : "border-gray-300 dark:border-gray-600"
                        }`}>
                          {active && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  hierarchy: [],
  loading: true,
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
        (f) => f.type === action.payload.type && f.value === action.payload.value,
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
          (f) => !(f.type === action.payload.type && f.value === action.payload.value),
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
    case "SET_HIERARCHY":
      return {...state, hierarchy: action.payload, loading: false};
    case "SET_LOADING":
      return {...state, loading: action.payload};
    default:
      return state;
  }
}

const TypeBadge = ({type}) => {
  const isParent = type === "parent";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isParent
          ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200/60 dark:border-violet-500/20"
          : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20"
      }`}
    >
      {isParent ? (
        <Layers className="w-3 h-3" />
      ) : (
        <Tag className="w-3 h-3" />
      )}
      {isParent ? "Parent" : "Sub"}
    </span>
  );
};

function CategoriesList() {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const [selectedItems, setSelectedItems] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });

  const [state, dispatch] = useReducer(reducer, initialState, (base) => ({
    ...base,
    currentPage:
      Number(localStorage.getItem(PAGE_STORAGE_KEY)) || base.currentPage,
  }));

  /* ─── Load Categories from API ──────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        dispatch({type: "SET_LOADING", payload: true});
        const hierarchy = await AppApi.getProfessionalCategoryHierarchy();
        if (cancelled) return;
        dispatch({type: "SET_HIERARCHY", payload: hierarchy || []});
        setExpandedGroups((hierarchy || []).map((g) => String(g.id)));
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: err?.message || "Failed to load categories",
            },
          });
          dispatch({type: "SET_LOADING", payload: false});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ─── Summary Stats ────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalParents = state.hierarchy.length;
    const totalChildren = state.hierarchy.reduce(
      (sum, p) => sum + (p.children?.length ?? 0),
      0,
    );
    const totalPros = 0;
    return {totalParents, totalChildren, totalPros};
  }, [state.hierarchy]);

  /* ─── Filter options ────────────────────────────────────────── */

  const filterOptions = useMemo(() => {
    const parentNames = state.hierarchy.map((p) => p.name).sort((a, b) => a.localeCompare(b));
    return {
      type: [
        {value: "parent", label: "Parent"},
        {value: "child", label: "Subcategory"},
      ],
      parent: parentNames.map((n) => ({value: n, label: n})),
    };
  }, [state.hierarchy]);

  /* ─── Build grouped data (parent -> children) ──────────────── */

  const {groupedData, flatFiltered} = useMemo(() => {
    const term = (state.searchTerm || "").toLowerCase();
    const filtersByType = {};
    state.activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    const groups = {};
    const flat = [];

    const typeFilterParentOnly = filtersByType.type && filtersByType.type.includes("parent") && !filtersByType.type.includes("child");
    const typeFilterChildOnly = filtersByType.type && filtersByType.type.includes("child") && !filtersByType.type.includes("parent");

    for (const parent of state.hierarchy) {
      if (filtersByType.parent && !filtersByType.parent.includes(parent.name)) {
        continue;
      }

      if (typeFilterChildOnly) continue;

      const matchingChildren = (parent.children ?? [])
        .filter((child) => {
          if (typeFilterParentOnly) return false;
          if (!term) return true;
          return (
            (child.name || "").toLowerCase().includes(term) ||
            (child.description || "").toLowerCase().includes(term)
          );
        })
        .map((child) => ({
          ...child,
          id: String(child.id),
          parentId: String(parent.id),
          parentName: parent.name,
          type: "child",
          childCount: 0,
          proCount: 0,
        }));

      const parentMatches =
        !term ||
        (parent.name || "").toLowerCase().includes(term) ||
        (parent.description || "").toLowerCase().includes(term);

      if (parentMatches || matchingChildren.length > 0) {
        const children = parentMatches
          ? (parent.children ?? [])
              .filter(() => !typeFilterParentOnly)
              .map((child) => ({
                ...child,
                id: String(child.id),
                parentId: String(parent.id),
                parentName: parent.name,
                type: "child",
                childCount: 0,
                proCount: 0,
              }))
          : matchingChildren;

        const parentRow = {
          id: String(parent.id),
          name: parent.name,
          description: parent.description,
          icon: parent.icon,
          parentId: null,
          parentName: null,
          type: "parent",
          proCount: 0,
          childCount: children.length,
        };

        groups[String(parent.id)] = children;
        flat.push(parentRow);
        flat.push(...children);
      }
    }

    return {groupedData: groups, flatFiltered: flat};
  }, [state.searchTerm, state.hierarchy, state.activeFilters]);

  const totalItems = flatFiltered.length;

  /* ─── Handlers ─────────────────────────────────────────────── */

  const handleSearchChange = (e) => {
    dispatch({type: "SET_SEARCH_TERM", payload: e.target.value});
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
  };

  const handleItemsPerPageChange = (value) => {
    dispatch({type: "SET_ITEMS_PER_PAGE", payload: Number(value)});
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
  };

  const handlePageChange = (page) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: page});
  };

  const handleNewCategory = () =>
    navigate(`/${accountUrl}/professionals/categories/new`);

  const handleCategoryClick = useCallback(
    (item) => {
      navigate(`/${accountUrl}/professionals/categories/${item.id}`);
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

  const handleGroupExpand = useCallback((groupId) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  }, []);

  const handleDeleteClick = () => {
    if (selectedItems.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: "Please select at least one category to delete",
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
        await AppApi.deleteProfessionalCategory(id);
      }
      const n = selectedItems.length;
      setSelectedItems([]);
      dispatch({type: "SET_DANGER_MODAL", payload: false});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: `${n} ${n === 1 ? "category" : "categories"} deleted successfully`,
        },
      });
      const hierarchy = await AppApi.getProfessionalCategoryHierarchy();
      dispatch({type: "SET_HIERARCHY", payload: hierarchy || []});
    } catch (err) {
      dispatch({type: "SET_DANGER_MODAL", payload: false});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: err?.message || "Failed to delete categories",
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  };

  /* ─── Table columns ────────────────────────────────────────── */

  const columns = [
    {
      key: "name",
      label: "name",
      sortable: true,
      render: (value, item) => (
        <div className="flex items-center gap-2.5">
          {item.type === "child" && (
            <span className="w-4 border-l-2 border-b-2 border-gray-300 dark:border-gray-600 h-3 ml-2 rounded-bl-sm" />
          )}
          <span
            className={`font-medium ${
              item.type === "parent"
                ? "text-gray-900 dark:text-gray-100"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {value}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      label: "type",
      sortable: true,
      render: (value) => <TypeBadge type={value} />,
    },
    {
      key: "parentName",
      label: "parentCategory",
      sortable: true,
      render: (value) =>
        value ? (
          <span className="text-gray-600 dark:text-gray-400">{value}</span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">&mdash;</span>
        ),
    },
    {
      key: "childCount",
      label: "subcategories",
      sortable: true,
      render: (value, item) =>
        item.type === "parent" ? (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/20">
            {value}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">&mdash;</span>
        ),
    },
  ];

  /* ─── Collapsible group header renderer ────────────────────── */

  const renderGroupHeader = useCallback(
    (groupId, groupItems, isExpanded, onExpand) => {
      const parent = state.hierarchy.find((g) => String(g.id) === groupId);
      if (!parent) return null;

      return (
        <tr
          key={`group-${groupId}`}
          className="bg-gradient-to-r from-gray-50 to-gray-50/50 dark:from-gray-700/40 dark:to-gray-700/20 cursor-pointer hover:from-gray-100 hover:to-gray-50 dark:hover:from-gray-700/60 dark:hover:to-gray-700/30 transition-colors border-l-3 border-l-[#456564]"
          onClick={() => handleCategoryClick({id: groupId})}
        >
          <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap w-px">
            <div className="flex items-center">
              <label className="inline-flex">
                <span className="sr-only">Select</span>
                <input
                  className="form-checkbox"
                  type="checkbox"
                  checked={selectedItems.includes(groupId)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(groupId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
            </div>
          </td>
          <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand(groupId);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#456564] dark:text-[#7aa3a2]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#456564] dark:text-[#7aa3a2]" />
                )}
              </button>
              <div className="w-6 h-6 rounded-md bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-[#456564] dark:text-[#7aa3a2]" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {parent.name}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                {groupItems.length} subcategories
              </span>
            </div>
          </td>
          <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap">
            <TypeBadge type="parent" />
          </td>
          <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap">
            <span className="text-gray-400 dark:text-gray-500">&mdash;</span>
          </td>
          <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap">
            <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/20">
              {groupItems.length}
            </span>
          </td>
        </tr>
      );
    },
    [selectedItems, state.hierarchy, handleCategoryClick],
  );

  /* ─── Child row renderer ───────────────────────────────────── */

  const renderItem = useCallback(
    (item, handleSelect, selectedItemsList, onItemClick) => (
      <>
        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap w-px">
          <div className="flex items-center">
            <label className="inline-flex">
              <span className="sr-only">Select</span>
              <input
                className="form-checkbox"
                type="checkbox"
                checked={selectedItemsList.includes(item.id)}
                onChange={() => handleSelect(item.id)}
              />
            </label>
          </div>
        </td>
        <td
          className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap cursor-pointer"
          onClick={() => onItemClick(item)}
        >
          <div className="flex items-center gap-2.5 pl-6">
            <span className="w-4 border-l-2 border-b-2 border-gray-300 dark:border-gray-600 h-3 rounded-bl-sm" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {item.name}
            </span>
          </div>
        </td>
        <td
          className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap cursor-pointer"
          onClick={() => onItemClick(item)}
        >
          <TypeBadge type="child" />
        </td>
        <td
          className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap cursor-pointer"
          onClick={() => onItemClick(item)}
        >
          <span className="text-gray-600 dark:text-gray-400">
            {item.parentName}
          </span>
        </td>
        <td
          className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap cursor-pointer"
          onClick={() => onItemClick(item)}
        >
          <span className="text-gray-400 dark:text-gray-500">&mdash;</span>
        </td>
      </>
    ),
    [],
  );

  /* ─── Compute allSelected for current page ─────────────────── */

  const allChildItems = useMemo(() => {
    const items = [];
    for (const groupId of Object.keys(groupedData)) {
      if (expandedGroups.includes(groupId)) {
        items.push(...groupedData[groupId]);
      }
    }
    return items;
  }, [groupedData, expandedGroups]);

  const allSelected =
    allChildItems.length > 0 &&
    allChildItems.every((item) => selectedItems.includes(item.id));

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
            id="category-danger-modal"
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
                    {selectedItems.length === 1 ? "category" : "categories"}?
                  </div>
                </div>
                <div className="text-sm mb-10">
                  <div className="space-y-2">
                    <p>
                      Are you sure you want to delete the selected{" "}
                      {selectedItems.length === 1
                        ? "category"
                        : "categories"}
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
                  Professional Categories
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage parent and subcategories for the Professionals
                  Directory
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedItems.length > 0 && (
                  <button
                    className="btn border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-red-500"
                    onClick={handleDeleteClick}
                  >
                    <svg
                      className="shrink-0 fill-current mr-1"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                    >
                      <path d="M5 7h2v6H5V7zm4 0h2v6H9V7zm3-6v2h4v2h-1v10c0 .6-.4 1-1 1H2c-.6 0-1-.4-1-1V5H0V3h4V1c0-.6.4-1 1-1h6c.6 0 1 .4 1 1zm-7 0v1h4V1H5zm6 4H3v9h8V5z" />
                    </svg>
                    <span>{t("delete")}</span>
                  </button>
                )}
                <button
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white shadow-sm"
                  onClick={handleNewCategory}
                >
                  <svg
                    className="fill-current shrink-0 xs:hidden"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span className="max-xs:sr-only">Add Category</span>
                </button>
              </div>
            </div>

            {/* ─── Summary Stats ──────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                    {stats.totalParents}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Parent Categories
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <FolderTree className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                    {stats.totalChildren}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Subcategories
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-[#456564] dark:text-[#7aa3a2]" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                    {stats.totalPros.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Total Professionals
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Search & Filters ────────────────────────── */}
            <div className="mb-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                    placeholder="Search categories..."
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
                <FilterDropdown
                  filterOptions={filterOptions}
                  activeFilters={state.activeFilters}
                  onAdd={(f) => dispatch({type: "ADD_FILTER", payload: f})}
                  onRemove={(f) => dispatch({type: "REMOVE_FILTER", payload: f})}
                  t={t}
                />
              </div>

              {state.activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {state.activeFilters.map((f) => (
                    <span
                      key={`${f.type}-${f.value}`}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20"
                    >
                      <span className="text-violet-400 dark:text-violet-500 font-normal">
                        {t(FILTER_CATEGORIES.find((c) => c.type === f.type)?.labelKey ?? f.type, {defaultValue: f.type})}:
                      </span>
                      {f.label}
                      <button
                        type="button"
                        onClick={() => dispatch({type: "REMOVE_FILTER", payload: f})}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/20 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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

            {/* ─── Data Table ────────────────────────────────── */}
            {state.loading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : (
              <DataTable
                items={allChildItems}
                columns={columns}
                onItemClick={handleCategoryClick}
                onSelect={handleToggleSelect}
                selectedItems={selectedItems}
                totalItems={totalItems}
                title="categories"
                sortConfig={sortConfig}
                onSort={handleSort}
                isCollapsible
                groupBy={groupedData}
                expandedGroups={expandedGroups}
                onGroupExpand={handleGroupExpand}
                renderGroupHeader={renderGroupHeader}
                renderItem={renderItem}
                allSelected={allSelected}
              />
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
          </div>
        </main>
      </div>
    </div>
  );
}

export default CategoriesList;
