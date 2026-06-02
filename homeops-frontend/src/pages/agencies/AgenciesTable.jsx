import React, {useMemo} from "react";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";

function AgenciesTable({
  agencies,
  onToggleSelect,
  selectedItems,
  totalAgencies,
  onAgencyClick,
  sortConfig,
  onSort,
}) {
  const rowItems = agencies ?? [];

  const allSelected = useMemo(() => {
    return (
      rowItems.length > 0 &&
      rowItems.every((agency) => selectedItems.includes(agency.id))
    );
  }, [rowItems, selectedItems]);

  const columns = [
    {
      key: "name",
      label: "agency",
      sortable: true,
      render: (value, item) => (
        <div className="flex items-center gap-3 min-w-0">
          {item.logoDisplayUrl ? (
            <img
              src={item.logoDisplayUrl}
              alt=""
              className="w-9 h-9 rounded-lg object-cover border border-gray-200 dark:border-gray-600 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 shrink-0">
              —
            </div>
          )}
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        </div>
      ),
    },
    {
      key: "city",
      label: "City",
      sortable: true,
      render: (value) => (
        <span className="text-gray-600 dark:text-gray-400">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "state",
      label: "State",
      sortable: true,
      render: (value) => (
        <span className="text-gray-600 dark:text-gray-400">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "website",
      label: "Website",
      sortable: true,
      render: (value) => (
        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[200px] inline-block">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
            value === "approved"
              ? "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]"
              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
          }`}
        >
          {value || "—"}
        </span>
      ),
    },
  ];

  const renderItem = (item, handleSelect, selected, onItemClick) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selected.includes(item.id)}
      onItemClick={onItemClick}
    />
  );

  return (
    <DataTable
      items={rowItems}
      columns={columns}
      onItemClick={onAgencyClick}
      onSelect={onToggleSelect}
      selectedItems={selectedItems}
      totalItems={totalAgencies}
      title="agencies"
      sortConfig={sortConfig}
      onSort={onSort}
      renderItem={renderItem}
      allSelected={allSelected}
    />
  );
}

export default AgenciesTable;
