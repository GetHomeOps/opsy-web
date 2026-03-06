import React, {useState, useEffect, useRef} from "react";
import {useTranslation} from "react-i18next";

function InlineEditRow({item, onSave, onCancel, isSubmitting}) {
  const {t} = useTranslation();
  const [name, setName] = useState(item.name || "");
  const rowRef = useRef(null);

  useEffect(() => {
    setName(item.name || "");
  }, [item.name]);

  // Handle clicks outside the editing row
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rowRef.current && !rowRef.current.contains(event.target)) {
        onCancel();
      }
    };

    // Add event listener after a short delay to avoid immediate cancellation
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onCancel]);

  const handleSave = () => {
    onSave(item, name);
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <>
      <td className="px-2 first:pl-5 last:pr-5 py-1 whitespace-nowrap w-px">
        <div className="flex items-center">
          <label className="inline-flex">
            <span className="sr-only">Select</span>
            <input
              className="form-checkbox bg-white dark:bg-gray-800"
              type="checkbox"
              disabled
            />
          </label>
        </div>
      </td>
      <td className="px-2 first:pl-5 last:pr-5 py-1 whitespace-nowrap">
        <div className="flex items-center space-x-2" ref={rowRef}>
          <input
            type="text"
            className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("enterPaymentTermName")}
            autoFocus
            disabled={isSubmitting}
          />
          <div className="flex items-center space-x-1">
            <button
              className="btn-sm bg-emerald-500/90 hover:bg-emerald-600 text-white disabled:opacity-50 backdrop-blur-sm border border-emerald-400/30 hover:border-emerald-300/50 shadow-sm hover:shadow-md transition-all duration-200 rounded-lg hover:scale-105"
              onClick={handleSave}
              disabled={isSubmitting || !name.trim()}
              title={t("save")}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              className="btn-sm bg-slate-500/90 hover:bg-slate-600 text-white disabled:opacity-50 backdrop-blur-sm border border-slate-400/30 hover:border-slate-300/50 shadow-sm hover:shadow-md transition-all duration-200 rounded-lg hover:scale-105"
              onClick={handleCancel}
              disabled={isSubmitting}
              title={t("cancel")}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </td>
    </>
  );
}

export default InlineEditRow;
