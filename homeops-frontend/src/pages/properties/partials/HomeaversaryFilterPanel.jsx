import React, {useMemo, useState} from "react";

import {Calendar} from "../../../components/ui/calendar";
import {
  HOMEAVERSARY_FILTER_TYPE,
  MONTH_LABEL_KEYS,
  homeaversaryDateLabel,
  homeaversaryDateValue,
  homeaversaryMonthValue,
} from "../helpers/homeaversaryFilter";

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function currentHomeaversaryFilter(activeFilters) {
  return (activeFilters ?? []).find(
    (f) => f.type === HOMEAVERSARY_FILTER_TYPE,
  );
}

function initialMode(activeFilters) {
  const current = currentHomeaversaryFilter(activeFilters);
  if (current?.value?.startsWith("month:")) return "month";
  return "date";
}

/**
 * Date / Month picker used inside the properties Filter dropdown.
 */
export default function HomeaversaryFilterPanel({
  activeFilters,
  t,
  onSelect,
}) {
  const [mode, setMode] = useState(() => initialMode(activeFilters));
  const current = currentHomeaversaryFilter(activeFilters);

  const selectedDate = useMemo(() => {
    if (!current?.value?.startsWith("md:")) return undefined;
    const [mm, dd] = current.value.slice(3).split("-");
    const month = parseInt(mm, 10);
    const day = parseInt(dd, 10);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return undefined;
    const now = new Date();
    return new Date(now.getFullYear(), month - 1, day);
  }, [current]);

  const selectedMonth = useMemo(() => {
    if (!current?.value?.startsWith("month:")) return null;
    const month = parseInt(current.value.slice(6), 10);
    return Number.isFinite(month) ? month : null;
  }, [current]);

  const applyDate = (date) => {
    if (!date) return;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    onSelect?.({
      type: HOMEAVERSARY_FILTER_TYPE,
      value: homeaversaryDateValue(month, day),
      label: homeaversaryDateLabel(month, day),
    });
  };

  const applyMonth = (month) => {
    onSelect?.({
      type: HOMEAVERSARY_FILTER_TYPE,
      value: homeaversaryMonthValue(month),
      label: t(MONTH_LABEL_KEYS[month - 1], {
        defaultValue: MONTH_LABEL_KEYS[month - 1],
      }),
    });
  };

  return (
    <div className="p-3">
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden mb-2">
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
            mode === "date"
              ? "bg-[#456564] text-white"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
          onClick={() => setMode("date")}
        >
          {t("homeaversaryDate", {defaultValue: "Date"})}
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
            mode === "month"
              ? "bg-[#456564] text-white"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
          onClick={() => setMode("month")}
        >
          {t("homeaversaryMonth", {defaultValue: "Month"})}
        </button>
      </div>

      {mode === "date" ? (
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={applyDate}
          fixedWeeks
          className="p-0"
        />
      ) : (
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {MONTH_NUMBERS.map((month) => {
            const active = selectedMonth === month;
            return (
              <button
                key={month}
                type="button"
                className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#456564] text-white"
                    : "bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => applyMonth(month)}
              >
                {t(MONTH_LABEL_KEYS[month - 1], {
                  defaultValue: MONTH_LABEL_KEYS[month - 1],
                })}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
