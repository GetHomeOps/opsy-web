import {useCallback} from "react";

/**
 * Hook for generating unique identifiers (names and URLs) for items
 * @param {Object} options Configuration options
 * @param {Array} options.items Array of items to check against
 * @param {string} options.nameKey Key in items that contains the name (default: 'name')
 * @param {string} options.urlKey Key in items that contains the URL (default: 'url')
 * @param {string} options.itemType Type of item ('app' or 'category') to determine suffix
 * @param {Object} options.suffixes Custom suffixes for copies
 * @returns {Object} Functions for generating unique names and URLs
 */
const useUniqueIdentifiers = ({
  items = [],
  nameKey = "name",
  urlKey = "url",
  itemType = "app",
  suffixes = {
    app: {name: "Copy", url: "copy"},
    category: {name: "Copy", url: "copy"},
    contact: {name: "Copy", url: "copy"},
    paymentTerm: {name: "Copy", url: "copy"},
  },
} = {}) => {
  const generateUniqueName = useCallback(
    (baseName, index = 1) => {
      const currentSuffix = suffixes[itemType].name;
      const nameToTry =
        index === 1
          ? `${baseName} (${currentSuffix})`
          : `${baseName} (${currentSuffix} ${index})`;

      const exists = items.some((item) => item[nameKey] === nameToTry);
      if (!exists) return nameToTry;
      return generateUniqueName(baseName, index + 1);
    },
    [items, nameKey, itemType, suffixes]
  );

  const generateUniqueUrl = useCallback(
    (baseUrl, index = 1) => {
      const currentSuffix = suffixes[itemType].url;
      // Clean the baseUrl by removing any existing copy suffixes
      const cleanBaseUrl = baseUrl.replace(
        new RegExp(`-${currentSuffix}(-\\d+)?$`),
        ""
      );

      const urlToTry =
        index === 1
          ? `${cleanBaseUrl}-${currentSuffix}`
          : `${cleanBaseUrl}-${currentSuffix}-${index}`;

      const exists = items.some((item) => item[urlKey] === urlToTry);
      if (!exists) return urlToTry;
      return generateUniqueUrl(baseUrl, index + 1);
    },
    [items, urlKey, itemType, suffixes]
  );

  return {
    generateUniqueName,
    generateUniqueUrl,
  };
};

export default useUniqueIdentifiers;
