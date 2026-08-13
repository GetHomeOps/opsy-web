import React, {useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Loader2, Plus, Search} from "lucide-react";

const SEARCH_THRESHOLD = 6;

function partnerSubtitle(partner) {
  if (partner.role) {
    return String(partner.role)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return partner.address || partner.propertyName || "";
}

function NewConversationDropdown({
  partners = [],
  loading = false,
  starting = false,
  forHomeowner = false,
  forAdmin = false,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (
        wrapRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setCoords(null);
      return undefined;
    }
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return partners;
    const q = search.toLowerCase();
    return partners.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q) ||
        (p.propertyName || "").toLowerCase().includes(q) ||
        (p.role || "").toLowerCase().includes(q),
    );
  }, [partners, search]);

  const showSearch = partners.length >= SEARCH_THRESHOLD;

  const handleSelect = (partner) => {
    if (starting) return;
    setOpen(false);
    onSelect?.(partner);
  };

  const panel =
    open && coords
      ? createPortal(
          <div
            ref={panelRef}
            style={{top: coords.top, right: coords.right}}
            className="fixed w-72 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[80]"
          >
            <div className="px-3 pt-2.5 pb-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {forAdmin
                  ? "Message a user"
                  : forHomeowner
                    ? "Message an agent"
                    : "Message a homeowner"}
              </p>
            </div>

            {showSearch && (
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#456564]/30"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto px-1 pb-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6 px-3">
                  {search
                    ? "No matches"
                    : forAdmin
                      ? "No other users to message yet."
                      : forHomeowner
                      ? "No agent is assigned to your properties yet."
                      : "No homeowners are assigned to your properties yet."}
                </p>
              ) : (
                filtered.map((partner) => {
                  const subtitle = partnerSubtitle(partner);
                  const initial = (partner.name || "?").charAt(0).toUpperCase();
                  return (
                    <button
                      key={`${partner.userId}-${partner.propertyUid ?? "direct"}`}
                      type="button"
                      onClick={() => handleSelect(partner)}
                      disabled={starting}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors disabled:opacity-60"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#456564] to-[#6fb5b4] flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-white">{initial}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {partner.name}
                        </p>
                        {subtitle && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-[#456564] dark:hover:text-[#6fb5b4] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Start a conversation"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Plus className="w-5 h-5" />
      </button>
      {panel}
    </div>
  );
}

export default NewConversationDropdown;
