import React, {useState, useEffect, useCallback} from "react";
import {useParams, useSearchParams, Link} from "react-router-dom";
import {
  Inbox,
  MessageSquare,
  UserPlus,
  Share2,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {PAGE_LAYOUT} from "../../constants/layout";

const KIND_META = {
  message: {
    label: "Message",
    Icon: MessageSquare,
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  referral_request: {
    label: "Referral request",
    Icon: UserPlus,
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  },
  refer_agent: {
    label: "Refer agent",
    Icon: Share2,
    chip: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  },
};

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PayloadDetails({kind, payload}) {
  if (!payload || typeof payload !== "object") return null;
  if (kind === "message") {
    return (
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {payload.message || "—"}
      </p>
    );
  }
  if (kind === "referral_request") {
    return (
      <dl className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
        <div>
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</dt>
          <dd>{payload.referralType || "—"}</dd>
        </div>
        {payload.notes ? (
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</dt>
            <dd className="whitespace-pre-wrap">{payload.notes}</dd>
          </div>
        ) : null}
      </dl>
    );
  }
  return (
    <dl className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
      <div>
        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</dt>
        <dd>{payload.referName || "—"}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact</dt>
        <dd>{payload.referContact || "—"}</dd>
      </div>
      {payload.note ? (
        <div>
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Note</dt>
          <dd className="whitespace-pre-wrap">{payload.note}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function HomeownerAgentInbox() {
  const {accountUrl} = useParams();
  const {currentAccount} = useCurrentAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchInquiries = useCallback(async () => {
    if (!currentAccount?.id) return;
    try {
      setLoading(true);
      const list = await AppApi.getHomeownerAgentInquiries(currentAccount.id, {limit: 150});
      setInquiries(Array.isArray(list) ? list : []);
    } catch {
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.id]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const highlightRaw = searchParams.get("highlight");
  useEffect(() => {
    if (!highlightRaw || loading) return;
    const id = parseInt(highlightRaw, 10);
    if (Number.isNaN(id)) return;
    setExpandedId(id);
    AppApi.markHomeownerAgentInquiryRead(id)
      .then(() => fetchInquiries())
      .catch(() => {});
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("highlight");
        return next;
      },
      {replace: true},
    );
  }, [highlightRaw, loading, fetchInquiries, setSearchParams]);

  const toggleRow = async (row) => {
    const open = expandedId === row.id;
    if (open) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (!row.agentReadAt) {
      try {
        await AppApi.markHomeownerAgentInquiryRead(row.id);
        setInquiries((prev) =>
          prev.map((r) =>
            r.id === row.id ? {...r, agentReadAt: new Date().toISOString()} : r,
          ),
        );
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto">
          <div className={PAGE_LAYOUT.list}>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Inbox className="w-7 h-7 text-[#456564] dark:text-[#6fb5b4]" strokeWidth={1.75} />
                Client messages
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                Messages, referral requests, and refer-agent leads from homeowners on your properties.
              </p>
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : inquiries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 px-6 text-center">
                <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">No messages yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                  When a homeowner uses Contact Agent on their home dashboard, it will show up here and in your
                  notification bell.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {inquiries.map((row) => {
                  const meta = KIND_META[row.kind] || KIND_META.message;
                  const Icon = meta.Icon;
                  const unread = !row.agentReadAt;
                  const open = expandedId === row.id;
                  return (
                    <li
                      key={row.id}
                      className={`rounded-xl border transition-colors ${
                        unread
                          ? "border-[#456564]/30 bg-[#456564]/[0.04] dark:border-[#6fb5b4]/25 dark:bg-[#6fb5b4]/[0.06]"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRow(row)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 rounded-xl"
                      >
                        <div
                          className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.chip}`}
                        >
                          <Icon className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {row.senderName || "Homeowner"}
                            </span>
                            {unread && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#456564] dark:text-[#6fb5b4]">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {meta.label} · {formatWhen(row.createdAt)}
                          </p>
                          {row.address ? (
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0 opacity-70" />
                              <span className="truncate">{row.address}</span>
                            </p>
                          ) : null}
                          {currentAccount?.id && row.propertyUid ? (
                            <Link
                              to={`/${accountUrl}/properties/${row.propertyUid}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] dark:text-[#6fb5b4] hover:underline mt-1"
                            >
                              Open property
                            </Link>
                          ) : null}
                        </div>
                        {open ? (
                          <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                      </button>
                      {open && (
                        <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-700/80">
                          <div className="mt-3 pl-12">
                            <PayloadDetails kind={row.kind} payload={row.payload} />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default HomeownerAgentInbox;
