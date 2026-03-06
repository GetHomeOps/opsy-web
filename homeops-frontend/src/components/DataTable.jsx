import React from "react";
import {useTranslation} from "react-i18next";
import {useSortIndicator} from "../hooks/useSortIndicator";

function DataTable({
  // Required props
  items,
  columns,
  onItemClick,
  onSelect,
  selectedItems,
  totalItems,
  title,

  // Optional props
  isCollapsible = false,
  groupBy = null,
  expandedGroups = [],
  onGroupExpand = null,
  renderGroupHeader = null,
  renderItem = null,
  sortConfig = null,
  onSort = null,
  emptyMessage = "No items found",
  className = "",
  allSelected = false,
  onSelectAll = null,
}) {
  const {t} = useTranslation();
  const renderSortIndicator = useSortIndicator();

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      const currentIds = items.map((item) => item.id);
      onSelect(currentIds, !allSelected);
    }
  };

  const handleSelect = (id) => {
    onSelect(id);
  };

  const renderTableHeader = () => (
    <thead className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-900/20 border-t border-b border-gray-100 dark:border-gray-700/60">
      <tr>
        <th className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap w-px">
          <div className="flex items-center">
            <label className="inline-flex">
              <span className="sr-only">Select all</span>
              <input
                className="form-checkbox"
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                disabled={items.length === 0}
              />
            </label>
          </div>
        </th>
        {columns.map((column) => (
          <th
            key={column.key}
            className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap"
          >
            {column.sortable ? (
              <button
                className="font-semibold text-left flex items-center justify-between w-full"
                onClick={() => onSort && onSort(column.key)}
              >
                <div className="text-xs uppercase">{t(column.label)}</div>
                {renderSortIndicator(sortConfig, column.key)}
              </button>
            ) : (
              <div className="font-semibold text-left flex items-center justify-between w-full">
                <div className="text-xs uppercase">{t(column.label)}</div>
              </div>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );

  const renderTableBody = () => {
    const isEmpty =
      isCollapsible && groupBy
        ? Object.keys(groupBy).length === 0
        : items.length === 0;

    if (isEmpty) {
      return (
        <tr>
          <td
            colSpan={columns.length + 1}
            className="px-2 first:pl-5 last:pr-5 py-8 text-gray-500 dark:text-gray-400"
          >
            <div className="text-center w-full">{t(emptyMessage || "noItemsFound")}</div>
          </td>
        </tr>
      );
    }

    if (isCollapsible && groupBy) {
      return Object.entries(groupBy).map(
        ([groupId, groupItems], groupIndex, groupArray) => {
          const isExpanded = expandedGroups.includes(groupId);
          const isLastGroup = groupIndex === groupArray.length - 1;
          const isLastItemInLastGroup = isLastGroup && groupItems.length > 0;

          return (
            <React.Fragment key={groupId}>
              {renderGroupHeader(
                groupId,
                groupItems,
                isExpanded,
                onGroupExpand
              )}
              {isExpanded &&
                groupItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`${
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-700/10"
                        : "bg-gray-50 dark:bg-gray-700/20"
                    } hover:bg-gray-200/60 dark:hover:bg-gray-700/90`}
                  >
                    {renderItem(
                      item,
                      handleSelect,
                      selectedItems,
                      onItemClick,
                      isLastItemInLastGroup && index === groupItems.length - 1
                    )}
                  </tr>
                ))}
            </React.Fragment>
          );
        }
      );
    }

    return items.map((item, index) => (
      <tr
        key={item.id}
        className={`${
          index % 2 === 0
            ? "bg-white dark:bg-gray-700/10"
            : "bg-gray-50 dark:bg-gray-700/20"
        } hover:bg-gray-200/60 dark:hover:bg-gray-700/90`}
      >
        {renderItem(
          item,
          handleSelect,
          selectedItems,
          onItemClick,
          index === items.length - 1
        )}
      </tr>
    ));
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 shadow-xs rounded-xl relative ${className}`}
    >
      <header className="px-5 py-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          {t(title)}{" "}
          <span className="text-gray-400 dark:text-gray-500 font-medium">
            {totalItems}
          </span>
        </h2>
      </header>
      <div className="overflow-hidden rounded-b-xl">
        <div className="overflow-x-auto">
          <table className="table-auto w-full dark:text-gray-300">
            {renderTableHeader()}
            <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
              {renderTableBody()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
