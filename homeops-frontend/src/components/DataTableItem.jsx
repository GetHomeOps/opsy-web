import React from "react";

function DataTableItem({
  item,
  columns,
  onSelect,
  isSelected,
  onItemClick,
  onInlineEdit,
  isLastRow,
  selectable = true,
}) {
  const handleNameClick = (e) => {
    e.stopPropagation();
    if (onInlineEdit) {
      onInlineEdit(item);
    } else if (onItemClick) {
      onItemClick(item);
    }
  };

  const handleCellClick = (column) => {
    if (!onItemClick && !onInlineEdit) return undefined;
    return column.key === "name"
      ? handleNameClick
      : () => onItemClick?.(item);
  };

  return (
    <>
      {selectable && (
        <td
          className={`px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap w-px ${
            isLastRow ? "rounded-bl-xl" : ""
          }`}
        >
          <div className="flex items-center">
            <label className="inline-flex">
              <span className="sr-only">Select</span>
              <input
                id={item.id}
                className="form-checkbox"
                type="checkbox"
                onChange={() => onSelect(item.id)}
                checked={isSelected}
              />
            </label>
          </div>
        </td>
      )}
      {columns.map((column, index) => (
        <td
          key={column.key}
          className={`px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap ${
            onItemClick || onInlineEdit ? "cursor-pointer" : ""
          } ${
            isLastRow && index === 0 && !selectable ? "rounded-bl-xl" : ""
          } ${
            isLastRow && index === columns.length - 1 ? "rounded-br-xl" : ""
          }`}
          onClick={handleCellClick(column)}
        >
          <div className={column.className || "text-left"}>
            {column.render
              ? column.render(item[column.key], item)
              : item[column.key]}
          </div>
        </td>
      ))}
    </>
  );
}

export default DataTableItem;
