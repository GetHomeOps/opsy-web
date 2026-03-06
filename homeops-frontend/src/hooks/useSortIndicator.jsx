import React from "react";

export const useSortIndicator = () => {
  const renderSortIndicator = (sortConfig, key) => {
    if (!sortConfig || !key) return null;

    if (sortConfig.key === key) {
      return (
        <span className="ml-1">
          {sortConfig.direction === "asc" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-up"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M6 15l6 -6l6 6" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-down"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M6 9l6 6l6 -6" />
            </svg>
          )}
        </span>
      );
    }
    return null;
  };

  return renderSortIndicator;
};
