import React, {useState, useRef, useEffect} from "react";
import {useTranslation} from "react-i18next";
import {ChevronDown, Settings, Trash2} from "lucide-react";
import Transition from "../../../utils/Transition";

/**
 * Category detail actions (e.g. delete).
 * @param {"section" | "toolbar"} [variant="section"] — "toolbar" matches list gear controls; "section" is the richer control for form headers.
 */
export default function CategoryActionsMenu({
  onRequestDelete,
  buttonClassName = "",
  variant = "section",
}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (typeof onRequestDelete !== "function") {
    return null;
  }

  const isToolbar = variant === "toolbar";

  return (
    <div className="relative inline-flex shrink-0" ref={wrapRef}>
      <button
        type="button"
        className={
          isToolbar
            ? `btn px-2.5 bg-white dark:bg-gray-800 border-gray-200 hover:border-gray-300 dark:border-gray-700/60 dark:hover:border-gray-600 text-gray-400 dark:text-gray-500 ${buttonClassName}`
            : `inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-100 shadow-sm transition-colors hover:border-[#456564]/45 hover:bg-[#456564]/[0.07] dark:hover:border-[#7aa3a2]/45 dark:hover:bg-[#456564]/12 ${buttonClassName}`
        }
        aria-label={t("actions", {defaultValue: "Actions"})}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {isToolbar ? (
          <Settings className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" />
        ) : (
          <>
            <Settings
              className="w-4 h-4 shrink-0 text-[#456564] dark:text-[#7aa3a2]"
              aria-hidden
            />
            <span className="max-sm:sr-only">
              {t("actions", {defaultValue: "Actions"})}
            </span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </>
        )}
      </button>
      <Transition
        show={open}
        tag="div"
        className="origin-top-right z-[100] absolute top-full right-0 min-w-[12rem] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mt-1"
        style={{
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        }}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <ul className="py-1">
          <li>
            <button
              type="button"
              className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 text-left"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onRequestDelete();
              }}
            >
              <Trash2 className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
              <span className="text-sm font-medium ml-2 text-red-600 dark:text-red-400">
                {t("deleteCategory", {defaultValue: "Delete category"})}
              </span>
            </button>
          </li>
        </ul>
      </Transition>
    </div>
  );
}
