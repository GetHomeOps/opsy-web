import React from "react";
import {Calendar, User, FileText, X} from "lucide-react";

/**
 * Card component for displaying a single maintenance record.
 */
function MaintenanceRecordCard({record, onEdit, onDelete, contacts = []}) {
  const contractorDisplay =
    record.contractor != null && record.contractor !== ""
      ? contacts.find((c) => String(c.id) === String(record.contractor))?.name ||
        record.contractor
      : null;
  const formatDate = (dateString) => {
    if (!dateString) return "No date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(record.date)}
            </span>
            {record.status && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  record.status === "Completed"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : record.status === "Scheduled"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                }`}
              >
                {record.status}
              </span>
            )}
          </div>

          {contractorDisplay && (
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {contractorDisplay}
              </span>
            </div>
          )}

          {record.description && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
              {record.description}
            </p>
          )}

          {record.files && record.files.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              {record.files.map((file, idx) => (
                <span
                  key={idx}
                  className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
                >
                  {file.name || file}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(record)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Edit record"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(record.id)}
            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Delete record"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MaintenanceRecordCard;
