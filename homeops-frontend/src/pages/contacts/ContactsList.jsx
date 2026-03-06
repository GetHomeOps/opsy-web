import React, {
  useState,
  useEffect,
  useContext,
  useReducer,
  useMemo,
  useRef,
} from "react";
import {useNavigate} from "react-router-dom";

import {useTranslation} from "react-i18next";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PaginationClassic from "../../components/PaginationClassic";
import contactContext from "../../context/ContactContext";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import ContactsTable from "./ContactsTable";
import ListDropdown from "../../partials/buttons/ListDropdown";

const PAGE_STORAGE_KEY = "contacts_list_page";

const FILTER_CATEGORIES = [
  {type: "type", labelKey: "contactType"},
  {type: "tag", labelKey: "tags"},
];

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
  filteredContacts: [],
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
    case "SET_FILTERED_CONTACTS":
      return {
        ...state,
        filteredContacts: action.payload,
      };
    case "SET_SIDEBAR_OPEN":
      return {...state, sidebarOpen: action.payload};
    default:
      return state;
  }
}

/* ─── Filter Dropdown (like PropertiesList) ───────────────────── */

function FilterDropdown({filterOptions, activeFilters, onAdd, onRemove, t}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
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

/* List of Contacts + Create new Contact button

Props:

State:
- filteredContacts: filtered list of contacts by search term (on search bar)
- currentPage: current page number
- itemsPerPage: number of items per page
- searchTerm: search term
- isSubmitting: whether the form is being submitted
- dangerModalOpen: whether the danger modal is open
- sidebarOpen: whether the sidebar is open

ContactsList -> ContactsTable, PaginationClassic

*/
function ContactsList() {
  const {
    contacts,
    selectedItems,
    handleToggleSelection,
    deleteContact,
    bulkDuplicateContacts,
    listSortedItems,
    sortConfig,
    handleSort,
  } = useContext(contactContext);

  // Set up component's initial state
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    currentPage: Number(localStorage.getItem(PAGE_STORAGE_KEY)) || 1,
  });

  const navigate = useNavigate();
  const {t, i18n} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  // Initialize ContactsList when contacts change
  useEffect(() => {
    if (contacts && contacts.length > 0) {
      dispatch({type: "SET_FILTERED_CONTACTS", payload: contacts});
    }
  }, [contacts]);

  // Update localStorage when page changes
  useEffect(() => {
    if (state.currentPage) {
      localStorage.setItem(PAGE_STORAGE_KEY, state.currentPage);
    }
  }, [state.currentPage]);

  // Handle navigation to contact details
  const handleContactClick = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const currentIndex =
      state.filteredContacts.findIndex((c) => c.id === contactId) + 1;
    const totalItems = state.filteredContacts.length;
    const visibleContactIds = state.filteredContacts.map((c) => c.id);

    navigate(`/${accountUrl}/contacts/${contactId}`, {
      state: {
        currentIndex,
        totalItems,
        visibleContactIds,
      },
    });
  };

  // Handle navigation to new contact form
  const handleNewContact = () => {
    navigate(`/${accountUrl}/contacts/new`);
  };

  /* ─── Filter options from data ───────────────────────────────── */

  const uniqueTags = useMemo(() => {
    const byId = new Map();
    (contacts || []).forEach((c) => {
      (c.tags || []).forEach((tag) => {
        const t = typeof tag === "object" ? tag : { id: tag, name: String(tag) };
        if (t?.id != null && !byId.has(t.id)) {
          byId.set(t.id, { id: t.id, name: t.name || String(t.id) });
        }
      });
    });
    return [...byId.values()].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [contacts]);

  const filterOptions = useMemo(
    () => ({
      type: [
        {value: "individual", label: t("individual")},
        {value: "company", label: t("company")},
      ],
      tag: uniqueTags.map((t) => ({value: String(t.id), label: t.name})),
    }),
    [uniqueTags, t],
  );

  /* ─── Filtered contacts (search + filters, like PropertiesList) ── */

  const filteredContacts = useMemo(() => {
    const sortedItems = listSortedItems || [];
    if (!contacts || contacts.length === 0) return [];
    if (!sortedItems.length) return [];

    const filtersByType = {};
    state.activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    return sortedItems.filter((contact) => {
      const term = (state.searchTerm || "").toLowerCase();
      if (term) {
        const contactName = (contact.name || "").toLowerCase();
        const email = (contact.email || "").toLowerCase();
        const phone = (contact.phone || "").toLowerCase();
        const jobPosition = (contact.job_position || "").toLowerCase();
        const type =
          contact.type_id === 1 ? t("individual") : t("company");
        const matchesSearch =
          contactName.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          jobPosition.includes(term) ||
          type.includes(term) ||
          (contact.tags || []).some((tag) => {
            const name =
              typeof tag === "object" ? tag?.name : String(tag ?? "");
            return name.toLowerCase().includes(term);
          });
        if (!matchesSearch) return false;
      }

      if (filtersByType.type && filtersByType.type.length) {
        const contactType =
          contact.type === 2 || contact.type_id === 2
            ? "company"
            : "individual";
        if (!filtersByType.type.includes(contactType)) return false;
      }

      if (filtersByType.tag && filtersByType.tag.length) {
        const contactTagIds = new Set(
          (contact.tags || []).map((t) =>
            typeof t === "object" ? String(t?.id) : String(t),
          ),
        );
        const matchesAny = filtersByType.tag.some((tagId) =>
          contactTagIds.has(String(tagId)),
        );
        if (!matchesAny) return false;
      }

      return true;
    });
  }, [
    state.searchTerm,
    state.activeFilters,
    contacts,
    listSortedItems,
    t,
  ]);

  // Update filtered contacts in state whenever they change
  useEffect(() => {
    dispatch({type: "SET_FILTERED_CONTACTS", payload: filteredContacts});
  }, [filteredContacts]);

  // Validate current page - reset to page 1 if current page is invalid
  useEffect(() => {
    if (filteredContacts.length > 0) {
      const maxPage = Math.ceil(filteredContacts.length / state.itemsPerPage);
      if (state.currentPage > maxPage) {
        dispatch({type: "SET_CURRENT_PAGE", payload: 1});
      }
    }
  }, [filteredContacts.length, state.itemsPerPage, state.currentPage]);

  // Memoize allVisibleSelected
  const allVisibleSelected = useMemo(
    () =>
      state.filteredContacts.length > 0 &&
      state.filteredContacts.every((contact) =>
        selectedItems.includes(contact.id),
      ),
    [selectedItems, state.filteredContacts],
  );

  // Handle items per page change
  function handleItemsPerPageChange(value) {
    dispatch({type: "SET_ITEMS_PER_PAGE", payload: Number(value)});
  }

  // Handle banner timeout
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

  /* Handles delete button click */
  function handleDeleteClick() {
    if (selectedItems.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: "Please select at least one contact to delete",
        },
      });
      return;
    }
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  /* Handles bulk duplication of selected contacts */
  async function handleDuplicate() {
    if (selectedItems.length === 0) return;

    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      const duplicatedContacts = await bulkDuplicateContacts(selectedItems);

      // Show success message
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: `${duplicatedContacts.length} contact${
            duplicatedContacts.length !== 1 ? "s" : ""
          } duplicated successfully`,
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Error duplicating contacts. Error: ${error}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /* Handles bulk deletion of selected contacts */
  async function handleDelete() {
    if (selectedItems.length === 0) return;

    // Close modal immediately when Accept is clicked
    dispatch({type: "SET_DANGER_MODAL", payload: false});

    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      // Store the IDs of successfully deleted contacts
      const deletedIds = [];

      // Delete each selected contact
      for (const contactId of selectedItems) {
        try {
          const res = await deleteContact(contactId);
          if (res) {
            deletedIds.push(contactId);
          }
        } catch (error) {
          console.error(`Error deleting contact ${contactId}:`, error);
          // Continue with other deletions even if one fails
        }
      }

      // Only show success if at least one contact was deleted
      if (deletedIds.length > 0) {
        // Clear all successfully deleted items from selection at once
        handleToggleSelection(deletedIds, false);

        // If we're on a page that might be empty after deletion, go back one page
        const remainingItems =
          state.filteredContacts.length - deletedIds.length;
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
            message: `${deletedIds.length} contact${
              deletedIds.length !== 1 ? "s" : ""
            } deleted successfully`,
          },
        });
      } else {
        // Show error message only if no contacts were deleted
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: "No contacts were deleted. Please try again.",
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
          message: `Error deleting contacts. Please try again.`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  // Handle page change
  const handlePageChange = (page) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: page});
  };


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
                    Delete {selectedItems.length} contact
                    {selectedItems.length !== 1 ? "s" : ""}?
                  </div>
                </div>
                {/* Modal content */}
                <div className="text-sm mb-10">
                  <div className="space-y-2">
                    <p>
                      {t("contactDeleteConfirmationMessage")}
                      {selectedItems.length !== 1 ? "s" : ""}?{" "}
                      {t("actionCantBeUndone")}
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
                  {t("contacts")}
                </h1>
              </div>

              {/* Right: Actions */}
              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
                {/* Actions dropdown (gear): Import always; Duplicate/Delete when selection) */}
                <ListDropdown
                  align="right"
                  hasSelection={selectedItems.length > 0}
                  onImport={() => navigate(`/${accountUrl}/contacts/import`)}
                  onDelete={handleDeleteClick}
                  onDuplicate={handleDuplicate}
                />

                {/* Add Contact button */}
                <button
                  className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
                  onClick={handleNewContact}
                >
                  <svg
                    className="fill-current shrink-0 xs:hidden"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span className="max-xs:sr-only">{t("addContact")}</span>
                </button>
              </div>
            </div>

            {/* Search bar with filter (like PropertiesList) */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="text"
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm"
                    placeholder={t("searchContactsPlaceholder")}
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
              {state.activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {state.activeFilters.map((f) => (
                    <span
                      key={`${f.type}-${f.value}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                    >
                      {f.label || f.value}
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "REMOVE_FILTER",
                            payload: {type: f.type, value: f.value},
                          })
                        }
                        className="hover:opacity-75"
                        aria-label="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => dispatch({type: "CLEAR_FILTERS"})}
                    className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    {t("clearFilters") || "Clear filters"}
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <>
              <ContactsTable
                  contacts={state.filteredContacts}
                  onToggleSelect={handleToggleSelection}
                  selectedItems={selectedItems}
                  totalContacts={state.filteredContacts.length}
                  currentPage={state.currentPage}
                  itemsPerPage={state.itemsPerPage}
                  onContactClick={handleContactClick}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                {/* Pagination */}
              {state.filteredContacts.length > 0 && (
                <div className="mt-8">
                  <PaginationClassic
                    currentPage={state.currentPage}
                    totalItems={state.filteredContacts.length}
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
export default ContactsList;
