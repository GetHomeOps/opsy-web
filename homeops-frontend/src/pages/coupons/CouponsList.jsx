import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Copy, Check, Plus, Percent, DollarSign,
  ChevronDown, ChevronRight, Users, Globe,
} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import Banner from "../../partials/containers/Banner";
import FilterDropdown from "../../components/FilterDropdown";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";

const COUPON_FILTER_CATEGORIES = [
  { type: "status", labelKey: "status" },
  { type: "discountType", labelKey: "Discount" },
  { type: "duration", labelKey: "Duration" },
  { type: "couponType", labelKey: "Type" },
];

const COUPON_FILTER_OPTIONS = {
  status: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  discountType: [
    { value: "percent", label: "Percent off" },
    { value: "fixed", label: "Fixed amount" },
  ],
  duration: [
    { value: "once", label: "Once" },
    { value: "repeating", label: "Repeating" },
    { value: "forever", label: "Forever" },
  ],
  couponType: [
    { value: "general", label: "General" },
    { value: "unique", label: "Unique (Batch)" },
  ],
};

function CouponActionsMenu({ onRefresh, onCreateCoupon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { t } = useTranslation();

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        aria-expanded={open}
      >
        {t("actions")}
        <ChevronDown className="w-4 h-4 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[200px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <ul className="py-1.5">
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => {
                  onRefresh();
                  setOpen(false);
                }}
              >
                {t("refreshList", { defaultValue: "Refresh list" })}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => {
                  onCreateCoupon();
                  setOpen(false);
                }}
              >
                <Plus className="w-4 h-4 shrink-0 opacity-70" />
                {t("createCoupon", { defaultValue: "Create coupon" })}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function BatchProgressBar({ redeemed, total }) {
  const pct = total > 0 ? Math.round((redeemed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {redeemed} / {total}
      </span>
    </div>
  );
}

/** Shared green pill switch for batch + general coupon active toggles */
function PillSwitch({ checked, disabled, onChange, title, ariaLabel }) {
  return (
    <label
      className={`relative inline-flex items-center ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      }`}
      title={title}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e);
        }}
        className="sr-only peer"
        aria-label={ariaLabel}
      />
      <div
        className="relative w-11 h-6 bg-gray-200 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-gray-900 peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"
      />
    </label>
  );
}

