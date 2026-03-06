import React, {useState, useEffect, useCallback, useMemo} from "react";
import {createPortal} from "react-dom";
import {addYears, subYears} from "date-fns";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import AppApi from "../../api/api";
import EventDetailModal from "./EventDetailModal";
import {PAGE_LAYOUT} from "../../constants/layout";
import CalendarScheduleModal from "./CalendarScheduleModal";
import DateOffsetControl from "../../components/DateOffsetControl";
import {Popover, PopoverContent, PopoverTrigger} from "../../components/ui/popover";
import {SkipForward} from "lucide-react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Normalize API event to calendar format.
 * @param {Object} raw - API event (maintenance or inspection)
 * @returns {{ id, title, date, type, propertyId, status, propertyName, address, contractorName, notes, scheduledTime, nextScheduledDate }}
 */
function normalizeEvent(raw) {
  return {
    id: raw.id,
    title: raw.systemName || raw.systemKey || "Event",
    date: raw.scheduledDate,
    type: raw.type,
    propertyId: raw.propertyId,
    status: raw.status,
    propertyName: raw.propertyName,
    address: raw.address,
    contractorName: raw.contractorName ?? null,
    notes: raw.notes ?? null,
    scheduledTime: raw.scheduledTime ?? null,
    nextScheduledDate:
      raw.recurrenceType && raw.recurrenceType !== "one-time"
        ? computeNextDate(raw.scheduledDate, raw.recurrenceType)
        : null,
  };
}

