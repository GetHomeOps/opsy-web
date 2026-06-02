import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {ChevronDown} from "lucide-react";
import {usStates} from "../data/states";

const VIEWPORT_PAD = 8;
const GAP = 4;
const MAX_MENU_HEIGHT = 256;
const TYPEAHEAD_RESET_MS = 500;

function findState(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return (
    usStates.find((s) => s.code.toLowerCase() === trimmed.toLowerCase()) ||
    usStates.find((s) => s.name.toLowerCase() === trimmed.toLowerCase())
  );
}

function isStateSelected(state, value, labelFormat) {
  const match = findState(value);
  if (!match) return false;
  if (labelFormat === "name") {
    return match.name === state.name;
  }
  return match.code === state.code;
}

function findTypeaheadIndex(prefix) {
  const p = String(prefix || "").trim().toLowerCase();
  if (!p) return -1;

  const codeMatch = usStates.findIndex((s) => s.code.toLowerCase().startsWith(p));
  if (codeMatch >= 0) return codeMatch + 1;

  const nameMatch = usStates.findIndex((s) => s.name.toLowerCase().startsWith(p));
  return nameMatch >= 0 ? nameMatch + 1 : -1;
}

function getSelectedListIndex(value) {
  const match = findState(value);
  if (!match) return 0;
  const stateIndex = usStates.findIndex((s) => s.code === match.code);
  return stateIndex >= 0 ? stateIndex + 1 : 0;
}

function optionClassName(isSelected, isHighlighted) {
  if (isSelected) {
    return "text-[#456564] dark:text-emerald-400 bg-gray-50 dark:bg-gray-700/30";
  }
  if (isHighlighted) {
    return "text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700/50";
  }
  return "text-gray-900 dark:text-gray-100";
}

