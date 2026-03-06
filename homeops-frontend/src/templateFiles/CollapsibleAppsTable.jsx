import React, {useMemo, useContext} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import AppContext from "../../context/AppContext";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import {icons} from "../../assets/icons";

// Get category name from ID
const getCategoryName = (categoryId, categories) => {
  const category = categories.find((cat) => cat.id === Number(categoryId));
  return category ? category.name : "";
};

function CollapsibleAppsTable({
  filteredApps,
  selectedItems,
  onToggleSelect,
  expandedCategories,
  setExpandedCategories,
  categories,
}) {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const {
    groupSortConfig,
    handleGroupSort,
    groupSortedItems = [],
    groupedAppsList = [],
    apps = [],
  } = useContext(AppContext);

  // Sort the filtered apps based on the current sort configuration
  const sortedApps = useMemo(() => {
    if (!groupSortConfig) return filteredApps;

    return [...filteredApps].sort((a, b) => {
      const {key, direction} = groupSortConfig;
      const aValue =
        key === "category_id" ? getCategoryName(a[key], categories) : a[key];
      const bValue =
        key === "category_id" ? getCategoryName(b[key], categories) : b[key];

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredApps, groupSortConfig, categories]);

  // Group sorted items by category and keep categories sorted alphabetically
  const groupedItems = useMemo(() => {
    // First, group the sorted apps by category
    const grouped = sortedApps.reduce((acc, app) => {
      const categoryName = getCategoryName(app.category_id, categories);
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(app);
      return acc;
    }, {});

    // Create a new object with sorted categories
    const sortedGroups = {};
    Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .forEach((category) => {
        sortedGroups[category] = grouped[category];
      });

    return sortedGroups;
  }, [sortedApps, categories]);

  // Get visible items (only from expanded categories)
  const visibleItems = useMemo(() => {
    return Object.entries(groupedItems)
      .filter(([category]) => expandedCategories.includes(category))
      .flatMap(([_, items]) => items);
  }, [groupedItems, expandedCategories]);

  // Check if all visible items are selected
  const allVisibleSelected = useMemo(() => {
    return (
      visibleItems.length > 0 &&
      visibleItems.every((item) => selectedItems.includes(item.id))
    );
  }, [visibleItems, selectedItems]);

  // Handle select all for visible items
  const handleSelectAll = () => {
    const visibleIds = visibleItems.map((item) => item.id);
    onToggleSelect(visibleIds, !allVisibleSelected);
  };

  // Auto-expand categories that have filtered results
  React.useEffect(() => {
    if (filteredApps.length > 0 && filteredApps.length < apps.length) {
      const categoriesWithResults = Object.keys(groupedItems);
      setExpandedCategories((prev) => {
        const currentExpanded = Array.isArray(prev) ? prev : [];
        // Keep already expanded categories and add new ones with results
        return [...new Set([...currentExpanded, ...categoriesWithResults])];
      });
    }
  }, [filteredApps, groupedItems, apps.length]);

  // Define columns configuration
  const columns = [
    {
      key: "name",
      label: "name",
      sortable: true,
      className: "font-medium text-gray-800 dark:text-gray-100",
    },
    {
      key: "icon",
      label: "icon",
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          {value ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-gray-600 dark:text-gray-300"
            >
              <path d={icons[value].svgPath} />
            </svg>
          ) : (
            <span className="text-gray-600 dark:text-gray-300 text-xs">
              {t("noIcon")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "url",
      label: "URL",
      sortable: true,
      className: "text-gray-600 dark:text-gray-300",
    },
    {
      key: "category_id",
      label: "category",
      sortable: true,
      render: (value) => getCategoryName(value, categories),
      className: "text-gray-600 dark:text-gray-300",
    },
    {
      key: "description",
      label: "description",
      sortable: true,
      className: "text-gray-600 dark:text-gray-300",
    },
  ];

  // Custom item renderer
  const renderItem = (item, handleSelect, selectedItems, onItemClick) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selectedItems.includes(item.id)}
      onItemClick={onItemClick}
    />
  );

  // Custom group header renderer
  const renderGroupHeader = (
    categoryName,
    groupItems,
    isExpanded,
    onGroupExpand
  ) => {
    return (
      <tr className="bg-gray-200/90 dark:bg-gray-900/50">
        <td
          colSpan={columns.length + 1}
          className="px-2 first:pl-5 last:pr-5 py-3"
        >
          <button
            className="flex items-center text-gray-600 dark:text-gray-300"
            onClick={() => onGroupExpand(categoryName)}
          >
            <svg
              className={`w-4 h-4 mr-2 fill-current ${
                isExpanded ? "rotate-90" : ""
              }`}
              viewBox="0 0 16 16"
            >
              <path d="M9.4 6.6L5.8 3 4.4 4.4 6.8 7l-2.4 2.6L5.8 11l3.6-3.6-1.4-1.4z" />
            </svg>
            <span className="font-medium">{categoryName}</span>
            <span className="ml-2 text-gray-500 dark:text-gray-400">
              ({groupItems.length})
            </span>
          </button>
        </td>
      </tr>
    );
  };

  const handleAppClick = (app) => {
    if (!app) {
      console.warn("Invalid app");
      return;
    }

    // Get all visible apps in the correct order
    const visibleApps = Object.entries(groupedItems)
      .filter(([categoryName]) => expandedCategories.includes(categoryName))
      .flatMap(([_, apps]) => apps);

    const currentIndex = visibleApps.findIndex(
      (visibleApp) => visibleApp.id === app.id
    );

    if (currentIndex === -1) {
      console.warn("App not found in visible apps:", app);
      return;
    }

    navigate(`/admin/apps/${app.id}`, {
      state: {
        currentIndex: currentIndex + 1,
        totalItems: visibleApps.length,
        viewMode: "group",
        visibleAppIds: visibleApps.map((app) => app.id),
      },
    });
  };

  return (
    <DataTable
      items={sortedApps}
      columns={columns}
      onItemClick={handleAppClick}
      onSelect={onToggleSelect}
      selectedItems={selectedItems}
      totalItems={sortedApps.length}
      title="allApplications"
      sortConfig={groupSortConfig}
      onSort={handleGroupSort}
      emptyMessage="noAppsFound"
      renderItem={renderItem}
      isCollapsible={true}
      groupBy={groupedItems}
      expandedGroups={expandedCategories}
      onGroupExpand={(category) => {
        setExpandedCategories((prev) => {
          const currentExpanded = Array.isArray(prev) ? prev : [];
          if (currentExpanded.includes(category)) {
            return currentExpanded.filter((cat) => cat !== category);
          } else {
            return [...currentExpanded, category];
          }
        });
      }}
      renderGroupHeader={renderGroupHeader}
      allSelected={allVisibleSelected}
      onSelectAll={handleSelectAll}
    />
  );
}

export default CollapsibleAppsTable;