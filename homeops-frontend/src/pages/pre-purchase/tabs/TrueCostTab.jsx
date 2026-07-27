import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  AlertCircle,
  Calculator,
  CalendarDays,
  Check,
  ExternalLink,
  FileDown,
  Heart,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react";
import AppApi, {getApiErrorMessage} from "../../../api/api";
import CurrencyInput from "../../../components/CurrencyInput";
import ModalBlank from "../../../components/ModalBlank";
import SectionCard from "../../properties/partials/passport/SectionCard";
import EmptyStateCard from "../../properties/partials/passport/EmptyStateCard";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import SummaryStatCard from "../components/SummaryStatCard";
import SegmentDonut from "../components/SegmentDonut";
import ConditionAdjustedOfferModal from "../components/true-cost/ConditionAdjustedOfferModal";
import {generateTrueCostBuyerSummaryPdf} from "../generateTrueCostBuyerSummaryPdf";
import {SEVERITY_BADGE, formatCurrency} from "../prePurchaseUtils";
import Tooltip from "../../../utils/Tooltip";
import {
  buildDefaultTrueCostState,
  computeTrueCostMetrics,
  downPaymentAmount,
  downPaymentPercentFromAmount,
  formatCompactThousands,
  hydrateTrueCostState,
  normalizeRepairSeverity,
  offerSliderBounds,
  reconcileRepairItems,
  safeNumber,
  toTrueCostPayload,
} from "../trueCostCalculations";

const TRUE_COST_DISCLAIMER =
  "All values are estimates based on listing and inspection data. Not a guarantee of costs. Not a lender quote, appraisal, inspection, engineering opinion, or contractor quote. Consult your lender and agent.";

const INPUT_CLASS =
  "form-input w-full rounded-lg border-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white text-sm py-2";

const OFFER_SLIDER_CLASS =
  "tc-offer-slider w-full h-1.5 appearance-none bg-neutral-200 dark:bg-neutral-600 rounded-full cursor-pointer accent-[#456564]";

const TIMING_OPTIONS = [
  {value: "immediate", label: "Immediate"},
  {value: "deferred", label: "Deferred"},
  {value: "excluded", label: "Excluded"},
];

const SEVERITY_OPTIONS = [
  {value: "major", label: "Major"},
  {value: "moderate", label: "Moderate"},
  {value: "minor", label: "Minor"},
];

function FieldLabel({children, htmlFor}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-medium text-neutral-500 mb-1"
    >
      {children}
    </label>
  );
}

function PercentInput({id, value, onChange, disabled}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
        className={`${INPUT_CLASS} pr-8`}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
        %
      </span>
    </div>
  );
}

/**
 * True Cost tab — financing inputs, repair builder, and ownership cost summary.
 */
