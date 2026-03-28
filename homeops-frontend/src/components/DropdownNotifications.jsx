import React, {useState, useRef, useEffect, useCallback} from "react";
import {Link} from "react-router-dom";
import {
  Bell,
  BookOpen,
  UserPlus,
  UserCheck,
  Wrench,
  MessageSquare,
  Users,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
} from "lucide-react";
import NavbarDropdownPortal from "./NavbarDropdownPortal";
import AppApi from "../api/api";
import {PROPERTY_TEAM_REFRESH_EVENT} from "../constants/propertyEvents";
import useCurrentAccount from "../hooks/useCurrentAccount";

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

function DropdownNotifications() {
  const {currentAccount} = useCurrentAccount();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ownershipActionKey, setOwnershipActionKey] = useState(null);
  const trigger = useRef(null);
  const dropdown = useRef(null);

  const accountUrl = currentAccount?.url || "";
  const homePath = accountUrl ? `/${accountUrl}/home` : "/";
  const invitationsPath = accountUrl
    ? `/${accountUrl}/invitations`
    : "/invitations";
  const clientMessagesPath = accountUrl
    ? `/${accountUrl}/homeowner-messages`
    : "/";

  const fetchData = useCallback(() => {
    setLoading(true);
    AppApi.getNotifications({limit: 10})
      .then((res) => {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount ?? 0);
      })
      .catch(() => {
        setNotifications([]);
        setUnreadCount(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (dropdownOpen) {
      fetchData();
    }
  }, [dropdownOpen, fetchData]);

  useEffect(() => {
    const onRefresh = () => fetchData();
    window.addEventListener("opsy:notifications-refresh", onRefresh);
    return () => window.removeEventListener("opsy:notifications-refresh", onRefresh);
  }, [fetchData]);

  useEffect(() => {
    const clickHandler = ({target}) => {
      if (!dropdown.current) return;
      if (
        !dropdownOpen ||
        dropdown.current.contains(target) ||
        trigger.current?.contains(target)
      )
        return;
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
        <Bell
          className="w-5 h-5 text-gray-500 dark:text-gray-400"
          strokeWidth={1.75}
        />
        {badgeCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full ring-2 ring-white dark:ring-gray-900" />
        )}
      </button>

      <NavbarDropdownPortal
        open={dropdownOpen}
        triggerRef={trigger}
        panelRef={dropdown}
        panelClassName="origin-top-right min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-lg overflow-hidden"
      >
        <div
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
        >
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
            ) : notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                <Bell
                  className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                  strokeWidth={1.5}
                />
                <p>No notifications yet</p>
                <p className="mt-1 text-xs">
                  New messages, invitations, and resources will appear here
                </p>
              </div>
            ) : (
              <ul className="py-2">
                {notifications.map((n) => {
                  const isInvitation = n.type === "property_invitation";
                  const isInvitationAccepted =
                    n.type === "property_invitation_accepted";
                  const isOwnershipTransferRequest =
                    n.type === "ownership_transfer_request";
                  const isOwnershipAccepted =
                    n.type === "ownership_transfer_accepted";
                  const isOwnershipDeclined =
                    n.type === "ownership_transfer_declined";
                  const isContractorReport = n.type === "contractor_report_submitted";
                  const isHomeownerInquiry = n.type === "homeowner_inquiry";
                  const isPropertyMissingAgent = n.type === "property_missing_agent";
                  const isConversationMessage = n.type === "conversation_message";
                  const isCommunication = n.type === "communication_sent" && (n.communicationId ?? n.resourceId);
                  const isResource = n.type === "resource_sent" && n.resourceId;
                  const acctForProperty = n.accountUrl || accountUrl;
                  const propertyInvitePath =
                    (isInvitation || isInvitationAccepted) &&
                    n.propertyUid &&
                    n.accountUrl
                      ? `/${n.accountUrl}/properties/${n.propertyUid}`
                      : null;
                  const ownershipInfoPath =
                    (isOwnershipAccepted || isOwnershipDeclined) &&
                    n.propertyUid &&
                    acctForProperty
                      ? `/${acctForProperty}/properties/${n.propertyUid}`
                      : null;
                  const basePath =
                    isConversationMessage
                      ? clientMessagesPath
                      : isHomeownerInquiry
                      ? `${clientMessagesPath}${n.homeownerInquiryId ? `?highlight=${n.homeownerInquiryId}` : ""}`
                      : propertyInvitePath
                        ? propertyInvitePath
                        : ownershipInfoPath
                          ? ownershipInfoPath
                        : isContractorReport && n.maintenancePropertyUid && n.maintenanceAccountUrl
                          ? `/${n.maintenanceAccountUrl}/properties/${n.maintenancePropertyUid}?tab=maintenance`
                          : isPropertyMissingAgent &&
                              n.missingAgentPropertyUid &&
                              n.missingAgentAccountUrl
                            ? `/${n.missingAgentAccountUrl}/properties/${n.missingAgentPropertyUid}`
                            : isCommunication
                            ? `/${accountUrl}/communications/${n.communicationId ?? n.resourceId}/view`
                            : isResource
                              ? `/${accountUrl}/resources/${n.resourceId}/view`
                              : isInvitation
                                ? invitationsPath
                                : homePath;
                  const linkTo =
                    isInvitation &&
                    n.invitationId &&
                    basePath.includes("/properties/")
                      ? `${basePath}${basePath.includes("?") ? "&" : "?"}invitation=${n.invitationId}`
                      : basePath;

                  if (isOwnershipTransferRequest) {
                    const rid = n.ownershipTransferRequestId;
                    const viewPropertyPath =
                      n.propertyUid && acctForProperty
                        ? `/${acctForProperty}/properties/${n.propertyUid}`
                        : null;
                    return (
                      <li
                        key={n.id}
                        className="border-b border-gray-100 dark:border-gray-700/40 last:border-0"
                      >
                        <div
                          className={`flex flex-col gap-2 px-4 py-3 ${!n.readAt ? "bg-[#456564]/5 dark:bg-[#456564]/10" : ""}`}
                        >
                          <div className="flex gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#456564]/15 dark:bg-[#456564]/20 flex items-center justify-center shrink-0">
                              <ArrowRightLeft className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {n.title || "Ownership transfer request"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatNotificationTime(n.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pl-12">
                            <button
                              type="button"
                              disabled={
                                !rid ||
                                ownershipActionKey === `${n.id}-accept` ||
                                ownershipActionKey === `${n.id}-decline`
                              }
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!rid) return;
                                setOwnershipActionKey(`${n.id}-accept`);
                                try {
                                  const res =
                                    await AppApi.acceptOwnershipTransferRequest(
                                      rid,
                                    );
                                  /* Do not mark this notification read — the server deletes it with the request. */
                                  window.dispatchEvent(
                                    new CustomEvent("opsy:notifications-refresh"),
                                  );
                                  if (res?.propertyId != null) {
                                    window.dispatchEvent(
                                      new CustomEvent(
                                        PROPERTY_TEAM_REFRESH_EVENT,
                                        {
                                          detail: {
                                            propertyId: res.propertyId,
                                          },
                                        },
                                      ),
                                    );
                                  }
                                  fetchData();
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setOwnershipActionKey(null);
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#456654] text-white hover:bg-[#34514f] disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              disabled={
                                !rid ||
                                ownershipActionKey === `${n.id}-accept` ||
                                ownershipActionKey === `${n.id}-decline`
                              }
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!rid) return;
                                setOwnershipActionKey(`${n.id}-decline`);
                                try {
                                  await AppApi.declineOwnershipTransferRequest(rid);
                                  /* Same as accept: notification row is removed server-side. */
                                  window.dispatchEvent(
                                    new CustomEvent("opsy:notifications-refresh"),
                                  );
                                  fetchData();
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setOwnershipActionKey(null);
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
                            >
                              Decline
                            </button>
                            {viewPropertyPath && (
                              <Link
                                to={viewPropertyPath}
                                onClick={() => setDropdownOpen(false)}
                                className="text-xs font-medium text-[#456564] dark:text-[#5a7a78] hover:underline"
                              >
                                View property
                              </Link>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={n.id}
                      className="border-b border-gray-100 dark:border-gray-700/40 last:border-0"
                    >
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
                          ) : isInvitationAccepted ? (
                            <UserCheck className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                          ) : isOwnershipAccepted ? (
                            <CheckCircle className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                          ) : isOwnershipDeclined ? (
                            <XCircle className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                          ) : isContractorReport ? (
                            <Wrench className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                          ) : isHomeownerInquiry ? (
                            <MessageSquare className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                          ) : isPropertyMissingAgent ? (
                            <Users className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {n.title ||
                              n.resourceSubject ||
                              "New resource shared"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatNotificationTime(n.createdAt)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {unreadCount > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await AppApi.markAllNotificationsRead();
                    setUnreadCount(0);
                    fetchData();
                  } catch {}
                }}
                className="w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-[#456564] dark:hover:text-teal-400"
              >
                Mark all read
              </button>
            </div>
          )}
        </div>
      </NavbarDropdownPortal>
    </div>
  );
}

export default DropdownNotifications;
