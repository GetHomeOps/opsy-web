import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useContext,
} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Sparkles} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PaginationClassic from "../../components/PaginationClassic";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import ListDropdown from "../../partials/buttons/ListDropdown";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import propertyContext from "../../context/PropertyContext";
import AppApi from "../../api/api";

const PAGE_STORAGE_KEY = "properties_list_page";

const FILTER_CATEGORIES = [
  {type: "city", labelKey: "city"},
  {type: "state", labelKey: "state"},
  {type: "owner", labelKey: "owner"},
  {type: "health", labelKey: "healthStatus"},
];

const HEALTH_RANGES = [
  {value: "healthy", labelKey: "healthy", min: 75, max: 100, color: "#22c55e"},
  {value: "moderate", labelKey: "moderate", min: 40, max: 74, color: "#eab308"},
  {value: "at_risk", labelKey: "atRisk", min: 25, max: 39, color: "#f97316"},
  {value: "critical", labelKey: "critical", min: 0, max: 24, color: "#ef4444"},
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
    default:
      return state;
  }
}

/* ─── Shared tiny components ─────────────────────────────────── */

const getHealthColor = (value) => {
  if (value >= 75) return "#22c55e";
  if (value >= 40) return "#eab308";
  if (value >= 25) return "#f97316";
  return "#ef4444";
};

const HealthBar = ({value}) => (
  <div className="flex items-center gap-3">
    <div className="w-32 h-2 rounded-full bg-gray-200 dark:bg-gray-700/60">
      <div
        className="h-2 rounded-full transition-all duration-300"
        style={{width: `${value}%`, backgroundColor: getHealthColor(value)}}
      />
    </div>
    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
      {value}%
    </span>
  </div>
);

/* ─── Odoo-style Filter Dropdown ─────────────────────────────── */

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
                      <span>{t(cat.labelKey)}</span>
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

/* ─── Property Grid Card ─────────────────────────────────────── */