export default function TrueCostTab({analysis}) {
  const analysisId = analysis?.id;
  const findings = analysis?.findings || [];

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingSeverity, setEditingSeverity] = useState(false);
  const [restoreSeverityConfirmOpen, setRestoreSeverityConfirmOpen] =
    useState(false);

  const skipNextSave = useRef(true);
  const saveTimer = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const persist = useCallback(
    async (nextState) => {
      if (!analysisId || !nextState) return;
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const payload = toTrueCostPayload(nextState);
        await AppApi.upsertPrePurchaseTrueCost(analysisId, payload);
        if (mounted.current) setSaveStatus("saved");
      } catch (err) {
        if (mounted.current) {
          setSaveStatus("error");
          setSaveError(getApiErrorMessage(err) || "Failed to save True Cost");
        }
      }
    },
    [analysisId],
  );

  const scheduleSave = useCallback(
    (nextState) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(nextState), 600);
    },
    [persist],
  );

  const updateState = useCallback(
    (updater) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (!skipNextSave.current) scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  // Load / initialize
  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      skipNextSave.current = true;
      try {
        const saved = await AppApi.getPrePurchaseTrueCost(analysisId);
        let next;
        if (!saved) {
          next = buildDefaultTrueCostState(analysis);
          await AppApi.upsertPrePurchaseTrueCost(
            analysisId,
            toTrueCostPayload(next),
          );
        } else {
          next = hydrateTrueCostState(saved, analysis);
          // Persist reconciliation if findings changed
          const reconciled = reconcileRepairItems(
            saved.repairs?.items || [],
            analysis?.findings || [],
          );
          const savedJson = JSON.stringify(saved.repairs?.items || []);
          const nextJson = JSON.stringify(reconciled);
          if (savedJson !== nextJson) {
            next = {...next, repairs: {items: reconciled}};
            await AppApi.upsertPrePurchaseTrueCost(
              analysisId,
              toTrueCostPayload(next),
            );
          }
        }
        if (!cancelled) {
          setState(next);
          setSaveStatus("saved");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(err) || "Failed to load True Cost");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Allow autosave after paint
          setTimeout(() => {
            skipNextSave.current = false;
          }, 0);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // Intentionally key on analysis id + findings length/ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, findings.map((f) => f.id).join(",")]);

  const metrics = useMemo(
    () => (state ? computeTrueCostMetrics(state) : null),
    [state],
  );

  const findingMap = useMemo(() => {
    const m = new Map();
    for (const f of findings) m.set(Number(f.id), f);
    return m;
  }, [findings]);

  const validateNumber = (key, value) => {
    const n = Number(value);
    if (value === "" || value == null) {
      setFieldErrors((e) => ({...e, [key]: null}));
      return 0;
    }
    if (!Number.isFinite(n) || n < 0) {
      setFieldErrors((e) => ({
        ...e,
        [key]: "Must be a valid non-negative number",
      }));
      return safeNumber(value, 0);
    }
    setFieldErrors((e) => ({...e, [key]: null}));
    return n;
  };

  const setField = (key, value) => {
    const n = validateNumber(key, value);
    updateState((prev) => ({...prev, [key]: n}));
  };

  const setOfferPrice = (raw) => {
    const offer = validateNumber("offerPrice", raw);
    updateState((prev) => {
      const dp = downPaymentAmount(offer, prev.downPaymentPercent);
      return {...prev, offerPrice: offer, _downPaymentAmountCache: dp};
    });
  };

  const setDownPaymentPercent = (raw) => {
    const pct = validateNumber("downPaymentPercent", raw);
    updateState((prev) => ({...prev, downPaymentPercent: Math.min(100, pct)}));
  };

  const setDownPaymentAmount = (raw) => {
    const amount = validateNumber("downPaymentAmount", raw);
    updateState((prev) => {
      const offer = safeNumber(prev.offerPrice);
      const pct = downPaymentPercentFromAmount(offer, amount);
      return {...prev, downPaymentPercent: Math.min(100, pct)};
    });
  };

  const patchRepair = (index, patch) => {
    updateState((prev) => {
      const items = [...(prev.repairs?.items || [])];
      items[index] = {...items[index], ...patch};
      return {...prev, repairs: {items}};
    });
  };

  const restoreRecommendedSeverities = () => {
    updateState((prev) => ({
      ...prev,
      repairs: {
        items: (prev.repairs?.items || []).map((item) => {
          if (item.kind !== "finding") return item;
          const finding = findingMap.get(Number(item.findingId));
          return {
            ...item,
            severity: normalizeRepairSeverity(finding?.severity),
          };
        }),
      },
    }));
    setRestoreSeverityConfirmOpen(false);
  };

  const addCustomRepair = () => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `custom-${Date.now()}`;
    updateState((prev) => ({
      ...prev,
      repairs: {
        items: [
          ...(prev.repairs?.items || []),
          {
            kind: "custom",
            id,
            description: "Custom repair",
            included: true,
            timing: "immediate",
            severity: "moderate",
            estimatedCost: 0,
            note: null,
          },
        ],
      },
    }));
  };

  const removeCustomRepair = (index) => {
    updateState((prev) => {
      const items = [...(prev.repairs?.items || [])];
      items.splice(index, 1);
      return {...prev, repairs: {items}};
    });
  };

  const handleExport = () => {
    setExportError(null);
    try {
      generateTrueCostBuyerSummaryPdf(analysis, state);
    } catch (err) {
      setExportError(err?.message || "Failed to export summary");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        Loading True Cost…
      </div>
    );
  }

  if (loadError || !state || !metrics) {
    return (
      <EmptyStateCard
        icon={AlertCircle}
        title="Unable to load True Cost"
        description={loadError || "Something went wrong."}
      />
    );
  }

  const vsAsk = metrics.priceVsAsk;
  const items = state.repairs?.items || [];
  const canRestoreSeverity = items.some((item) => {
    if (item.kind !== "finding") return false;
    const finding = findingMap.get(Number(item.findingId));
    const recommended = normalizeRepairSeverity(finding?.severity);
    return normalizeRepairSeverity(item.severity, finding?.severity) !== recommended;
  });
  const sliderBounds = offerSliderBounds(state.listingPrice, state.offerPrice);
  const sliderValue = Math.min(
    sliderBounds.max,
    Math.max(sliderBounds.min, safeNumber(state.offerPrice, sliderBounds.min)),
  );
  const compositionSegments = [
    {
      label: "Offer price",
      value: safeNumber(state.offerPrice),
      color: "#456564",
    },
    {
      label: "Closing costs",
      value: safeNumber(state.closingCosts),
      color: "#6b8f8e",
    },
    {
      label: "Immediate repairs",
      value: metrics.immediateRepairTotal,
      color: "#dc2626",
    },
  ];

  return (
    <div className="space-y-5">
      <style>{`
        .tc-offer-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 1px solid #d4d4d4;
          box-shadow: 0 1px 2px rgba(0,0,0,0.12);
          cursor: grab;
        }
        .tc-offer-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 1px solid #d4d4d4;
          box-shadow: 0 1px 2px rgba(0,0,0,0.12);
          cursor: grab;
        }
        .tc-offer-slider::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: #e5e5e5;
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500 italic max-w-3xl">
          *{TRUE_COST_DISCLAIMER}
        </p>
        <SaveStatusBadge status={saveStatus} error={saveError} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryStatCard title="Offer Price" icon={Tag}>
          <p className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {formatCurrency(state.offerPrice)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            List price {formatCurrency(state.listingPrice)}
            {state.listingPrice != null && state.offerPrice != null ? (
              <>
                {" · "}
                <span
                  className={
                    vsAsk.delta < 0
                      ? "text-emerald-600 font-medium"
                      : vsAsk.delta > 0
                        ? "text-amber-600 font-medium"
                        : ""
                  }
                >
                  {vsAsk.delta < 0
                    ? `${formatCurrency(vsAsk.belowAsk)} below ask`
                    : vsAsk.delta > 0
                      ? `${formatCurrency(vsAsk.aboveAsk)} above ask`
                      : "At ask"}
                </span>
              </>
            ) : null}
          </p>
          <div className="mt-4 px-0.5">
            <input
              type="range"
              min={sliderBounds.min}
              max={sliderBounds.max}
              step={1000}
              value={sliderValue}
              onChange={(e) => setOfferPrice(e.target.value)}
              aria-label="Offer price"
              aria-valuemin={sliderBounds.min}
              aria-valuemax={sliderBounds.max}
              aria-valuenow={sliderValue}
              aria-valuetext={formatCurrency(sliderValue)}
              className={OFFER_SLIDER_CLASS}
            />
            <div className="flex justify-between mt-1.5 text-[11px] text-neutral-400 tabular-nums">
              <span>{formatCompactThousands(sliderBounds.min)}</span>
              <span>{formatCompactThousands(sliderBounds.max)}</span>
            </div>
          </div>
        </SummaryStatCard>

        <section
          className="rounded-2xl border border-[#456564] bg-[#456564] p-4 text-white"
          style={{
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/80">
              True Cost to Acquire
            </h3>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-white bg-white/15">
              <Calculator className="w-4 h-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-white">
            {formatCurrency(metrics.trueCostToAcquire)}
          </p>
          <p className="text-xs text-white/75 mt-1">
            Offer + repairs + closing
          </p>
        </section>

        <SummaryStatCard title="True Monthly Cost" icon={CalendarDays}>
          <p className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {formatCurrency(metrics.trueMonthlyCost)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            PITI + maintenance reserve
          </p>
        </SummaryStatCard>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Acquisition inputs */}
        <SectionCard
          className="xl:col-span-4 xl:sticky xl:top-4 self-start"
          title="Acquisition Inputs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="tc-offer">Offer price</FieldLabel>
              <CurrencyInput
                id="tc-offer"
                name="offerPrice"
                value={state.offerPrice ?? ""}
                onChange={(e) => setOfferPrice(e.target.value)}
                className={INPUT_CLASS}
              />
              {fieldErrors.offerPrice ? (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.offerPrice}
                </p>
              ) : vsAsk.delta < 0 ? (
                <p className="text-xs text-emerald-600 mt-1">
                  {formatCurrency(vsAsk.belowAsk)} below ask
                </p>
              ) : null}
            </div>

            <div>
              <FieldLabel htmlFor="tc-listing">Listing price</FieldLabel>
              <CurrencyInput
                id="tc-listing"
                name="listingPrice"
                value={state.listingPrice ?? ""}
                onChange={(e) => setField("listingPrice", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <FieldLabel htmlFor="tc-dp-amt">Down payment</FieldLabel>
              <CurrencyInput
                id="tc-dp-amt"
                name="downPaymentAmount"
                value={metrics.downPaymentAmount}
                onChange={(e) => setDownPaymentAmount(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <FieldLabel htmlFor="tc-dp-pct">Down payment %</FieldLabel>
              <PercentInput
                id="tc-dp-pct"
                value={state.downPaymentPercent}
                onChange={setDownPaymentPercent}
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="tc-loan">Loan amount</FieldLabel>
              <input
                id="tc-loan"
                readOnly
                value={formatCurrency(metrics.loanAmount)}
                className={`${INPUT_CLASS} bg-neutral-50 dark:bg-neutral-800/80 text-neutral-600`}
              />
            </div>

            <div>
              <FieldLabel htmlFor="tc-rate">Interest rate</FieldLabel>
              <PercentInput
                id="tc-rate"
                value={state.interestRate}
                onChange={(v) => setField("interestRate", v)}
              />
            </div>

            <div>
              <FieldLabel htmlFor="tc-term">Loan term</FieldLabel>
              <select
                id="tc-term"
                value={state.loanTermYears}
                onChange={(e) =>
                  setField("loanTermYears", Number(e.target.value))
                }
                className={INPUT_CLASS}
              >
                {[10, 15, 20, 25, 30].map((y) => (
                  <option key={y} value={y}>
                    {y} years
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="tc-tax">Property tax /yr</FieldLabel>
              <PercentInput
                id="tc-tax"
                value={state.propertyTaxPercent}
                onChange={(v) => setField("propertyTaxPercent", v)}
              />
            </div>

            <div>
              <FieldLabel htmlFor="tc-ins">Insurance /mo</FieldLabel>
              <CurrencyInput
                id="tc-ins"
                name="insuranceMonthly"
                value={state.insuranceMonthly ?? ""}
                onChange={(e) => setField("insuranceMonthly", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="tc-closing">Closing costs</FieldLabel>
              <CurrencyInput
                id="tc-closing"
                name="closingCosts"
                value={state.closingCosts ?? ""}
                onChange={(e) => setField("closingCosts", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div
              id="tc-maintenance-reserve"
              className="sm:col-span-2 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 scroll-mt-24"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  Maintenance reserve
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state.maintenanceReserveEnabled}
                  onClick={() =>
                    updateState((prev) => ({
                      ...prev,
                      maintenanceReserveEnabled:
                        !prev.maintenanceReserveEnabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    state.maintenanceReserveEnabled
                      ? "bg-[#456564]"
                      : "bg-neutral-300 dark:bg-neutral-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      state.maintenanceReserveEnabled
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PercentInput
                  id="tc-reserve"
                  value={state.maintenanceReservePercent}
                  disabled={!state.maintenanceReserveEnabled}
                  onChange={(v) => setField("maintenanceReservePercent", v)}
                />
                <input
                  readOnly
                  value={`${formatCurrency(metrics.monthlyMaintenanceReserve)} /mo`}
                  className={`${INPUT_CLASS} bg-neutral-50 dark:bg-neutral-800/80`}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Repair builder */}
        <SectionCard
          className="xl:col-span-5"
          title="Repair Cost Builder"
          badge={
            <StatusBadge tone="brand" className="uppercase text-[10px]">
              Synced
            </StatusBadge>
          }
        >
          {items.length === 0 ? (
            <EmptyStateCard
              icon={Calculator}
              title="No inspection issues yet"
              description="Add custom repair line items, or wait for analysis findings to appear."
              actionLabel="+ Add line item"
              onAction={addCustomRepair}
            />
          ) : (
            <>
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full text-sm table-fixed sm:table-auto">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100 dark:border-neutral-800">
                      <th className="py-2 pl-0.5 pr-2 w-10" scope="col">
                        <span className="sr-only">Include</span>
                      </th>
                      <th className="py-2 pr-2">Issue</th>
                      <th className="py-2 pr-2 whitespace-nowrap">
                        <span className="inline-flex w-fit items-center gap-1">
                          Severity
                          <span className="inline-flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingSeverity((prev) => !prev)
                              }
                              className="p-0.5 rounded text-neutral-400 hover:text-[#456564] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#456564]/40"
                              aria-pressed={editingSeverity}
                              aria-label={
                                editingSeverity
                                  ? "Done editing severity"
                                  : "Edit severity"
                              }
                            >
                              {editingSeverity ? (
                                <Check className="w-3.5 h-3.5" aria-hidden />
                              ) : (
                                <Pencil className="w-3.5 h-3.5" aria-hidden />
                              )}
                            </button>
                            {editingSeverity ? (
                              <Tooltip
                                content="Restore recommended severity from the analysis"
                                position="top"
                                size="sm"
                                className="!pl-0"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRestoreSeverityConfirmOpen(true)
                                  }
                                  disabled={!canRestoreSeverity}
                                  className="p-0.5 rounded text-neutral-400 hover:text-[#456564] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#456564]/40 disabled:opacity-40 disabled:hover:text-neutral-400 disabled:cursor-not-allowed"
                                  aria-label="Restore recommended severity"
                                >
                                  <RotateCcw
                                    className="w-3.5 h-3.5"
                                    aria-hidden
                                  />
                                </button>
                              </Tooltip>
                            ) : null}
                          </span>
                        </span>
                      </th>
                      <th className="py-2 pr-2">Timing</th>
                      <th className="py-2 text-right">Est. Cost</th>
                      <th className="py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const finding =
                        item.kind === "finding"
                          ? findingMap.get(Number(item.findingId))
                          : null;
                      const rowKey =
                        item.kind === "custom"
                          ? item.id
                          : `f-${item.findingId}`;
                      const title =
                        item.kind === "custom"
                          ? item.description
                          : finding?.title || `Finding #${item.findingId}`;
                      const severity =
                        item.severity ?? finding?.severity ?? "moderate";

                      return (
                        <tr
                          key={rowKey}
                          className="border-b border-neutral-100 dark:border-neutral-800/80 align-middle"
                        >
                          <td className="py-2.5 pl-0.5 pr-2 align-middle overflow-visible">
                            <div className="flex h-6 w-6 items-center justify-center">
                              <input
                                type="checkbox"
                                checked={Boolean(item.included)}
                                onChange={(e) =>
                                  patchRepair(index, {
                                    included: e.target.checked,
                                    timing:
                                      e.target.checked &&
                                      item.timing === "excluded"
                                        ? "immediate"
                                        : !e.target.checked
                                          ? "excluded"
                                          : item.timing,
                                  })
                                }
                                className="h-4 w-4 shrink-0 rounded border-neutral-300 text-[#456564] focus:ring-2 focus:ring-[#456564]/40 focus:ring-offset-0"
                                aria-label={`Include ${title}`}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 pr-2">
                            {item.kind === "custom" ? (
                              <input
                                className={`${INPUT_CLASS} font-medium`}
                                value={item.description || ""}
                                onChange={(e) =>
                                  patchRepair(index, {
                                    description: e.target.value,
                                  })
                                }
                                aria-label="Custom repair description"
                              />
                            ) : (
                              <span className="font-medium text-neutral-800 dark:text-neutral-100">
                                {title}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-2">
                            {editingSeverity ? (
                              <select
                                value={severity}
                                onChange={(e) =>
                                  patchRepair(index, {
                                    severity: e.target.value,
                                  })
                                }
                                className="form-select text-xs rounded-md border-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 py-1"
                                aria-label={`Severity for ${title}`}
                              >
                                {SEVERITY_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <StatusBadge
                                tone={SEVERITY_BADGE[severity] || "neutral"}
                                className="capitalize"
                              >
                                {severity}
                              </StatusBadge>
                            )}
                          </td>
                          <td className="py-2.5 pr-2">
                            <select
                              value={item.timing}
                              onChange={(e) => {
                                const timing = e.target.value;
                                patchRepair(index, {
                                  timing,
                                  included: timing !== "excluded",
                                });
                              }}
                              className="form-select text-xs rounded-md border-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 py-1"
                            >
                              {TIMING_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-medium">
                            <div className="inline-block w-28">
                              <CurrencyInput
                                name={`cost-${rowKey}`}
                                value={item.estimatedCost ?? ""}
                                onChange={(e) =>
                                  patchRepair(index, {
                                    estimatedCost: safeNumber(e.target.value),
                                  })
                                }
                                className={`${INPUT_CLASS} text-right`}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 pl-1">
                            {item.kind === "custom" ? (
                              <button
                                type="button"
                                onClick={() => removeCustomRepair(index)}
                                className="p-1 text-neutral-400 hover:text-red-600"
                                aria-label="Delete custom item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="mt-3 text-xs font-medium text-[#456564] inline-flex items-center gap-1 hover:underline"
                onClick={addCustomRepair}
              >
                <Plus className="w-3.5 h-3.5" />
                Add line item
              </button>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm border-t border-neutral-100 dark:border-neutral-800 pt-4">
                <p>
                  Immediate repairs (must-fix){" "}
                  <span className="font-bold text-red-600 tabular-nums">
                    {formatCurrency(metrics.immediateRepairTotal)}
                  </span>
                </p>
                <p>
                  Deferred repairs (3–5 yr){" "}
                  <span className="font-bold text-amber-600 tabular-nums">
                    {formatCurrency(metrics.deferredRepairTotal)}
                  </span>
                </p>
                <p className="text-neutral-500">
                  Included issues{" "}
                  <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                    {formatCurrency(metrics.includedRepairTotal)}
                  </span>
                </p>
              </div>
            </>
          )}
        </SectionCard>

        {/* Cost composition */}
        <SectionCard
          className="xl:col-span-3 xl:sticky xl:top-4 self-start"
          title="Cost Composition"
        >
          <SegmentDonut
            segments={compositionSegments}
            size={160}
            strokeWidth={16}
            centerLabel={formatCurrency(metrics.trueCostToAcquire)}
            centerSubLabel="Total"
            formatValue={(v) => formatCurrency(v)}
          />
          <div className="mt-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 px-3 py-2 text-xs text-sky-800 dark:text-sky-200 flex gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>
              Values include estimated closing costs and selected immediate
              repairs. Chart total matches True Cost to Acquire.
            </span>
          </div>
        </SectionCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <SectionCard
          title="Monthly Ownership Breakdown"
          badge={
            <Info
              className="w-4 h-4 text-neutral-400"
              aria-label="Monthly ownership cost details"
            />
          }
        >
          <div className="flex flex-col gap-4">
            <div className="min-w-0 w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 border-b border-neutral-200 dark:border-neutral-700">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">Monthly Cost</th>
                    <th className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "Principal & Interest",
                      value: metrics.monthlyPrincipalAndInterest,
                      note: `${state.loanTermYears}-yr loan @ ${Number(state.interestRate).toFixed(2)}% on ${formatCurrency(metrics.loanAmount)}`,
                    },
                    {
                      label: "Property Taxes",
                      value: metrics.monthlyPropertyTax,
                      note: `${Number(state.propertyTaxPercent).toFixed(1)}% of offer price annually`,
                    },
                    {
                      label: "Homeowners Insurance",
                      value: metrics.monthlyInsurance,
                      note: "Estimate",
                    },
                    {
                      label: "Maintenance Reserve",
                      value: metrics.monthlyMaintenanceReserve,
                      note: state.maintenanceReserveEnabled
                        ? `${Number(state.maintenanceReservePercent).toFixed(1)}% of home value annually`
                        : "Disabled",
                    },
                  ].map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="py-3 pr-3 font-medium text-neutral-900 dark:text-white">
                        {row.label}
                      </td>
                      <td className="py-3 pr-3 font-semibold tabular-nums text-neutral-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(row.value)}
                      </td>
                      <td className="py-3 text-neutral-500 text-xs sm:text-sm">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-4 pr-3 font-semibold text-neutral-900 dark:text-white">
                      Total Monthly Ownership
                    </td>
                    <td className="pt-4 pr-3 font-bold tabular-nums text-emerald-800 dark:text-emerald-400 text-lg whitespace-nowrap">
                      {formatCurrency(metrics.trueMonthlyCost)}
                    </td>
                    <td className="pt-4" />
                  </tr>
                </tbody>
              </table>
            </div>

            <aside className="w-full rounded-2xl bg-[#F7F5F0] dark:bg-neutral-800/70 border border-neutral-200/60 dark:border-neutral-700 px-4 py-4 flex flex-col">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Reserves cover future repairs
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900 dark:text-white leading-none">
                {formatCurrency(metrics.monthlyMaintenanceReserve)}
                <span className="text-sm font-semibold text-neutral-500 ml-1">
                  /mo
                </span>
              </p>
              <p className="mt-1.5 text-xs text-neutral-500">
                {state.maintenanceReserveEnabled
                  ? `${Number(state.maintenanceReservePercent).toFixed(1)}% of home value`
                  : "Reserve disabled"}
              </p>
            </aside>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-900 dark:text-amber-100/90">
            <p className="font-semibold mb-1">
              5-year estimated cash outlay:{" "}
              <span className="tabular-nums">
                {formatCurrency(metrics.fiveYearCashOutlay)}
              </span>
            </p>
            <p>
              Includes down payment, closing, immediate repairs, 60 months of
              ownership costs, and deferred repairs. Does not account for
              appreciation, sale proceeds, tax effects, or remaining equity.
            </p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">
              Cash to close (estimate): {formatCurrency(metrics.cashToClose)}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Agent Takeaways"
          icon={Star}
          iconClassName="text-[#456564]"
        >
          <div className="flex flex-col gap-5">
            <ul className="min-w-0 w-full divide-y divide-neutral-200 dark:divide-neutral-700">
              <TakeawayRow
                icon={Info}
                label="Affordability impact"
                text={metrics.takeaways.affordabilityImpact}
              />
              <TakeawayRow
                icon={Wrench}
                label="Inspection leverage"
                text={metrics.takeaways.inspectionLeverage}
              />
              <TakeawayRow
                icon={Heart}
                label="Suggested next step"
                text={metrics.takeaways.suggestedNextStep}
              />
            </ul>

            <aside className="w-full rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700 px-4 py-4 flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#456564] mb-2">
                Condition-adjusted offer
                <Info className="w-3.5 h-3.5" aria-hidden />
              </div>
              <p className="text-2xl font-bold tabular-nums text-[#456564] leading-none">
                {formatCurrency(metrics.conditionAdjustedOffer)}
              </p>
              <p className="text-sm font-medium text-[#456564]/90 mt-2">
                {metrics.immediateRepairTotal > 0
                  ? `${formatCurrency(metrics.immediateRepairTotal)} below your offer`
                  : "Matches your current offer"}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setOfferModalOpen(true)}
                  className="w-full btn bg-[#456564] text-white hover:bg-[#3a5554] inline-flex items-center justify-center gap-1.5 text-sm"
                >
                  See condition-adjusted offer
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="w-full btn bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 text-[#456564] inline-flex items-center justify-center gap-1.5 text-sm font-semibold"
                >
                  <FileDown className="w-3.5 h-3.5" aria-hidden />
                  Export buyer summary
                </button>
              </div>
              {exportError ? (
                <p className="text-xs text-red-600 mt-2">{exportError}</p>
              ) : null}
            </aside>
          </div>
        </SectionCard>
      </div>

      <p className="text-center text-xs text-neutral-400 pt-2">
        This analysis is for informational purposes only and not a substitute
        for professional advice.
      </p>

      <ConditionAdjustedOfferModal
        open={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        offerPrice={state.offerPrice}
        immediateRepairTotal={metrics.immediateRepairTotal}
        conditionAdjustedOffer={metrics.conditionAdjustedOffer}
      />

      <ModalBlank
        id="restore-severity-confirm-modal"
        modalOpen={restoreSeverityConfirmOpen}
        setModalOpen={setRestoreSeverityConfirmOpen}
        contentClassName="max-w-md"
      >
        <div className="p-5 flex space-x-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#456564]/10">
            <RotateCcw
              className="w-5 h-5 text-[#456564] shrink-0"
              aria-hidden
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Restore recommended severity?
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              This resets severity on inspection findings back to the analysis
              recommendations. Custom line items are left unchanged.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                onClick={() => setRestoreSeverityConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-sm bg-[#456564] hover:bg-[#3a5554] text-white"
                onClick={restoreRecommendedSeverities}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      </ModalBlank>
    </div>
  );
}

function SaveStatusBadge({status, error}) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-red-600"
        title={error}
      >
        <AlertCircle className="w-3.5 h-3.5" aria-hidden />
        Save failed
      </span>
    );
  }
  return <span className="text-xs text-emerald-600 font-medium">Saved</span>;
}

function TakeawayRow({icon: Icon, label, text}) {
  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#456564]/10 text-[#456564] shrink-0 mt-0.5">
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-neutral-900 dark:text-white text-sm">
          {label}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
          {text}
        </p>
      </div>
    </li>
  );
}
