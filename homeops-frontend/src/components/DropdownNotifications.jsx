import React, {useState, useRef, useEffect} from "react";
import {Link} from "react-router-dom";
import {Bell, Calendar, AlertCircle, ChevronRight, BookOpen, UserPlus} from "lucide-react";
import Transition from "../utils/Transition";
import AppApi from "../api/api";
import useCurrentAccount from "../hooks/useCurrentAccount";

function formatEventDate(dateStr, timeStr) {
  const d = new Date(dateStr + (timeStr ? `T${timeStr}` : "T12:00:00"));
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
}

function formatEventTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:${String(m).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m).padStart(2, "0")} PM`;
  return `${h - 12}:${String(m).padStart(2, "0")} PM`;
}

function formatNotificationTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", {month: "short", day: "numeric"});
}

function DropdownNotifications({align = "right"}) {
  const {currentAccount} = useCurrentAccount();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const trigger = useRef(null);
  const dropdown = useRef(null);

  const accountUrl = currentAccount?.url || "";
  const calendarPath = accountUrl ? `/${accountUrl}/calendar` : "/calendar";
  const homePath = accountUrl ? `/${accountUrl}` : "/";
  const invitationsPath = accountUrl ? `/${accountUrl}/invitations` : "/invitations";

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      AppApi.getNotifications({limit: 10}).catch(() => ({notifications: [], unreadCount: 0})),
      (() => {
        const today = new Date();
        const end = new Date(today);
        end.setDate(end.getDate() + 14);
        const startStr = today.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        return AppApi.getCalendarEvents(startStr, endStr)
          .then((raw) =>
            raw
              .sort((a, b) => (a.scheduledDate > b.scheduledDate ? 1 : -1))
              .slice(0, 8),
          )
          .catch(() => []);
      })(),
    ])
      .then(([notifRes, evts]) => {
        setNotifications(notifRes.notifications || []);
        setUnreadCount(notifRes.unreadCount ?? 0);
        setEvents(evts || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (dropdownOpen) {
      fetchData();
    }
  }, [dropdownOpen]);

  useEffect(() => {
    const clickHandler = ({target}) => {
      if (!dropdown.current) return;
      if (!dropdownOpen || dropdown.current.contains(target) || trigger.current?.contains(target)) return;
      setDropdownOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  });

  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  });

  const todayEvents = events.filter(
    (e) => new Date(e.scheduledDate).toDateString() === new Date().toDateString(),
  );
  const upcomingEvents = events.filter(
    (e) => new Date(e.scheduledDate).toDateString() !== new Date().toDateString(),
  );
  const hasAlerts = todayEvents.length > 0;
  const badgeCount = unreadCount;

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        className={`w-8 h-8 flex items-center justify-center hover:bg-gray-100 lg:hover:bg-gray-200 dark:hover:bg-gray-700/50 dark:lg:hover:bg-gray-800 rounded-full transition-colors ${
          dropdownOpen ? "bg-gray-200 dark:bg-gray-800" : ""
        }`}
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        <span className="sr-only">Notifications</span>
        <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" strokeWidth={1.75} />
        {badgeCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full ring-2 ring-white dark:ring-gray-900" />
        )}
      </button>

      <Transition
        className={`origin-top-right z-50 absolute top-full mt-1 min-w-[320px] max-w-[360px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-lg overflow-hidden ${
          align === "right" ? "right-0" : "left-0"
        }`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div ref={dropdown} onFocus={() => setDropdownOpen(true)} onBlur={() => setDropdownOpen(false)}>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/60">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                Loading…
              </div>
            ) : notifications.length === 0 && events.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                <p>No notifications yet</p>
                <p className="mt-1 text-xs">New resources and events will appear here</p>
              </div>
            ) : (
              <ul className="py-2">
                {notifications.length > 0 && (
                  <>
                    <li className="px-4 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3" /> New resources
                      </span>
                    </li>
                    {notifications.map((n) => {
                      const isInvitation = n.type === "property_invitation";
                      const basePath = isInvitation && n.propertyUid && n.accountUrl
                        ? `/${n.accountUrl}/properties/${n.propertyUid}`
                        : isInvitation
                          ? invitationsPath
                          : homePath;
                      const linkTo = isInvitation && n.invitationId && basePath.includes("/properties/")
                        ? `${basePath}?invitation=${n.invitationId}`
                        : basePath;
                      return (
                        <li key={n.id} className="border-b border-gray-100 dark:border-gray-700/40 last:border-0">
                          <Link
                            to={linkTo}
                            onClick={async () => {
                              if (!n.readAt) {
                                try {
                                  await AppApi.markNotificationRead(n.id);
                                  setUnreadCount((c) => Math.max(0, c - 1));
                                } catch {}
                              }
                              setDropdownOpen(false);
                            }}
                            className={`flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${!n.readAt ? "bg-[#456564]/5 dark:bg-[#456564]/10" : ""}`}
                          >
                            <div className="w-9 h-9 rounded-lg bg-[#456564]/15 dark:bg-[#456564]/20 flex items-center justify-center shrink-0">
                              {isInvitation ? (
                                <UserPlus className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                              ) : (
                                <BookOpen className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {n.title || n.resourceSubject || "New resource shared"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatNotificationTime(n.createdAt)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                    <li className="px-4 py-1.5 mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Upcoming events
                      </span>
                    </li>
                  </>
                )}
                {!notifications.length && (
                  <li className="px-4 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> Upcoming events
                    </span>
                  </li>
                )}
                {hasAlerts && (
                  <>
                    <li className="px-4 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> Today
                      </span>
                    </li>
                    {todayEvents.map((ev) => (
                      <li key={ev.id} className="border-b border-gray-100 dark:border-gray-700/40 last:border-0">
                        <Link
                          to={calendarPath}
                          onClick={() => setDropdownOpen(false)}
                          className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {ev.systemName} {ev.type === "inspection" ? "Inspection" : "Maintenance"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {ev.propertyName}
                              {ev.scheduledTime && ` · ${formatEventTime(ev.scheduledTime)}`}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </>
                )}
                {upcomingEvents.length > 0 && (
                  <>
                    <li className="px-4 py-1.5 mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Upcoming
                      </span>
                    </li>
                    {upcomingEvents.map((ev) => (
                      <li key={ev.id} className="border-b border-gray-100 dark:border-gray-700/40 last:border-0">
                        <Link
                          to={calendarPath}
                          onClick={() => setDropdownOpen(false)}
                          className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {ev.systemName} {ev.type === "inspection" ? "Inspection" : "Maintenance"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatEventDate(ev.scheduledDate, ev.scheduledTime)}
                              {ev.contractorName && ` · ${ev.contractorName}`}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            )}
          </div>

          {(events.length > 0 || notifications.length > 0) && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 flex gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await AppApi.markAllNotificationsRead();
                      setUnreadCount(0);
                      fetchData();
                    } catch {}
                  }}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-[#456564] dark:hover:text-teal-400"
                >
                  Mark all read
                </button>
              )}
              <Link
                to={homePath}
                onClick={() => setDropdownOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-[#456564] dark:text-teal-400 hover:text-[#3a5554] dark:hover:text-teal-300"
              >
                View home <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to={invitationsPath}
                onClick={() => setDropdownOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-[#456564] dark:text-teal-400 hover:text-[#3a5554] dark:hover:text-teal-300"
              >
                Invitations <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to={calendarPath}
                onClick={() => setDropdownOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-[#456564] dark:text-teal-400 hover:text-[#3a5554] dark:hover:text-teal-300"
              >
                Calendar <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </Transition>
    </div>
  );
}

export default DropdownNotifications;
