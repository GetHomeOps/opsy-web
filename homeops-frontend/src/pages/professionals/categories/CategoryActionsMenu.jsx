import React, {useState, useRef, useEffect} from "react";
import {useTranslation} from "react-i18next";
import {ChevronDown, Trash2} from "lucide-react";
import Transition from "../../../utils/Transition";

/**
 * Primary + form-level actions (e.g. delete). Label is uppercase ACTIONS for visibility.
 */
export default function CategoryActionsMenu({onRequestDelete, buttonClassName = ""}) {
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

  const btnBase =
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-colors shadow-sm";

  return (
    <div className="relative inline-flex shrink-0" ref={wrapRef}>
      <button
        type="button"
        className={`${btnBase} uppercase text-xs font-semibold tracking-wider ${buttonClassName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {t("actions", {defaultValue: "ACTIONS"})}
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
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
              className="w-full flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/80 px-3 py-2 text-left"
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
