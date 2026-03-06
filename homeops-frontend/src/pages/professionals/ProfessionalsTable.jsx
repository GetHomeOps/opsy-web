import React, {useMemo} from "react";
import {Shield} from "lucide-react";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";

function ProfessionalsTable({
  professionals,
  onToggleSelect,
  selectedItems,
  totalProfessionals,
  currentPage,
  itemsPerPage,
  onProfessionalClick,
  sortConfig,
  onSort,
}) {
  const currentProfessionals = useMemo(() => {
    if (!professionals) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return professionals.slice(start, start + itemsPerPage);
  }, [currentPage, itemsPerPage, professionals]);

  const allSelected = useMemo(() => {
    return (
      currentProfessionals.length > 0 &&
      currentProfessionals.every((pro) => selectedItems.includes(pro.id))
    );
  }, [currentProfessionals, selectedItems]);

  const columns = [
    {
      key: "company_name",
      label: "Company",
      sortable: true,
      className: "font-medium text-gray-800 dark:text-gray-100",
      render: (value) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "first_name",
      label: "Contact Name",
      sortable: true,
      render: (value, item) => (
        <span className="text-gray-700 dark:text-gray-300">
          {[item.first_name, item.last_name].filter(Boolean).join(" ") || (
            <span className="text-gray-400">&mdash;</span>
          )}
        </span>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (value) => (
        <span className="text-gray-600 dark:text-gray-400">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "category_name",
      label: "Category",
      sortable: true,
      render: (value) => (
        <span className="text-gray-700 dark:text-gray-300">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "subcategory_name",
      label: "Subcategory",
      sortable: true,
      render: (value) => (
        <span className="text-gray-600 dark:text-gray-400">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "city",
      label: "Location",
      sortable: true,
      render: (value, item) => (
        <span className="text-gray-600 dark:text-gray-400">
          {value || item.state
            ? [value, item.state].filter(Boolean).join(", ")
            : <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "is_verified",
      label: "Status",
      sortable: false,
      render: (value, item) => (
        <div className="flex items-center gap-2">
          {value && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
              <Shield className="w-3 h-3" />
              Verified
            </span>
          )}
          {item.is_active !== false ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              Inactive
            </span>
          )}
        </div>
      ),
    },
  ];

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
    <DataTable
      items={currentProfessionals}
      columns={columns}
      onItemClick={onProfessionalClick}
      onSelect={onToggleSelect}
      selectedItems={selectedItems}
      totalItems={totalProfessionals}
      title="professionals"
      sortConfig={sortConfig}
      onSort={onSort}
      renderItem={renderItem}
      allSelected={allSelected}
    />
  );
}

export default ProfessionalsTable;
