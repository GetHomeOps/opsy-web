import React from "react";

function DeleteButton({selectedItems, onDelete, isSubmitting}) {
  if (!selectedItems || selectedItems.length === 0) {
    return null;
  }

  return (
    <button
      className="btn-sm border-gray-200 hover:border-gray-300 text-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onDelete}
      disabled={isSubmitting}
    >
      <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 16 16">
        <path d="M5 7h2v6H5V7zm4 0h2v6H9V7zm4 0h2v6h-2V7z" />
        <path d="M4 2a2 2 0 012-2h4a2 2 0 012 2v1h4a2 2 0 012 2v6a2 2 0 01-2 2H2a2 2 0 01-2-2V5a2 2 0 012-2h4V2zm1 6a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1H6a1 1 0 01-1-1V8zm4 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1V8z" />
      </svg>
      <span className="ml-2">
        {isSubmitting ? "Deleting..." : `Delete ${selectedItems.length}`}
      </span>
    </button>
  );
}

export default DeleteButton;