function computeNextDate(dateStr, recurrenceType) {
  const d = new Date(dateStr);
  if (recurrenceType === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (recurrenceType === "semi-annually") d.setMonth(d.getMonth() + 6);
  else if (recurrenceType === "annually") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const VIEW_MODES = ["month", "week", "day"];
const CALENDAR_MIN_DATE = subYears(new Date(), 50);
const CALENDAR_MAX_DATE = addYears(new Date(), 10);

function Calendar() {
  const today = new Date();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [focusedDate, setFocusedDate] = useState(() => new Date(today));
  const [daysInMonth, setDaysInMonth] = useState([]);
  const [startingBlankDays, setStartingBlankDays] = useState([]);
  const [endingBlankDays, setEndingBlankDays] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filterType, setFilterType] = useState(null); // null = all, "maintenance", "inspection"
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalInitialDate, setScheduleModalInitialDate] = useState("");
  const [scheduleModalInitialTime, setScheduleModalInitialTime] = useState("");
  const [jumpPopoverOpen, setJumpPopoverOpen] = useState(false);

  const getDays = useCallback(() => {
    const days = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = new Date(year, month).getDay();
    const endingDayOfWeek = new Date(year, month + 1, 0).getDay();

    const startingBlankDaysArray = [];
    for (let i = 1; i <= startingDayOfWeek; i++) {
      startingBlankDaysArray.push(i);
    }

    const endingBlankDaysArray = [];
    for (let i = 1; i < 7 - endingDayOfWeek; i++) {
      endingBlankDaysArray.push(i);
    }

    const daysArray = [];
    for (let i = 1; i <= days; i++) {
      daysArray.push(i);
    }

    setStartingBlankDays(startingBlankDaysArray);
    setEndingBlankDays(endingBlankDaysArray);
    setDaysInMonth(daysArray);
  }, [month, year]);

  useEffect(() => {
    getDays();
  }, [getDays]);

  const {startDate, endDate, headerTitle} = useMemo(() => {
    if (viewMode === "month") {
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return {
        startDate: start,
        endDate: end,
        headerTitle: `${MONTH_NAMES[month]} ${year}`,
      };
    }
    if (viewMode === "week") {
      const d = new Date(focusedDate);
      const day = d.getDay();
      const start = new Date(d);
      start.setDate(d.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const fmt = (x) => x.toISOString().slice(0, 10);
      return {
        startDate: fmt(start),
        endDate: fmt(end),
        headerTitle: `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`,
      };
    }
    // day
    const d = new Date(focusedDate);
    const fmt = d.toISOString().slice(0, 10);
    return {
      startDate: fmt,
      endDate: fmt,
      headerTitle: d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  }, [viewMode, year, month, focusedDate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    AppApi.getCalendarEvents(startDate, endDate)
      .then((rawEvents) => {
        if (cancelled) return;
        const normalized = rawEvents.map(normalizeEvent);
        setEvents(normalized);
      })
      .catch((err) => {
        if (!cancelled) {
          setEvents([]);
          setLoadError(
            err?.message ||
              "Connection failed. Please check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const filteredEvents = filterType
    ? events.filter((e) => e.type === filterType)
    : events;

  const isToday = (date) => {
    const day = new Date(year, month, date);
    return today.toDateString() === day.toDateString();
  };

  const isFocusedDay = (date) => {
    const day = new Date(year, month, date);
    return focusedDate && day.toDateString() === focusedDate.toDateString();
  };

  const getEventsForDay = (date) => {
    const dayStr = new Date(year, month, date).toDateString();
    return filteredEvents.filter(
      (e) => new Date(e.date).toDateString() === dayStr,
    );
  };

  const getEventsForDate = (d) => {
    const dayStr = d.toDateString();
    return filteredEvents.filter(
      (e) => new Date(e.date).toDateString() === dayStr,
    );
  };

  const weekDays = useMemo(() => {
    if (viewMode !== "week") return [];
    const d = new Date(focusedDate);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(start);
      x.setDate(start.getDate() + i);
      days.push(x);
    }
    return days;
  }, [viewMode, focusedDate]);

  const dayHours = useMemo(() => {
    const hours = [];
    for (let h = 0; h < 24; h++) {
      hours.push(h);
    }
    return hours;
  }, []);

  const eventColorByType = (type) => {
    if (type === "inspection") return "text-white bg-sky-500";
    return "text-white bg-red-500"; // maintenance - lively red
  };

  const formatHour = (h) =>
    h === 0
      ? "12 AM"
      : h < 12
        ? `${h} AM`
        : h === 12
          ? "12 PM"
          : `${h - 12} PM`;

  const handlePrev = () => {
    if (viewMode === "month") {
      const d = new Date(focusedDate);
      d.setMonth(d.getMonth() - 1);
      setFocusedDate(d);
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    } else {
      const d = new Date(focusedDate);
      if (viewMode === "week") d.setDate(d.getDate() - 7);
      else d.setDate(d.getDate() - 1);
      setFocusedDate(d);
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      const d = new Date(focusedDate);
      d.setMonth(d.getMonth() + 1);
      setFocusedDate(d);
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    } else {
      const d = new Date(focusedDate);
      if (viewMode === "week") d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 1);
      setFocusedDate(d);
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    }
  };

  const handleToday = () => {
    const now = new Date();
    setFocusedDate(new Date(now));
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode !== "month" && (focusedDate.getMonth() !== month || focusedDate.getFullYear() !== year)) {
      setFocusedDate(new Date(year, month, 1));
    }
  };

  const handleOffsetApply = (targetDate) => {
    const d = new Date(targetDate);
    setFocusedDate(d);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const refreshEvents = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    AppApi.getCalendarEvents(startDate, endDate)
      .then((rawEvents) => {
        const normalized = rawEvents.map(normalizeEvent);
        setEvents(normalized);
      })
      .catch((err) => {
        setEvents([]);
        setLoadError(
          err?.message ||
            "Connection failed. Please check your connection and try again.",
        );
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const handleEventClick = (e, event) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  const handleEmptySlotClick = (dateStr, timeStr = "") => {
    setScheduleModalInitialDate(dateStr);
    setScheduleModalInitialTime(timeStr);
    setTimeout(() => setScheduleModalOpen(true), 0);
  };

  const handleScheduleButtonClick = () => {
    setScheduleModalInitialDate("");
    setScheduleModalInitialTime("");
    setTimeout(() => setScheduleModalOpen(true), 0);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className={PAGE_LAYOUT.list}>
            <div className="sm:flex sm:justify-between sm:items-center mb-4">
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  {headerTitle}
                </h1>
              </div>

              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2 items-center">
                <button
                  type="button"
                  className="btn px-2.5 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={handlePrev}
                  aria-label={`Previous ${viewMode}`}
                >
                  <svg
                    className="fill-current text-gray-400 dark:text-gray-500"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="btn px-2.5 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={handleNext}
                  aria-label={`Next ${viewMode}`}
                >
                  <svg
                    className="fill-current text-gray-400 dark:text-gray-500"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleToday}
                  className="btn px-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300 text-sm"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={handleScheduleButtonClick}
                  className="btn px-4 bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium"
                >
                  Schedule
                </button>
              </div>
            </div>

            <div className="sm:flex sm:justify-between sm:items-center mb-4">
              <div className="mb-4 sm:mb-0 mr-2">
                <ul className="flex flex-wrap items-center -m-1">
                  <li className="m-1">
                    <button
                      type="button"
                      onClick={() => setFilterType(null)}
                      className={`btn-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400 ${filterType === null ? "border-[#456564] text-[#456564] dark:text-[#7aa3a2]" : ""}`}
                    >
                      <div className="w-1 h-3.5 bg-gray-400 shrink-0" />
                      <span className="ml-1.5">All</span>
                    </button>
                  </li>
                  <li className="m-1">
                    <button
                      type="button"
                      onClick={() => setFilterType("maintenance")}
                      className={`btn-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400 ${filterType === "maintenance" ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
                    >
                      <div className="w-1 h-3.5 bg-red-500 shrink-0" />
                      <span className="ml-1.5">Maintenance</span>
                    </button>
                  </li>
                  <li className="m-1">
                    <button
                      type="button"
                      onClick={() => setFilterType("inspection")}
                      className={`btn-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400 ${filterType === "inspection" ? "border-sky-500 text-sky-600 dark:text-sky-400" : ""}`}
                    >
                      <div className="w-1 h-3.5 bg-sky-500 shrink-0" />
                      <span className="ml-1.5">Inspections</span>
                    </button>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                <Popover open={jumpPopoverOpen} onOpenChange={setJumpPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="btn px-2.5 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                      aria-label="Jump to date"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto min-w-[320px] p-3"
                    align="end"
                    side="bottom"
                    sideOffset={6}
                  >
                    <DateOffsetControl
                      selectedDate={focusedDate}
                      minDate={CALENDAR_MIN_DATE}
                      maxDate={CALENDAR_MAX_DATE}
                      onApply={handleOffsetApply}
                      label="Jump to"
                      applyPrefix="Go to"
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex flex-nowrap -space-x-px shrink-0">
                  {VIEW_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleViewModeChange(mode)}
                      className={`btn px-3 py-1.5 text-sm rounded-none first:rounded-l-lg last:rounded-r-lg ${
                        viewMode === mode
                          ? "bg-[#456564] text-white border-[#456564]"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-xl">
                  <div className="w-8 h-8 border-2 border-[#456564] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {loadError && !loading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/95 dark:bg-gray-800/95 rounded-xl p-6">
                  <p className="text-red-600 dark:text-red-400 font-medium text-center">
                    {loadError}
                  </p>
                  <button
                    type="button"
                    onClick={refreshEvents}
                    className="btn px-4 py-2 bg-[#456564] hover:bg-[#34514f] text-white text-sm"
                  >
                    Retry
                  </button>
                </div>
              )}
              {viewMode === "month" && (
                <>
                  <div className="grid grid-cols-7 gap-px border-b border-gray-200 dark:border-gray-700/60">
                    {DAY_NAMES.map((day) => (
                      <div className="px-1 py-3" key={day}>
                        <div className="text-gray-500 text-sm font-medium text-center lg:hidden">
                          {day.substring(0, 3)}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium text-center hidden lg:block">
                          {day}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700/60">
                    <svg className="sr-only">
                      <defs>
                        <pattern
                          id="stripes"
                          patternUnits="userSpaceOnUse"
                          width="5"
                          height="5"
                          patternTransform="rotate(135)"
                        >
                          <line
                            className="stroke-current text-gray-200 dark:text-gray-700 opacity-50"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="5"
                            strokeWidth="2"
                          />
                        </pattern>
                      </defs>
                    </svg>

                    {startingBlankDays.map((blankday) => (
                      <div
                        className="bg-gray-50 dark:bg-gray-800 h-20 sm:h-28 lg:h-36"
                        key={`start-${blankday}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="100%"
                          height="100%"
                        >
                          <rect
                            width="100%"
                            height="100%"
                            fill="url(#stripes)"
                          />
                        </svg>
                      </div>
                    ))}

                    {daysInMonth.map((day) => {
                      const dayEvents = getEventsForDay(day);
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      return (
                        <div
                          className={`relative bg-white dark:bg-gray-800 h-20 sm:h-28 lg:h-36 overflow-hidden group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isToday(day) || isFocusedDay(day) ? "ring-1 ring-inset ring-[#456564]/30" : ""}`}
                          key={day}
                          onClick={() => {
                            setFocusedDate(new Date(year, month, day));
                            handleEmptySlotClick(dateStr);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setFocusedDate(new Date(year, month, day));
                              handleEmptySlotClick(dateStr);
                            }
                          }}
                          aria-label={`${day} ${MONTH_NAMES[month]} - click to schedule`}
                        >
                          <div className="h-full flex flex-col justify-between">
                            <div className="grow flex flex-col relative p-0.5 sm:p-1.5 overflow-hidden">
                              <>
                                {dayEvents.slice(0, 3).map((event) => (
                                  <button
                                    type="button"
                                    className="relative w-full text-left mb-1 hover:opacity-90 transition-opacity"
                                    key={event.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEventClick(e, event);
                                    }}
                                  >
                                    <div
                                      className={`px-2 py-0.5 rounded-lg overflow-hidden ${eventColorByType(event.type)}`}
                                    >
                                      <div className="text-xs font-semibold truncate">
                                        {event.title}
                                      </div>
                                      <div className="text-xs truncate hidden sm:block opacity-90">
                                        {[
                                          event.scheduledTime
                                            ? (() => {
                                                const [h, m] =
                                                  event.scheduledTime.split(
                                                    ":",
                                                  );
                                                const hour = parseInt(h, 10);
                                                const ampm =
                                                  hour >= 12 ? "PM" : "AM";
                                                const hour12 = hour % 12 || 12;
                                                return `${hour12}:${m} ${ampm}`;
                                              })()
                                            : event.type === "inspection"
                                              ? "Inspection"
                                              : "Maintenance",
                                          event.contractorName,
                                        ]
                                          .filter(Boolean)
                                          .join(" • ")}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                                <div
                                  className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white dark:from-gray-800 to-transparent pointer-events-none"
                                  aria-hidden="true"
                                />
                              </>
                            </div>
                            <div className="flex justify-between items-center p-0.5 sm:p-1.5">
                              {dayEvents.length > 3 && (
                                <button
                                  type="button"
                                  className="text-xs text-gray-500 dark:text-gray-300 font-medium whitespace-nowrap text-center sm:py-0.5 px-0.5 sm:px-2 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <span className="md:hidden">+</span>
                                  <span>{dayEvents.length - 3}</span>{" "}
                                  <span className="hidden md:inline">more</span>
                                </button>
                              )}
                              <span
                                className={`inline-flex ml-auto w-6 h-6 items-center justify-center text-xs sm:text-sm dark:text-gray-300 font-medium text-center rounded-full ${isToday(day) || isFocusedDay(day) ? "text-[#456564] dark:text-[#7aa3a2] font-semibold" : ""}`}
                              >
                                {day}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {endingBlankDays.map((blankday) => (
                      <div
                        className="bg-gray-50 dark:bg-gray-800 h-20 sm:h-28 lg:h-36"
                        key={`end-${blankday}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="100%"
                          height="100%"
                        >
                          <rect
                            width="100%"
                            height="100%"
                            fill="url(#stripes)"
                          />
                        </svg>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {viewMode === "week" && (
                <div className="flex flex-col min-h-0">
                  <div className="flex h-14 shrink-0 border-b border-gray-200 dark:border-gray-700/60">
                    <div className="w-16 shrink-0 border-r border-gray-200 dark:border-gray-700/60" />
                    <div className="flex-1 grid grid-cols-7">
                      {weekDays.map((d) => (
                        <div
                          key={d.toISOString()}
                          className="h-full px-2 flex flex-col justify-center border-r border-gray-100 dark:border-gray-700/40 last:border-r-0"
                        >
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 lg:hidden">
                            {DAY_NAMES[d.getDay()].substring(0, 3)}
                          </span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {d.getDate()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-1 min-h-0">
                    <div className="w-16 shrink-0 border-r border-gray-200 dark:border-gray-700/60 flex flex-col">
                      {dayHours.map((h) => (
                        <div key={h} className="h-14 shrink-0 relative">
                          {h > 0 && (
                            <span className="absolute top-0 -translate-y-1/2 right-2 text-[11px] leading-none text-gray-400 dark:text-gray-500 select-none">
                              {formatHour(h)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 grid grid-cols-7 overflow-auto min-w-0">
                      {dayHours.map((h) =>
                        weekDays.map((d) => {
                          const isTodayCell =
                            d.toDateString() === today.toDateString();
                          const isFocusedCell =
                            focusedDate &&
                            d.toDateString() === focusedDate.toDateString();
                          const dayEvents = getEventsForDate(d).filter(
                            (evt) => {
                              if (!evt.scheduledTime) return h === 0;
                              const [eh] = evt.scheduledTime.split(":");
                              return parseInt(eh, 10) === h;
                            },
                          );
                          return (
                            <div
                              key={`${h}-${d.toISOString()}`}
                              className={`h-14 shrink-0 border-b border-r border-gray-100 dark:border-gray-700/40 last:border-r-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                                isTodayCell
                                  ? "bg-sky-500/5 dark:bg-sky-400/10"
                                  : isFocusedCell
                                    ? "bg-[#456564]/5 dark:bg-[#7aa3a2]/10"
                                    : "bg-white dark:bg-gray-800"
                              }`}
                              onClick={() =>
                                handleEmptySlotClick(
                                  d.toISOString().slice(0, 10),
                                  `${String(h).padStart(2, "0")}:00`,
                                )
                              }
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) =>
                                e.key === "Enter" &&
                                handleEmptySlotClick(
                                  d.toISOString().slice(0, 10),
                                  `${String(h).padStart(2, "0")}:00`,
                                )
                              }
                            >
                              {dayEvents.map((event) => (
                                <button
                                  type="button"
                                  key={event.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEventClick(e, event);
                                  }}
                                  className={`block w-full text-left px-1.5 py-0.5 rounded text-xs truncate hover:opacity-90 ${eventColorByType(event.type)}`}
                                >
                                  {event.title}
                                </button>
                              ))}
                            </div>
                          );
                        }),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "day" && (
                <div className="flex flex-col">
                  <div className="flex h-14 shrink-0 border-b border-gray-200 dark:border-gray-700/60">
                    <div className="w-16 shrink-0 border-r border-gray-200 dark:border-gray-700/60" />
                    <div className="flex-1 flex items-center px-3 min-w-0">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {new Date(focusedDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 min-h-0">
                    <div className="w-16 shrink-0 border-r border-gray-200 dark:border-gray-700/60 flex flex-col">
                      {dayHours.map((h) => (
                        <div key={h} className="h-14 shrink-0 relative">
                          {h > 0 && (
                            <span className="absolute top-0 -translate-y-1/2 right-2 text-[11px] leading-none text-gray-400 dark:text-gray-500 select-none">
                              {formatHour(h)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="relative flex flex-col flex-1 min-w-0 overflow-auto">
                      {dayHours.map((h) => {
                        const focusDate = new Date(focusedDate);
                        const dateStr = focusDate.toISOString().slice(0, 10);
                        const timeStr = `${String(h).padStart(2, "0")}:00`;
                        return (
                          <div
                            key={h}
                            className="h-14 shrink-0 border-b border-gray-100 dark:border-gray-700/40 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            onClick={() =>
                              handleEmptySlotClick(dateStr, timeStr)
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              handleEmptySlotClick(dateStr, timeStr)
                            }
                          >
                            {getEventsForDate(new Date(focusedDate))
                              .filter((evt) => {
                                if (!evt.scheduledTime) return h === 0;
                                const [eh] = evt.scheduledTime.split(":");
                                return parseInt(eh, 10) === h;
                              })
                              .map((event) => (
                                <button
                                  type="button"
                                  key={event.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEventClick(e, event);
                                  }}
                                  className={`absolute left-2 right-2 top-0.5 bottom-0.5 text-left px-2 py-1 rounded text-xs hover:opacity-90 ${eventColorByType(event.type)}`}
                                >
                                  <span className="font-semibold truncate block">
                                    {event.title}
                                  </span>
                                  {event.scheduledTime && (
                                    <span className="opacity-90 text-[10px]">
                                      {(() => {
                                        const [hr, m] =
                                          event.scheduledTime.split(":");
                                        const hour = parseInt(hr, 10);
                                        const ampm = hour >= 12 ? "PM" : "AM";
                                        const hour12 = hour % 12 || 12;
                                        return `${hour12}:${m} ${ampm}`;
                                      })()}
                                    </span>
                                  )}
                                </button>
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {createPortal(
        <>
          <EventDetailModal
            event={selectedEvent}
            isOpen={detailModalOpen}
            onClose={setDetailModalOpen}
            onDeleted={refreshEvents}
          />
          <CalendarScheduleModal
            isOpen={scheduleModalOpen}
            onClose={(v) => {
              setScheduleModalOpen(v);
              if (!v) {
                setScheduleModalInitialDate("");
                setScheduleModalInitialTime("");
              }
            }}
            onScheduled={refreshEvents}
            initialDate={scheduleModalInitialDate}
            initialTime={scheduleModalInitialTime}
          />
        </>,
        document.body,
      )}
    </div>
  );
}

export default Calendar;
