import React, {useMemo} from "react";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import {useTranslation} from "react-i18next";
import InlineEditRow from "../../components/InlineEditRow";

function PaymentTermsTable({
  paymentTerms,
  onToggleSelect,
  selectedItems,
  currentPage,
  itemsPerPage,
  onPaymentTermClick,
  sortConfig,
  onSort,
  onInlineEdit,
  onSaveInlineEdit,
  onCancelInlineEdit,
  isSubmitting,
}) {
  const {t} = useTranslation();

  // Memoize columns configuration
  const columns = useMemo(
    () => [
      {
        key: "name",
        label: "name",
        sortable: true,
        className: "font-medium text-gray-800 dark:text-gray-100",
      },
    ],
    [t]
  );

  // Memoize paginated data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return paymentTerms.slice(start, end);
  }, [paymentTerms, currentPage, itemsPerPage]);

  // Memoize selection states
  const allVisibleSelected = useMemo(() => {
    return (
      paginatedData.length > 0 &&
      paginatedData.every((paymentTerm) =>
        selectedItems.includes(paymentTerm.id)
      )
    );
  }, [paginatedData, selectedItems]);

  // Handle select all
  const handleSelectAll = () => {
    const paymentTermIds = paginatedData.map((paymentTerm) => paymentTerm.id);
    onToggleSelect(paymentTermIds, !allVisibleSelected);
  };

  // Custom item renderer with inline editing
  const renderItem = (item, handleSelect, selectedItems, onItemClick) => {
    if (item.isEditing) {
      return (
        <InlineEditRow
          item={item}
          onSave={onSaveInlineEdit}
          onCancel={onCancelInlineEdit}
          isSubmitting={isSubmitting}
        />
      );
    }

    return (
      <DataTableItem
        item={item}
        columns={columns}
        onSelect={handleSelect}
        isSelected={selectedItems.includes(item.id)}
        onItemClick={onItemClick}
        onInlineEdit={onInlineEdit}
      />
    );
  };

  return (
    <DataTable
      items={paginatedData}
      columns={columns}
      onItemClick={onPaymentTermClick}
      onSelect={onToggleSelect}
      selectedItems={selectedItems}
      totalItems={paymentTerms.length}
      title="paymentTerm"
      sortConfig={sortConfig}
      onSort={onSort}
      allSelected={allVisibleSelected}
      onSelectAll={handleSelectAll}
      renderItem={renderItem}
    />
  );
}

export default PaymentTermsTable;
