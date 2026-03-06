import React from "react";

function DataTableItem({
  item,
  columns,
  onSelect,
  isSelected,
  onItemClick,
  onInlineEdit,
  isLastRow,
}) {
  const handleNameClick = (e) => {
    e.stopPropagation();
    if (onInlineEdit) {
      onInlineEdit(item);
    } else if (onItemClick) {
      onItemClick(item);
    }
  };

  return (
    <>
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
      {columns.map((column, index) => (
        <td
          key={column.key}
          className={`px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap cursor-pointer ${
            isLastRow && index === columns.length - 1 ? "rounded-br-xl" : ""
          }`}
          onClick={
            column.key === "name" ? handleNameClick : () => onItemClick(item)
          }
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