const PropertyCard = ({property, onClick, isSelected, onSelect, getMainPhotoUrl, t, onOpenAIAssistant}) => {
  const health = property.health ?? property.hps_score ?? property.hpsScore ?? 0;
  const resolved = getMainPhotoUrl?.(property);
  const photoUrl =
    resolved ||
    property.main_photo_url ||
    property.mainPhotoUrl ||
    null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(property)}
      onKeyDown={(e) => e.key === "Enter" && onClick(property)}
      className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/60 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-700/40 overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
            </svg>
          </div>
        )}
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
              onChange={() => onSelect(property.id)}
            />
          </label>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
          {onOpenAIAssistant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAIAssistant(property);
              }}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white text-[#456564] shadow-sm transition-colors"
              title="AI Assistant"
              aria-label="Open AI Assistant"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{backgroundColor: getHealthColor(health)}}
          >
            {health}%
          </span>
        </div>
      </div>
      <div className="p-3.5">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {property.passport_id || property.property_name || t("property")}
        </div>
        {(property.address || property.city) && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">
              {[property.address, property.city, property.state]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────── */

function PropertiesList() {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: "passport_id",
    direction: "asc",
  });

  const [state, dispatch] = useReducer(reducer, initialState, (baseState) => ({
    ...baseState,
    currentPage:
      Number(localStorage.getItem(PAGE_STORAGE_KEY)) || baseState.currentPage,
  }));

  const {
    properties,
    setProperties,
    refreshProperties,
    viewMode,
    setViewMode,
    deleteProperty,
  } = useContext(propertyContext);

  /* ─── Derive filter options from data ──────────────────────── */

  const uniqueCities = useMemo(() => {
    const cities = [
      ...new Set(
        properties.map((p) => (p.city || "").trim()).filter(Boolean),
      ),
    ];
    return cities.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const uniqueStates = useMemo(() => {
    const states = [
      ...new Set(
        properties.map((p) => (p.state || "").trim()).filter(Boolean),
      ),
    ];
    return states.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const uniqueOwners = useMemo(() => {
    const owners = [
      ...new Set(
        properties
          .map((p) => (p.owner_user_name ?? p.ownerUserName ?? "").trim())
          .filter(Boolean),
      ),
    ];
    return owners.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const filterOptions = useMemo(
    () => ({
      city: uniqueCities.map((c) => ({value: c, label: c})),
      state: uniqueStates.map((s) => ({value: s, label: s})),
      owner: uniqueOwners.map((o) => ({value: o, label: o})),
      health: HEALTH_RANGES.map((h) => ({
        value: h.value,
        label: t(h.labelKey),
        dot: h.color,
      })),
    }),
    [uniqueCities, uniqueStates, uniqueOwners, t],
  );

  /* ─── Presigned photo URLs ─────────────────────────────────── */

  const [presignedUrls, setPresignedUrls] = useState({});
  const fetchedKeysRef = useRef(new Set());

  useEffect(() => {
    if (!properties?.length) return;
    properties.forEach((prop) => {
      const key = prop.main_photo || prop.mainPhoto;
      if (
        !key ||
        key.startsWith("http") ||
        key.startsWith("blob:") ||
        fetchedKeysRef.current.has(key)
      )
        return;
      fetchedKeysRef.current.add(key);
      AppApi.getPresignedPreviewUrl(key)
        .then((url) => {
          setPresignedUrls((prev) => ({...prev, [key]: url}));
        })
        .catch(() => {
          fetchedKeysRef.current.delete(key);
        });
    });
  }, [properties]);

  const getMainPhotoUrl = useCallback(
    (property) => {
      if (!property) return null;
      const key = property.main_photo || property.mainPhoto;
      if (!key) return null;
      if (key.startsWith("http") || key.startsWith("blob:")) return key;
      return (
        presignedUrls[key] ??
        property.main_photo_url ??
        property.mainPhotoUrl ??
        null
      );
    },
    [presignedUrls],
  );

  /* ─── Data fetch / lifecycle ───────────────────────────────── */

  useEffect(() => {
    refreshProperties?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(PAGE_STORAGE_KEY, state.currentPage);
  }, [state.currentPage]);

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
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.bannerOpen, state.bannerType, state.bannerMessage]);

  /* ─── Filtering (Odoo-style: OR within same type, AND across types) */

  const filteredProperties = useMemo(() => {
    const filtersByType = {};
    state.activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    return properties.filter((property) => {
      const term = (state.searchTerm || "").toLowerCase();
      if (term) {
        const matchesSearch =
          (property.passport_id || "").toLowerCase().includes(term) ||
          (property.address || "").toLowerCase().includes(term) ||
          (property.city || "").toLowerCase().includes(term) ||
          (property.state || "").toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (filtersByType.city) {
        const city = (property.city || "").trim();
        if (!filtersByType.city.includes(city)) return false;
      }

      if (filtersByType.state) {
        const st = (property.state || "").trim();
        if (!filtersByType.state.includes(st)) return false;
      }

      if (filtersByType.owner) {
        const owner =
          (property.owner_user_name ?? property.ownerUserName ?? "").trim();
        if (!filtersByType.owner.includes(owner)) return false;
      }

      if (filtersByType.health) {
        const health =
          property.health ?? property.hps_score ?? property.hpsScore ?? 0;
        const matchesAny = filtersByType.health.some((hv) => {
          const range = HEALTH_RANGES.find((r) => r.value === hv);
          return range && health >= range.min && health <= range.max;
        });
        if (!matchesAny) return false;
      }

      return true;
    });
  }, [properties, state.searchTerm, state.activeFilters]);

  const sortedProperties = useMemo(() => {
    const sortable = [...filteredProperties];
    sortable.sort((a, b) => {
      const {key, direction} = sortConfig;
      const dirMultiplier = direction === "asc" ? 1 : -1;
      const valueA = a[key];
      const valueB = b[key];
      if (valueA === valueB) return 0;
      if (typeof valueA === "string" && typeof valueB === "string") {
        return valueA.localeCompare(valueB) * dirMultiplier;
      }
      return (valueA > valueB ? 1 : -1) * dirMultiplier;
    });
    return sortable;
  }, [filteredProperties, sortConfig]);

  const paginatedProperties = useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    return sortedProperties.slice(startIndex, startIndex + state.itemsPerPage);
  }, [sortedProperties, state.currentPage, state.itemsPerPage]);

  useEffect(() => {
    if (sortedProperties.length === 0) return;
    const lastValidPage = Math.max(
      1,
      Math.ceil(sortedProperties.length / state.itemsPerPage),
    );
    if (state.currentPage > lastValidPage) {
      dispatch({type: "SET_CURRENT_PAGE", payload: 1});
    }
  }, [sortedProperties.length, state.itemsPerPage, state.currentPage]);

  /* ─── Handlers ─────────────────────────────────────────────── */

  const handleSearchChange = (event) => {
    dispatch({type: "SET_SEARCH_TERM", payload: event.target.value});
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
  };

  const handleItemsPerPageChange = (value) => {
    dispatch({type: "SET_ITEMS_PER_PAGE", payload: Number(value)});
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
  };

  const handlePageChange = (page) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: page});
  };

  const handleNewProperty = () => navigate(`/${accountUrl}/properties/new`);
  const handleOpenAIAssistant = (property) => {
    const uid = property.property_uid ?? property.id;
    const propertyIndex = sortedProperties.findIndex(
      (p) => (p.property_uid ?? p.id) === uid,
    );
    navigate(`/${accountUrl}/properties/${uid}`, {
      state: {
        openAiSidebar: true,
        currentIndex: propertyIndex + 1,
        totalItems: sortedProperties.length,
        visiblePropertyIds: sortedProperties.map(
          (p) => p.property_uid ?? p.id,
        ),
      },
    });
  };
  const handlePropertyClick = (property) => {
    const propertyIndex = sortedProperties.findIndex(
      (p) => (p.property_uid ?? p.id) === property.property_uid,
    );
    navigate(`/${accountUrl}/properties/${property.property_uid}`, {
      state: {
        currentIndex: propertyIndex + 1,
        totalItems: sortedProperties.length,
        visiblePropertyIds: sortedProperties.map(
          (p) => p.property_uid ?? p.id,
        ),
      },
    });
  };

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
        const merged = new Set(selectedProperties);
        ids.forEach((id) => merged.add(id));
        setSelectedProperties(Array.from(merged));
      } else {
        setSelectedProperties((prev) =>
          prev.filter((id) => !ids.includes(id)),
        );
      }
      return;
    }
    setSelectedProperties((prev) =>
      prev.includes(ids) ? prev.filter((id) => id !== ids) : [...prev, ids],
    );
  };

  /* ─── Table config ─────────────────────────────────────────── */

  const columns = [
    {key: "passport_id", label: "Passport ID", sortable: true},
    {key: "address", label: "address", sortable: true},
    {key: "city", label: "city", sortable: true},
    {key: "state", label: "state", sortable: true},
    {
      key: "owner_user_name",
      label: "owner",
      sortable: true,
      render: (value, item) => value ?? item?.ownerUserName ?? "—",
    },
    {
      key: "health",
      label: "healthStatus",
      sortable: true,
      render: (value) => <HealthBar value={value ?? 0} />,
    },
  ];

  const renderPropertyRow = (item, handleSelect, selectedItems, onItemClick) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selectedItems.includes(item.id)}
      onItemClick={() => onItemClick(item)}
    />
  );

  const allSelected =
    paginatedProperties.length > 0 &&
    paginatedProperties.every((property) =>
      selectedProperties.includes(property.id),
    );

  /* ─── Bulk actions ─────────────────────────────────────────── */

  function handleDeleteClick() {
    if (selectedProperties.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: t("selectItemsToDelete", {
            defaultValue: "Please select at least one property to delete",
          }),
        },
      });
      return;
    }
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  async function handleDuplicate() {
    if (selectedProperties.length === 0) return;
    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      const timestamp = Date.now();
      const duplicatedProperties = selectedProperties
        .map((id, index) => {
          const original = properties.find((property) => property.id === id);
          if (!original) return null;
          return {
            ...original,
            id: `${original.id}-COPY-${timestamp + index}`,
          };
        })
        .filter(Boolean);
      if (duplicatedProperties.length === 0) {
        throw new Error("No properties duplicated");
      }
      setProperties((prev) => [...duplicatedProperties, ...prev]);
      const n = duplicatedProperties.length;
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: `${n} ${n === 1 ? "property" : "properties"} duplicated successfully`,
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message:
            error?.message || "Error duplicating properties. Please try again.",
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  async function handleDelete() {
    if (selectedProperties.length === 0) return;
    dispatch({type: "SET_DANGER_MODAL", payload: false});
    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      const deletedIds = [...selectedProperties];
      setSelectedProperties((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );
      for (const id of deletedIds) {
        await deleteProperty(id);
      }
      const remainingItems = sortedProperties.length - deletedIds.length;
      if (
        state.currentPage > 1 &&
        remainingItems <= (state.currentPage - 1) * state.itemsPerPage
      ) {
        dispatch({type: "SET_CURRENT_PAGE", payload: state.currentPage - 1});
      }
      const n = deletedIds.length;
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: `${n} ${n === 1 ? "property" : "properties"} deleted successfully`,
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: "Error deleting properties. Please try again.",
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

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
            id="property-danger-modal"
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
                    Delete {selectedProperties.length}{" "}
                    {selectedProperties.length === 1
                      ? "property"
                      : "properties"}
                    ?
                  </div>
                </div>
                <div className="text-sm mb-10">
                  <div className="space-y-2">
                    <p>
                      {t("propertyDeleteConfirmationMessage", {
                        count: selectedProperties.length,
                        defaultValue:
                          selectedProperties.length === 1
                            ? "Are you sure you want to delete the selected property?"
                            : "Are you sure you want to delete the selected properties?",
                      })}{" "}
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
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                {t("properties")}
              </h1>
              <div className="flex items-center gap-2">
                <ListDropdown
                  align="right"
                  hasSelection={selectedProperties.length > 0}
                  onDelete={handleDeleteClick}
                  onDuplicate={handleDuplicate}
                />
                <button
                  className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
                  onClick={handleNewProperty}
                >
                  <svg
                    className="fill-current shrink-0 xs:hidden"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span className="max-xs:sr-only">{t("addProperty")}</span>
                </button>
              </div>
            </div>

            {/* ─── Search + Filter + View toggle ──────────────── */}
            <div className="mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm text-sm"
                    placeholder={t("searchPropertiesPlaceholder")}
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

                {/* Filter button + View toggle (right of search) */}
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
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`px-2.5 py-2 ${
                        viewMode === "grid"
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      } transition-colors`}
                      title={t("gridView")}
                      aria-label={t("gridView")}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
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
                      title={t("listView")}
                      aria-label={t("listView")}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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
                        {t(
                          FILTER_CATEGORIES.find((c) => c.type === f.type)
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
                    {t("clearAll", {defaultValue: "Clear all"})}
                  </button>
                </div>
              )}
            </div>

            {/* ─── Content: Table or Grid ─────────────────────── */}
            {viewMode === "list" ? (
              <DataTable
                items={paginatedProperties}
                columns={columns}
                onItemClick={handlePropertyClick}
                onSelect={handleToggleSelect}
                selectedItems={selectedProperties}
                totalItems={sortedProperties.length}
                title="properties"
                sortConfig={sortConfig}
                onSort={handleSort}
                renderItem={renderPropertyRow}
                allSelected={allSelected}
              />
            ) : (
              <div>
                {paginatedProperties.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 shadow-xs rounded-xl border border-gray-200 dark:border-gray-700/60">
                    <div className="text-center py-16 px-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700/60 mb-4">
                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">
                        {t("propertiesGrid.emptyState")}
                      </p>
                      <button
                        type="button"
                        onClick={handleNewProperty}
                        className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
                      >
                        <svg className="fill-current shrink-0" width="16" height="16" viewBox="0 0 16 16">
                          <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                        </svg>
                        <span className="ml-2">{t("addProperty")}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {paginatedProperties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onClick={handlePropertyClick}
                        isSelected={selectedProperties.includes(property.id)}
                        onSelect={handleToggleSelect}
                        getMainPhotoUrl={getMainPhotoUrl}
                        t={t}
                        onOpenAIAssistant={handleOpenAIAssistant}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {sortedProperties.length > 0 && (
              <div className="mt-8">
                <PaginationClassic
                  currentPage={state.currentPage}
                  totalItems={sortedProperties.length}
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

export default PropertiesList;