function UsStateSelect({
  value = "",
  onChange,
  className = "",
  buttonClassName = "",
  disabled = false,
  id,
  labelFormat = "code",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typeaheadRef = useRef({prefix: "", timer: null});
  const highlightIndexRef = useRef(0);
  const useFullName = labelFormat === "name";
  const matchedState = findState(value);
  const displayValue = useFullName
    ? matchedState?.name || value || "—"
    : matchedState?.code || value || "—";

  const updateMenuPosition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const measured = listRef.current?.getBoundingClientRect();
    const menuWidth = Math.max(
      rect.width,
      measured?.width || 0,
      useFullName ? 192 : rect.width,
    );

    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - VIEWPORT_PAD);
    const spaceAbove = Math.max(0, rect.top - VIEWPORT_PAD);
    const openUpward =
      spaceBelow < Math.min(MAX_MENU_HEIGHT, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(MAX_MENU_HEIGHT, (openUpward ? spaceAbove : spaceBelow) - GAP),
    );

    let left = rect.left;
    left = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - VIEWPORT_PAD - menuWidth),
    );

    setMenuStyle({
      position: "fixed",
      left,
      width: menuWidth,
      maxHeight,
      zIndex: 250,
      ...(openUpward
        ? {bottom: window.innerHeight - rect.top + GAP, top: "auto"}
        : {top: rect.bottom + GAP, bottom: "auto"}),
    });
  }, [useFullName]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }

    updateMenuPosition();
    const raf = requestAnimationFrame(updateMenuPosition);

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    const listEl = listRef.current;
    const ro =
      listEl &&
      new ResizeObserver(() => {
        updateMenuPosition();
      });
    if (listEl && ro) ro.observe(listEl);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      ro?.disconnect();
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      const inRoot = rootRef.current?.contains(e.target);
      const inList = listRef.current?.contains(e.target);
      if (!inRoot && !inList) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const scrollToListIndex = useCallback((index) => {
    const list = listRef.current;
    if (!list || index < 0) return;
    const option = list.querySelectorAll('[role="option"]')[index];
    option?.scrollIntoView({block: "nearest"});
  }, []);

  const resetTypeahead = useCallback(() => {
    const ta = typeaheadRef.current;
    if (ta.timer) clearTimeout(ta.timer);
    ta.prefix = "";
    ta.timer = null;
  }, []);

  const handleSelect = useCallback(
    (state) => {
      if (!state) {
        onChange?.("");
      } else {
        onChange?.(useFullName ? state.name : state.code);
      }
      setIsOpen(false);
    },
    [onChange, useFullName],
  );

  useEffect(() => {
    if (!isOpen) {
      resetTypeahead();
      return;
    }

    const idx = getSelectedListIndex(value);
    highlightIndexRef.current = idx;
    setHighlightIndex(idx);
    requestAnimationFrame(() => scrollToListIndex(idx));
  }, [isOpen, value, resetTypeahead, scrollToListIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((idx) => {
          const next = Math.min(idx + 1, usStates.length);
          highlightIndexRef.current = next;
          scrollToListIndex(next);
          return next;
        });
        resetTypeahead();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((idx) => {
          const next = Math.max(idx - 1, 0);
          highlightIndexRef.current = next;
          scrollToListIndex(next);
          return next;
        });
        resetTypeahead();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const idx = highlightIndexRef.current;
        if (idx === 0) {
          handleSelect(null);
        } else {
          handleSelect(usStates[idx - 1]);
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

      e.preventDefault();
      const ta = typeaheadRef.current;
      if (ta.timer) clearTimeout(ta.timer);
      ta.prefix += e.key;
      ta.timer = setTimeout(() => {
        ta.prefix = "";
        ta.timer = null;
      }, TYPEAHEAD_RESET_MS);

      const matchIndex = findTypeaheadIndex(ta.prefix);
      if (matchIndex >= 0) {
        highlightIndexRef.current = matchIndex;
        setHighlightIndex(matchIndex);
        scrollToListIndex(matchIndex);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      resetTypeahead();
    };
  }, [isOpen, handleSelect, scrollToListIndex, resetTypeahead]);

  const menu =
    isOpen &&
    typeof document !== "undefined" &&
    createPortal(
      <ul
        ref={listRef}
        role="listbox"
        style={
          menuStyle || {
            position: "fixed",
            top: 0,
            left: 0,
            visibility: "hidden",
            pointerEvents: "none",
            width: useFullName ? 192 : 76,
          }
        }
        className="py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-y-auto"
      >
        <li>
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 ${optionClassName(
              !value,
              highlightIndex === 0 && !!value,
            )}`}
            onMouseEnter={() => {
              highlightIndexRef.current = 0;
              setHighlightIndex(0);
            }}
            onClick={() => handleSelect(null)}
          >
            —
          </button>
        </li>
        {usStates.map((state, stateIndex) => {
          const listIndex = stateIndex + 1;
          const selected = isStateSelected(state, value, labelFormat);
          return (
          <li key={state.code}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 ${optionClassName(
                selected,
                highlightIndex === listIndex && !selected,
              )}`}
              onMouseEnter={() => {
                highlightIndexRef.current = listIndex;
                setHighlightIndex(listIndex);
              }}
              onClick={() => handleSelect(state)}
            >
              {useFullName ? state.name : state.code}
            </button>
          </li>
          );
        })}
      </ul>,
      document.body,
    );

  return (
    <>
      <div
        className={`relative ${useFullName ? "w-full min-w-[10rem]" : "w-[4.75rem]"} ${className}`}
        ref={rootRef}
      >
        <button
          ref={buttonRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((open) => !open)}
          className={`form-select flex w-full items-center justify-between !pr-2 py-1.5 pl-2.5 text-sm text-left bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 focus:border-[#456564] dark:focus:border-[#456564] rounded-md ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          } ${buttonClassName}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span
            className={`truncate ${
              value ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
            } ${useFullName ? "" : "tabular-nums"}`}
          >
            {displayValue}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
      {menu}
    </>
  );
}

export default UsStateSelect;
