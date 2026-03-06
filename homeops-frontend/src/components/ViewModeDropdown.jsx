import React, {useState, useRef, useEffect} from "react";
import {useTranslation} from "react-i18next";

function ViewModeDropdown({viewMode, setViewMode}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const trigger = useRef(null);
  const dropdown = useRef(null);
  const {t} = useTranslation();

  // Close on click outside
  useEffect(() => {
    const clickHandler = ({target}) => {
      if (!dropdown.current) return;
      if (
        !dropdownOpen ||
        dropdown.current.contains(target) ||
        trigger.current.contains(target)
      )
        return;
      setDropdownOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  });

  // Close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  });

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        className="btn w-64 justify-between min-w-44 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Select view mode"
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        <span className="flex items-center">
          <span>
            {viewMode === "list" ? t("listView") : t("groupByCategory")}
          </span>
        </span>
        <svg className="shrink-0 ml-1" width="11" height="7" viewBox="0 0 11 7">
          <path d="M5.4 6.8L0 1.4 1.4 0l4 4 4-4 1.4 1.4z" fill="currentColor" />
        </svg>
      </button>
      <div
        ref={dropdown}
        className={`origin-top-right z-10 absolute top-full right-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 py-1.5 rounded-lg shadow-lg overflow-hidden mt-1 ${
          dropdownOpen ? "block" : "hidden"
        }`}
      >
        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700/60">
          <button
            className={`flex items-center w-full hover:bg-gray-50 dark:hover:bg-gray-700/20 py-1.5 px-3 cursor-pointer text-sm ${
              viewMode === "list"
                ? "text-violet-500"
                : "text-gray-600 dark:text-gray-300"
            }`}
            onClick={() => {
              setViewMode("list");
              setDropdownOpen(false);
            }}
          >
            <svg
              className="w-3.5 h-3.5 mr-2 fill-current"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15 2h-2V0h-2v2H9V0H7v2H5V0H3v2H1a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V3a1 1 0 00-1-1zm-1 12H2V6h12v8z" />
            </svg>
            <span className="whitespace-nowrap">{t("listView")}</span>
          </button>
          <button
            className={`flex items-center w-full hover:bg-gray-50 dark:hover:bg-gray-700/20 py-1.5 px-3 cursor-pointer text-sm ${
              viewMode === "group"
                ? "text-violet-500"
                : "text-gray-600 dark:text-gray-300"
            }`}
            onClick={() => {
              setViewMode("group");
              setDropdownOpen(false);
            }}
          >
            <svg
              className="w-3.5 h-3.5 mr-2 fill-current"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M7 14c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zM7 2C4.243 2 2 4.243 2 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
              <path d="M15.707 14.293L13.314 11.9a8.019 8.019 0 01-1.414 1.414l2.393 2.393a.997.997 0 001.414 0 .999.999 0 000-1.414z" />
            </svg>
            <span className="whitespace-nowrap">{t("groupByCategory")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewModeDropdown;
