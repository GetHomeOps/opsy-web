import {useState, useMemo, useEffect} from "react";

/**
 * A generic table sorting hook that supports both flat and grouped sorting
 * @param {Array} items - The items to sort
 * @param {string} initialSortKey - The initial key to sort by
 * @param {boolean} groupByKey - Whether to group items by a key before sorting
 * @param {Object} options - Additional options for sorting
 * @param {string} options.groupKey - The key to group by (required if groupByKey is true)
 * @param {string} options.storageKey - Key to use for persisting sort state in localStorage
 * @param {Object} options.customComparators - Custom comparison functions for specific keys
 * @returns {Object} Sorting utilities and sorted items
 */
export const useTableSort = (
  items,
  initialSortKey = "name",
  groupByKey = false,
  options = {}
) => {
  const {groupKey, storageKey, customComparators = {}} = options;

  // Initialize sort config from localStorage if available
  const [sortConfig, setSortConfig] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      return saved
        ? JSON.parse(saved)
        : {key: initialSortKey, direction: "asc"};
    }
    return {key: initialSortKey, direction: "asc"};
  });

  // Persist sort config to localStorage when it changes
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(sortConfig));
    }
  }, [sortConfig, storageKey]);

  // Generic comparison function
  const compareValues = (a, b, key) => {
    // Use custom comparator if provided
    if (customComparators[key]) {
      return customComparators[key](a, b, sortConfig.direction);
    }

    // Default comparison
    const valueA = (a[key] ?? "").toString().toLowerCase();
    const valueB = (b[key] ?? "").toString().toLowerCase();
    return sortConfig.direction === "asc"
      ? valueA.localeCompare(valueB)
      : valueB.localeCompare(valueA);
  };

  // Sort items based on configuration
  const sortedItems = useMemo(() => {
    // Ensure items is always an array
    const safeItems = Array.isArray(items) ? items : [];

    if (!groupByKey) {
      return [...safeItems].sort((a, b) => compareValues(a, b, sortConfig.key));
    }

    // Group items first
    const groupedItems = safeItems.reduce((acc, item) => {
      const groupValue = item[groupKey];
      if (!acc[groupValue]) {
        acc[groupValue] = [];
      }
      acc[groupValue].push(item);
      return acc;
    }, {});

    // Sort items within each group
    const sortedGrouped = {};
    Object.keys(groupedItems)
      .sort((a, b) => a.localeCompare(b)) // Always sort group names alphabetically
      .forEach((group) => {
        sortedGrouped[group] = [...groupedItems[group]].sort((a, b) =>
          compareValues(a, b, sortConfig.key)
        );
      });

    return sortedGrouped;
  }, [items, sortConfig, groupByKey, groupKey, customComparators]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({key, direction});
  };

  return {
    sortedItems,
    sortConfig,
    handleSort,
  };
};
