"use client";

import * as React from "react";
import {addYears, subYears} from "date-fns";
import {DayPicker} from "react-day-picker";

import {cn} from "../../lib/utils";

const DEFAULT_START_MONTH = subYears(new Date(), 50);
const DEFAULT_END_MONTH = addYears(new Date(), 10);

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  startMonth = DEFAULT_START_MONTH,
  endMonth = DEFAULT_END_MONTH,
  navLayout = "around",
  footer,
  labels,
  reverseYears = true,
  ...props
}) {
  const mergedLabels = {
    labelMonthDropdown: () => "Choose the Month",
    labelYearDropdown: () => "Choose the Year",
    ...labels,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      startMonth={startMonth}
      endMonth={endMonth}
      navLayout={navLayout}
      reverseYears={reverseYears}
      labels={mergedLabels}
      className={cn("p-3 text-gray-600 dark:text-gray-100", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row",
        month_caption:
          "flex justify-center items-center h-8 mb-3 mx-9",
        caption_label:
          "relative z-[1] inline-flex items-center gap-1 text-[13px] font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 h-8 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors cursor-pointer",
        chevron: "fill-current",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between h-8 z-10 pointer-events-none",
        button_previous:
          "pointer-events-auto inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none",
        button_next:
          "pointer-events-auto inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none",
        dropdowns:
          "inline-flex items-center gap-1.5",
        dropdown_root: "relative inline-flex items-center",
        dropdown:
          "absolute z-[2] opacity-0 inset-0 w-full cursor-pointer appearance-none border-none",
        months_dropdown: "",
        years_dropdown: "",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-gray-400 dark:text-gray-500 font-medium w-9 text-[0.75rem] text-center pb-2",
        week: "flex w-full mt-1",
        day: "h-9 w-9 text-center text-sm p-0 relative rounded-md [&:has([aria-selected])]:bg-emerald-600 [&:has([aria-selected])]:rounded-md focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 hover:bg-emerald-600 hover:text-white h-9 w-9 p-0 font-medium aria-selected:opacity-100",
        range_start: "rounded-l-lg",
        range_end: "day-range-end rounded-r-lg",
        selected:
          "bg-emerald-600 text-white rounded-md hover:bg-emerald-600 hover:text-white focus:bg-emerald-600 focus:text-white",
        today: "ring-2 ring-emerald-600 ring-inset",
        outside:
          "day-outside text-gray-400 dark:text-gray-500 aria-selected:bg-emerald-600/50 aria-selected:text-gray-400 dark:text-gray-500",
        disabled: "text-gray-400 dark:text-gray-500 opacity-50",
        range_middle:
          "aria-selected:bg-emerald-600/70 aria-selected:text-white",
        hidden: "invisible",
        footer:
          "flex justify-center pt-2.5 pb-0.5 border-t border-gray-200 dark:border-gray-600 mt-2",
        ...classNames,
      }}
      components={{
        Chevron: ({orientation, ...chevronProps}) => {
          if (orientation === "left") {
            return (
              <svg
                {...chevronProps}
                width="7"
                height="11"
                viewBox="0 0 7 11"
              >
                <path d="M5.4 10.8l1.4-1.4-4-4 4-4L5.4 0 0 5.4z" />
              </svg>
            );
          }
          if (orientation === "down") {
            return (
              <svg
                {...chevronProps}
                width="10"
                height="6"
                viewBox="0 0 10 6"
              >
                <path d="M1.4 0L0 1.4 5 6.4l5-5L8.6 0 5 3.6z" />
              </svg>
            );
          }
          return (
            <svg
              {...chevronProps}
              width="7"
              height="11"
              viewBox="0 0 7 11"
            >
              <path d="M1.4 10.8L0 9.4l4-4-4-4L1.4 0l5.4 5.4z" />
            </svg>
          );
        },
      }}
      footer={footer}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export {Calendar};