function BatchRow({
  batch,
  searchTerm,
  accountUrl,
  navigate,
  onBanner,
  onBatchUpdated,
}) {
  const [expanded, setExpanded] = useState(false);
  const [codes, setCodes] = useState(null);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [batchTogglePending, setBatchTogglePending] = useState(false);
  // Flip the switch instantly on click; reconcile when the server responds.
  const [optimisticActive, setOptimisticActive] = useState(null);

  const serverActive = batch.activeCount > 0;
  const isActive = optimisticActive ?? serverActive;
  const allInactive = !isActive;
  const batchFullyExhausted = batch.redeemedCount >= batch.totalCodes;
  const switchDisabled =
    batchTogglePending || (allInactive && batchFullyExhausted);

  // Clear optimistic state once the server has caught up.
  useEffect(() => {
    if (optimisticActive !== null && optimisticActive === serverActive) {
      setOptimisticActive(null);
    }
  }, [serverActive, optimisticActive]);

  async function toggleExpand() {
    if (!expanded && !codes) {
      setLoadingCodes(true);
      try {
        const res = await AppApi.getBatchCodes(batch.batchId);
        setCodes(res.codes || []);
      } catch (err) {
        onBanner({ open: true, type: "error", message: `Failed to load batch codes: ${err.message}` });
      } finally {
        setLoadingCodes(false);
      }
    }
    setExpanded((v) => !v);
  }

  async function handleCopy(code, id, e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      onBanner({ open: true, type: "error", message: "Failed to copy." });
    }
  }

  async function handleDeactivateBatch(e) {
    e.stopPropagation();
    if (batchTogglePending || !isActive) return;
    setBatchTogglePending(true);
    setOptimisticActive(false);
    // Invalidate cached code list so the expanded view refetches fresh state.
    setCodes(null);
    try {
      const res = await AppApi.deleteBatch(batch.batchId);
      if (res?.summary) onBatchUpdated?.(res.summary);
      onBanner({
        open: true,
        type: "success",
        message: `Batch "${batch.batchName}" deactivated.`,
      });
    } catch (err) {
      setOptimisticActive(null);
      onBanner({ open: true, type: "error", message: err.message });
    } finally {
      setBatchTogglePending(false);
    }
  }

  async function handleActivateBatch(e) {
    e.stopPropagation();
    if (batchTogglePending || batchFullyExhausted || isActive) return;
    setBatchTogglePending(true);
    setOptimisticActive(true);
    setCodes(null);
    try {
      const res = await AppApi.activateBatch(batch.batchId);
      if (res?.summary) onBatchUpdated?.(res.summary);
      const n = res?.activatedCount ?? 0;
      onBanner({
        open: true,
        type: "success",
        message:
          n > 0
            ? `Batch "${batch.batchName}" activated (${n} code${n === 1 ? "" : "s"}).`
            : `No unused codes could be reactivated for "${batch.batchName}".`,
      });
      if (n === 0) setOptimisticActive(false);
    } catch (err) {
      setOptimisticActive(null);
      onBanner({ open: true, type: "error", message: err.message });
    } finally {
      setBatchTogglePending(false);
    }
  }

  const filteredCodes = useMemo(() => {
    if (!codes || !searchTerm) return codes;
    const s = searchTerm.toLowerCase();
    return codes.filter((c) => (c.code || "").toLowerCase().includes(s));
  }, [codes, searchTerm]);

  return (
    <>
      {/* Batch summary row */}
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-700/25 cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-800/50"
        onClick={toggleExpand}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <Users className="w-4 h-4 text-violet-500 shrink-0" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {batch.batchName || "Unnamed Batch"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium">
            Batch
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-gray-100">
            {batch.discountType === "percent" ? (
              <Percent className="w-3.5 h-3.5 text-violet-500" />
            ) : (
              <DollarSign className="w-3.5 h-3.5 text-green-500" />
            )}
            {formatDiscount(batch)} off
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
          {formatDuration(batch)}
        </td>
        <td className="px-4 py-3">
          <BatchProgressBar redeemed={batch.redeemedCount} total={batch.totalCodes} />
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
          {batch.expiresAt ? formatDate(batch.expiresAt) : "\u2014"}
        </td>
        <td className="px-4 py-3">
          {allInactive ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              Inactive
            </span>
          ) : batch.redeemedCount >= batch.totalCodes ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              All Used
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              Active
            </span>
          )}
        </td>
        <td
          className="px-4 py-3 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <PillSwitch
            checked={!allInactive}
            disabled={switchDisabled}
            onChange={(e) => {
              if (e.target.checked) {
                handleActivateBatch(e);
              } else {
                handleDeactivateBatch(e);
              }
            }}
            title={
              allInactive && batchFullyExhausted
                ? "All codes in this batch have been used"
                : allInactive
                  ? "Turn on to reactivate unused codes in this batch"
                  : "Turn off to deactivate all codes in this batch"
            }
            ariaLabel={
              allInactive && batchFullyExhausted
                ? "Batch exhausted; cannot reactivate"
                : allInactive
                  ? "Activate entire batch"
                  : "Deactivate entire batch"
            }
          />
        </td>
      </tr>

      {/* Expanded: individual codes */}
      {expanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-gray-50 dark:bg-gray-900/30 border-y border-gray-100 dark:border-gray-700/40">
              {loadingCodes ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading codes...
                </div>
              ) : filteredCodes && filteredCodes.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-gray-400 dark:text-gray-500">
                      <th className="px-6 py-2 text-left font-medium" style={{ paddingLeft: "3rem" }}>Code</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                    {filteredCodes.map((c) => {
                      const isRedeemed = c.redemptionCount > 0;
                      return (
                        <tr
                          key={c.id}
                          className={`transition-colors ${
                            isRedeemed
                              ? "opacity-60"
                              : "hover:bg-white dark:hover:bg-gray-800/50"
                          }`}
                          onClick={() => navigate(`/${accountUrl}/coupons/${c.id}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <td className="px-4 py-2" style={{ paddingLeft: "3rem" }}>
                            <span className={`font-mono tracking-wide text-sm ${
                              isRedeemed
                                ? "line-through text-gray-400 dark:text-gray-500"
                                : "text-gray-800 dark:text-gray-100"
                            }`}>
                              {c.code}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {isRedeemed ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                Redeemed
                              </span>
                            ) : !c.isActive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                Inactive
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                Available
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {!isRedeemed && (
                              <button
                                title="Copy code"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(c.code, c.id, e);
                                }}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                {copiedId === c.id ? (
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  {searchTerm ? "No codes match your search." : "No codes in this batch."}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function formatDiscount(c) {
  if (c.discountType === "percent") return `${Number(c.discountValue)}%`;
  const val = Number(c.discountValue);
  return `$${val % 1 === 0 ? val : val.toFixed(2)}`;
}

function formatDuration(c) {
  if (c.duration === "once") return "Once";
  if (c.duration === "forever") return "Forever";
  if (c.duration === "repeating") return `${c.durationInMonths} mo`;
  return c.duration;
}

function formatDate(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CouponsList() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generalCoupons, setGeneralCoupons] = useState([]);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState({ open: false, type: "success", message: "" });
  const [copiedId, setCopiedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [togglingId, setTogglingId] = useState(null);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const fetchCoupons = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await AppApi.getCouponsGrouped();
      setGeneralCoupons(res.general || []);
      setBatches(res.batches || []);
    } catch (err) {
      setBanner({ open: true, type: "error", message: `Failed to load coupons: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleBatchUpdated = useCallback((summary) => {
    if (!summary?.batchId) return;
    setBatches((prev) =>
      prev.map((b) =>
        b.batchId === summary.batchId
          ? {
              ...b,
              activeCount: summary.activeCount ?? b.activeCount,
              redeemedCount: summary.redeemedCount ?? b.redeemedCount,
              totalCodes: summary.totalCodes ?? b.totalCodes,
            }
          : b,
      ),
    );
  }, []);

  useEffect(() => {
    if (banner.open) {
      const t = setTimeout(() => setBanner((b) => ({ ...b, open: false })), 4000);
      return () => clearTimeout(t);
    }
  }, [banner.open]);

  // Determine which types to show based on active filters
  const typeFilter = useMemo(() => {
    const typeValues = activeFilters.filter((f) => f.type === "couponType").map((f) => f.value);
    if (typeValues.length === 0) return { showGeneral: true, showBatches: true };
    return {
      showGeneral: typeValues.includes("general"),
      showBatches: typeValues.includes("unique"),
    };
  }, [activeFilters]);

  const filteredGeneral = useMemo(() => {
    if (!typeFilter.showGeneral) return [];
    let list = generalCoupons;

    const byType = {};
    activeFilters.filter((f) => f.type !== "couponType").forEach((f) => {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f.value);
    });

    Object.entries(byType).forEach(([type, values]) => {
      list = list.filter((c) => {
        if (type === "status") {
          return values.some((v) => (v === "active" ? c.isActive : !c.isActive));
        }
        if (type === "discountType") return values.includes(c.discountType);
        if (type === "duration") return values.includes(c.duration);
        return true;
      });
    });

    if (!searchTerm) return list;
    const s = searchTerm.toLowerCase();
    return list.filter(
      (c) =>
        (c.code || "").toLowerCase().includes(s) ||
        (c.name || "").toLowerCase().includes(s)
    );
  }, [generalCoupons, searchTerm, activeFilters, typeFilter.showGeneral]);

  const filteredBatches = useMemo(() => {
    if (!typeFilter.showBatches) return [];
    let list = batches;

    const byType = {};
    activeFilters.filter((f) => f.type !== "couponType").forEach((f) => {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f.value);
    });

    Object.entries(byType).forEach(([type, values]) => {
      list = list.filter((b) => {
        if (type === "status") {
          return values.some((v) =>
            v === "active" ? b.activeCount > 0 : b.activeCount === 0
          );
        }
        if (type === "discountType") return values.includes(b.discountType);
        if (type === "duration") return values.includes(b.duration);
        return true;
      });
    });

    if (!searchTerm) return list;
    const s = searchTerm.toLowerCase();
    return list.filter((b) => (b.batchName || "").toLowerCase().includes(s));
  }, [batches, searchTerm, activeFilters, typeFilter.showBatches]);

  function addFilter(f) {
    setActiveFilters((prev) => {
      const exists = prev.some((x) => x.type === f.type && x.value === f.value);
      if (exists) return prev;
      return [...prev, f];
    });
  }

  function removeFilter(f) {
    setActiveFilters((prev) => prev.filter((x) => !(x.type === f.type && x.value === f.value)));
  }

  async function handleCopy(code, id) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setBanner({ open: true, type: "error", message: "Failed to copy to clipboard." });
    }
  }

  async function handleToggleActive(coupon) {
    setTogglingId(coupon.id);
    try {
      const res = await AppApi.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      setGeneralCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? (res.coupon || { ...c, isActive: !c.isActive }) : c))
      );
      setBanner({
        open: true,
        type: "success",
        message: `Coupon ${coupon.code} ${!coupon.isActive ? "activated" : "deactivated"}.`,
      });
    } catch (err) {
      setBanner({ open: true, type: "error", message: err.message });
    } finally {
      setTogglingId(null);
    }
  }

  const totalItems = filteredGeneral.length + filteredBatches.length;
  const hasAnyData = generalCoupons.length > 0 || batches.length > 0;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="fixed right-0 w-auto sm:w-full z-50">
          <Banner
            type={banner.type}
            open={banner.open}
            setOpen={(open) => setBanner((b) => ({ ...b, open }))}
            className={`transition-opacity duration-600 ${banner.open ? "opacity-100" : "opacity-0"}`}
          >
            {banner.message}
          </Banner>
        </div>

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* Header */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  Coupons
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Create and manage discount codes for subscriptions
                </p>
              </div>
              <button
                className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
                onClick={() => navigate(`/${accountUrl}/coupons/new`)}
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>Create Coupon</span>
              </button>
            </div>

            {/* Search, filter, actions */}
            <div className="mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm text-sm"
                    placeholder="Search by code, name, or batch name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                    <svg className="shrink-0 fill-current text-gray-400 dark:text-gray-500 ml-1" width="16" height="16" viewBox="0 0 16 16">
                      <path d="M7 14c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zM7 2C4.243 2 2 4.243 2 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
                      <path d="M15.707 14.293L13.314 11.9a8.019 8.019 0 01-1.414 1.414l2.393 2.393a.997.997 0 001.414 0 .999.999 0 000-1.414z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center shrink-0 gap-2">
                  <FilterDropdown
                    filterCategories={COUPON_FILTER_CATEGORIES}
                    filterOptions={COUPON_FILTER_OPTIONS}
                    activeFilters={activeFilters}
                    onAdd={addFilter}
                    onRemove={removeFilter}
                    t={t}
                  />
                  <CouponActionsMenu
                    onRefresh={fetchCoupons}
                    onCreateCoupon={() => navigate(`/${accountUrl}/coupons/new`)}
                  />
                </div>
              </div>
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {activeFilters.map((f) => (
                    <span
                      key={`${f.type}-${f.value}`}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20"
                    >
                      <span className="text-violet-400 dark:text-violet-500 font-normal">
                        {t(COUPON_FILTER_CATEGORIES.find((c) => c.type === f.type)?.labelKey ?? f.type)}:
                      </span>
                      {f.label}
                      <button
                        type="button"
                        onClick={() => removeFilter(f)}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/20 transition-colors"
                        aria-label="Remove filter"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveFilters([])}
                    className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    {t("clearFilters", { defaultValue: "Clear filters" })}
                  </button>
                </div>
              )}
            </div>

            {/* Loading */}
            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading coupons...</span>
                </div>
              </div>
            ) : totalItems === 0 ? (
              <div className="text-center py-16">
                <Percent className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {!hasAnyData
                    ? "No coupons created yet."
                    : "No coupons match your search or filters."}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-auto w-full divide-y divide-gray-200 dark:divide-gray-700/60">
                    <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20">
                      <tr>
                        <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">Code / Batch</th>
                        <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">Type</th>
                        <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">Discount</th>
                        <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">Duration</th>
                        <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">Redemptions</th>
                        <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">Expires</th>
                        <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">Status</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-200 dark:divide-gray-700/60">
                      {/* Batch rows */}
                      {filteredBatches.map((batch) => (
                        <BatchRow
                          key={batch.batchId}
                          batch={batch}
                          searchTerm={searchTerm}
                          accountUrl={accountUrl}
                          navigate={navigate}
                          onBanner={setBanner}
                          onBatchUpdated={handleBatchUpdated}
                        />
                      ))}

                      {/* General coupon rows */}
                      {filteredGeneral.map((coupon) => {
                        const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                        const isMaxed = coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions;

                        return (
                          <tr
                            key={coupon.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/25 cursor-pointer transition-colors"
                            onClick={() => navigate(`/${accountUrl}/coupons/${coupon.id}`)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="font-mono font-semibold text-gray-800 dark:text-gray-100 tracking-wide">
                                  {coupon.code}
                                </span>
                                <button
                                  title="Copy code"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(coupon.code, coupon.id);
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                  {copiedId === coupon.id ? (
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                                General
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-gray-100">
                                {coupon.discountType === "percent" ? (
                                  <Percent className="w-3.5 h-3.5 text-violet-500" />
                                ) : (
                                  <DollarSign className="w-3.5 h-3.5 text-green-500" />
                                )}
                                {formatDiscount(coupon)} off
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {formatDuration(coupon)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-700 dark:text-gray-300">
                                {coupon.redemptionCount}
                                {coupon.maxRedemptions != null && (
                                  <span className="text-gray-400"> / {coupon.maxRedemptions}</span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {isExpired ? (
                                <span className="text-red-500 dark:text-red-400 font-medium">Expired</span>
                              ) : (
                                formatDate(coupon.expiresAt)
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {!coupon.isActive ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                  Inactive
                                </span>
                              ) : isExpired || isMaxed ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                  {isExpired ? "Expired" : "Maxed"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  Active
                                </span>
                              )}
                            </td>
                            <td
                              className="px-4 py-3 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PillSwitch
                                checked={coupon.isActive}
                                disabled={togglingId === coupon.id}
                                onChange={() => handleToggleActive(coupon)}
                                title={coupon.isActive ? "Deactivate" : "Activate"}
                                ariaLabel={
                                  coupon.isActive ? "Deactivate coupon" : "Activate coupon"
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default CouponsList;
