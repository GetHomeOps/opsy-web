import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useParams} from "react-router-dom";
import {Line} from "react-chartjs-2";
import {
  Home,
  PiggyBank,
  CreditCard,
  BarChart3,
  Landmark,
  Calendar,
  Lightbulb,
  FileText,
  ChevronRight,
  Plus,
  Upload,
  TrendingUp,
  Info,
  Loader2,
} from "lucide-react";
import SectionCard from "./partials/passport/SectionCard";
import EmptyStateCard from "./partials/passport/EmptyStateCard";
import {StatusBadge} from "./partials/passport/StatusBadge";
import ProvenanceBadge from "./partials/financials/ProvenanceBadge";
import EquityDonutChart from "./partials/financials/EquityDonutChart";
import HousingCostsBar from "./partials/financials/HousingCostsBar";
import AddInsuranceModal from "./partials/financials/AddInsuranceModal";
import AddHoaModal from "./partials/financials/AddHoaModal";
import MortgageDetailsModal from "./partials/financials/MortgageDetailsModal";
import PublicRecordLock from "./partials/financials/PublicRecordLock";
import AttomSyncBanner from "./partials/financials/AttomSyncBanner";
import UploadDocumentModal from "./partials/UploadDocumentModal";
import ModalBlank from "../../components/ModalBlank";
import {parseCurrencyInput} from "../../components/CurrencyInput";
import AppApi, {getApiErrorMessage} from "../../api/api";
import {useAuth} from "../../context/AuthContext";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatShortCurrency,
} from "./partials/financials/financialsFormat";
import {FINANCIAL_FILING_TYPE_IDS} from "./partials/financials/financialDocumentUpload";
import "../home/components/chartConfig";

function MetricCell({icon: Icon, label, value, hint, source, loading, action}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-8 h-8 rounded-full bg-[#456564]/10 text-[#456564] inline-flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-7 w-28 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums leading-tight">
          {value ?? "Not available"}
        </p>
      )}
      {hint && (
        <p className="text-[11px] text-neutral-500 mt-1">{hint}</p>
      )}
      {source && <div className="mt-1.5"><ProvenanceBadge source={source} /></div>}
      {action && !loading ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}

function DataRow({label, value, empty, note, loading}) {
  return (
    <div className="py-1.5">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
        {loading && empty ? (
          <span
            className="inline-block h-4 w-20 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse"
            aria-hidden="true"
          />
        ) : (
          <span className={`text-right font-medium ${empty ? "text-neutral-400 font-normal" : "text-neutral-900 dark:text-white"}`}>
            {empty ? "Not available" : value}
          </span>
        )}
      </div>
      {note ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 text-right leading-snug">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function AdminField({label, children}) {
  return (
    <label className="block py-1.5">
      <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function CardLink({children, onClick}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
    >
      {children}
      <ChevronRight className="w-3.5 h-3.5" />
    </button>
  );
}

function GhostAdd({children, onClick}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#456564] hover:underline"
    >
      <Plus className="w-3 h-3" />
      {children}
    </button>
  );
}

function DetailModal({open, onClose, title, children}) {
  return (
    <ModalBlank id={`${title}-detail`} modalOpen={open} setModalOpen={onClose} contentClassName="max-w-lg">
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
      <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end">
        <button type="button" onClick={() => onClose(false)} className="btn border-gray-200">
          Close
        </button>
      </div>
    </ModalBlank>
  );
}

function FinancialsTab({
  propertyId,
  propertyData = {},
  onNavigateTab,
  attomRefresh,
}) {
  const {currentUser} = useAuth();
  const {accountUrl} = useParams();
  const canUnlockFinancials = ["admin", "super_admin"].includes(
    String(currentUser?.role || "").toLowerCase(),
  );
  const resolvedId =
    propertyId ||
    propertyData.id ||
    propertyData.identity?.id ||
    null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [uploadType, setUploadType] = useState(null);
  const [unlocked, setUnlocked] = useState({ownership: false, mortgage: false, homeValue: false});
  const [ownershipDraft, setOwnershipDraft] = useState(null);
  const [mortgageDraft, setMortgageDraft] = useState(null);
  const [homeValueDraft, setHomeValueDraft] = useState(null);

  const load = useCallback(async () => {
    if (!resolvedId) {
      setLoading(false);
      return;
    }
    try {
      const financials = await AppApi.getPropertyFinancials(resolvedId);
      setData(financials);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load financials."));
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const inFlight =
      data?.attomStatus === "loading" || Boolean(attomRefresh?.isActive);
    if (!inFlight) return undefined;
    const t = setInterval(() => {
      void load();
    }, 4000);
    return () => clearInterval(t);
  }, [data?.attomStatus, attomRefresh?.isActive, load]);

  useEffect(() => {
    if (attomRefresh?.jobStatus === "completed") void load();
  }, [attomRefresh?.jobStatus, load]);

  const patch = async (fn) => {
    setSaving(true);
    try {
      const next = await fn();
      setData(next);
      setModal(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save financial details."));
    } finally {
      setSaving(false);
    }
  };

  const homeValue = data?.homeValue;
  const equity = data?.equity;
  const remaining = data?.remainingMortgage;
  const mortgage = data?.mortgage || {};
  const monthly = data?.monthlyCosts;
  const ownership = data?.ownership || {};
  const attomInFlight =
    data?.attomStatus === "loading" || Boolean(attomRefresh?.isActive);
  const attomLoading = loading || attomInFlight;
  const saleFlagged = Boolean(ownership.lastSaleImplausible);
  const saleNote = saleFlagged
    ? "This recorded amount may not be a market purchase."
    : null;

  const propertyContextLabel =
    propertyData.propertyName ||
    propertyData.address ||
    [propertyData.address, propertyData.city, propertyData.state]
      .filter(Boolean)
      .join(", ");

  const homeValueAdjustmentUrl = useMemo(() => {
    if (!accountUrl) return undefined;
    const params = new URLSearchParams();
    params.set("system", "ATTOM");
    params.set("field", "homeValue");
    if (resolvedId) params.set("propertyId", String(resolvedId));
    if (propertyContextLabel) params.set("propertyLabel", propertyContextLabel);
    if (homeValue?.value != null) params.set("currentValue", String(homeValue.value));
    return `/${accountUrl}/settings/support/data-adjustment?${params.toString()}`;
  }, [accountUrl, resolvedId, propertyContextLabel, homeValue?.value]);

  const openHomeValueAdjustment = () => {
    if (!homeValueAdjustmentUrl) return;
    window.open(homeValueAdjustmentUrl, "_blank", "noopener,noreferrer");
  };

  const beginHomeValueEdit = () => {
    setHomeValueDraft({
      value: homeValue?.value != null ? String(homeValue.value) : "",
    });
    setUnlocked((u) => ({...u, homeValue: true}));
  };

  const saveHomeValueAdmin = () => {
    if (!homeValueDraft) return;
    const parsed = parseCurrencyInput(homeValueDraft.value);
    if (parsed == null) {
      setError("Enter a home value.");
      return;
    }
    return patch(async () => {
      const next = await AppApi.patchPropertyFinancialsAdmin(resolvedId, {
        homeValue: parsed,
      });
      setUnlocked((u) => ({...u, homeValue: false}));
      setHomeValueDraft(null);
      return next;
    });
  };

  const beginOwnershipEdit = () => {
    setOwnershipDraft({
      lastSalePrice:
        ownership.purchasePrice?.value != null ? String(ownership.purchasePrice.value) : "",
      lastSaleDate: ownership.purchaseDate || "",
      ownerOccupied:
        ownership.ownerOccupied == null ? "" : ownership.ownerOccupied ? "yes" : "no",
      occupancy: ownership.occupancy || "",
      annualTaxAmount:
        data?.tax?.annualAmount?.value != null ? String(data.tax.annualAmount.value) : "",
      taxYear: data?.tax?.year != null ? String(data.tax.year) : "",
    });
    setUnlocked((u) => ({...u, ownership: true}));
  };

  const beginMortgageEdit = () => {
    setMortgageDraft({
      lender: mortgage.lender || "",
      originalAmount:
        mortgage.originalAmount?.value != null ? String(mortgage.originalAmount.value) : "",
      interestRate:
        mortgage.recordedInterestRate?.value != null
          ? String(mortgage.recordedInterestRate.value)
          : "",
      termMonths: mortgage.termMonths != null ? String(mortgage.termMonths) : "",
      originationDate: mortgage.originationDate || "",
    });
    setUnlocked((u) => ({...u, mortgage: true}));
  };

  const saveOwnershipAdmin = () => {
    if (!ownershipDraft) return;
    const taxYearRaw = ownershipDraft.taxYear.trim();
    const taxYear = taxYearRaw === "" ? null : Number(taxYearRaw);
    if (taxYear != null && (!Number.isInteger(taxYear) || taxYear < 1800 || taxYear > 2100)) {
      setError("Tax year must be a valid year.");
      return;
    }
    return patch(async () => {
      const next = await AppApi.patchPropertyFinancialsAdmin(resolvedId, {
        lastSalePrice: parseCurrencyInput(ownershipDraft.lastSalePrice),
        lastSaleDate: ownershipDraft.lastSaleDate || null,
        ownerOccupied:
          ownershipDraft.ownerOccupied === "yes"
            ? true
            : ownershipDraft.ownerOccupied === "no"
              ? false
              : null,
        occupancy: ownershipDraft.occupancy.trim() || null,
        annualTaxAmount: parseCurrencyInput(ownershipDraft.annualTaxAmount),
        taxYear,
      });
      setUnlocked((u) => ({...u, ownership: false}));
      setOwnershipDraft(null);
      return next;
    });
  };

  const saveMortgageAdmin = () => {
    if (!mortgageDraft) return;
    const termRaw = mortgageDraft.termMonths.trim();
    const termMonths = termRaw === "" ? null : Number(termRaw);
    const rateRaw = mortgageDraft.interestRate.trim();
    const rate = rateRaw === "" ? null : Number(rateRaw);
    if (termMonths != null && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 720)) {
      setError("Loan term must be between 1 and 720 months.");
      return;
    }
    if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      setError("Enter a valid recorded interest rate.");
      return;
    }
    return patch(async () => {
      const next = await AppApi.patchPropertyFinancialsAdmin(resolvedId, {
        mortgageLender: mortgageDraft.lender.trim() || null,
        mortgageOriginalAmount: parseCurrencyInput(mortgageDraft.originalAmount),
        mortgageInterestRate: rate,
        mortgageTermMonths: termMonths,
        mortgageOriginationDate: mortgageDraft.originationDate || null,
      });
      setUnlocked((u) => ({...u, mortgage: false}));
      setMortgageDraft(null);
      return next;
    });
  };

  const costCategories = useMemo(() => {
    const cats = monthly?.categories || [];
    return cats.map((c) => {
      if (c.id === "insurance" && c.amount == null) {
        return {
          ...c,
          action: <GhostAdd onClick={() => setModal("insurance")}>Add insurance</GhostAdd>,
        };
      }
      if (c.id === "hoa" && c.amount == null && !c.notApplicable) {
        return {
          ...c,
          action: (
            <span className="inline-flex items-center gap-2 shrink-0">
              <GhostAdd onClick={() => setModal("hoa")}>Add HOA</GhostAdd>
              <button
                type="button"
                onClick={() =>
                  patch(() => AppApi.patchPropertyFinancialsHoa(resolvedId, {notApplicable: true}))
                }
                className="text-xs text-neutral-400 hover:underline"
              >
                This property has no HOA
              </button>
            </span>
          ),
        };
      }
      return c;
    });
  }, [monthly, resolvedId]);

  const otherLiensPct =
    data?.otherLiens && homeValue?.value
      ? (data.otherLiens.value / homeValue.value) * 100
      : 0;

  const dashboardInsights = (data?.insights || []).slice(0, 3);
  const upcoming = (data?.obligations || []).slice(0, 4);
  const financialDocs = (data?.documents || []).filter((d) =>
    FINANCIAL_FILING_TYPE_IDS.has(String(d.type || "").toLowerCase()),
  );

  const trendChart = useMemo(() => {
    if (!data?.trend?.labels?.length) return null;
    const singlePoint = data.trend.labels.length === 1;
    const pointRadius = singlePoint ? 4 : 0;
    const pointHoverRadius = singlePoint ? 6 : 3;
    return {
      labels: data.trend.labels.map((d) => formatDate(d, {month: "short", year: "2-digit"}) || d),
      datasets: [
        {
          label: "Estimated value",
          data: data.trend.value,
          borderColor: "#456564",
          backgroundColor: "rgba(69, 101, 100, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius,
          pointHoverRadius,
          borderWidth: 2,
        },
        {
          label: "Estimated equity",
          data: data.trend.equity,
          borderColor: "#7fa3a1",
          backgroundColor: "transparent",
          fill: false,
          tension: 0.35,
          pointRadius,
          pointHoverRadius,
          borderWidth: 2,
        },
      ],
    };
  }, [data]);

  const openUpload = (type) => {
    setModal(null);
    setUploadType(type);
  };

  if (!resolvedId) {
    return (
      <EmptyStateCard
        icon={Landmark}
        title="Save this property first"
        description="Financials become available after the property is saved."
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {attomInFlight && <AttomSyncBanner />}

      <section className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 px-4 md:px-5 py-4">
        <div className="flex flex-col xl:flex-row xl:items-start gap-5">
          <div className="xl:max-w-sm min-w-0">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Your property finances at a glance
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
              Smart estimates and public records to help you understand your home's value, equity, and costs.
            </p>
            {!attomInFlight && (
              <p className="text-[11px] text-neutral-400 mt-2 inline-flex items-center gap-1">
                <Info className="w-3 h-3" />
                {data?.lastUpdated
                  ? `Last updated ${formatDate(data.lastUpdated)}`
                  : "Public records not yet loaded"}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 flex-1 min-w-0">
            <MetricCell
              icon={Home}
              label="Estimated Home Value"
              value={formatCurrency(homeValue?.value)}
              hint={
                data?.homeValueRange?.low != null
                  ? `Range ${formatCurrency(data.homeValueRange.low)} – ${formatCurrency(data.homeValueRange.high)}`
                  : null
              }
              source={homeValue?.source}
              loading={attomLoading && !homeValue}
              action={
                !homeValue && !attomLoading
                  ? canUnlockFinancials
                    ? <GhostAdd onClick={beginHomeValueEdit}>Add home value</GhostAdd>
                    : homeValueAdjustmentUrl
                      ? (
                        <button
                          type="button"
                          onClick={openHomeValueAdjustment}
                          className="text-xs font-semibold text-[#456564] hover:underline"
                        >
                          Request data adjustment
                        </button>
                      )
                      : null
                  : null
              }
            />
            <MetricCell
              icon={PiggyBank}
              label="Estimated Equity"
              value={formatCurrency(equity?.amount)}
              hint={equity?.percent != null ? `${formatPercent(equity.percent, 0)} of value` : null}
              source={equity?.source}
              loading={attomLoading && !equity}
            />
            <MetricCell
              icon={CreditCard}
              label="Remaining Mortgage"
              value={
                remaining?.value != null
                  ? formatCurrency(remaining.value)
                  : mortgage.hasRecordedMortgage
                    ? "Not available"
                    : attomLoading
                      ? null
                      : "No mortgage on record"
              }
              hint={
                mortgage.interestRate?.value != null
                  ? `${mortgage.interestRate.value}% rate`
                  : remaining
                    ? null
                    : mortgage.hasRecordedMortgage
                      ? "Balance not yet estimated"
                      : null
              }
              source={remaining?.source}
              loading={attomLoading && !remaining}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SectionCard
          flat
          title="Property Financial Snapshot"
          icon={BarChart3}
          action={
            <PublicRecordLock
              canUnlock={canUnlockFinancials}
              unlocked={unlocked.homeValue}
              onToggle={() => {
                if (unlocked.homeValue) {
                  setUnlocked((u) => ({...u, homeValue: false}));
                  setHomeValueDraft(null);
                } else {
                  beginHomeValueEdit();
                }
              }}
              tooltip="Estimated home value is not directly editable. Submit a data adjustment request and our team will update it for you."
              requestUrl={!canUnlockFinancials ? homeValueAdjustmentUrl : undefined}
              requestLabel="Request data adjustment"
            />
          }
        >
          {unlocked.homeValue && homeValueDraft ? (
            <div>
              <AdminField label="Home value">
                <input
                  className="form-input w-full"
                  value={homeValueDraft.value}
                  onChange={(e) => setHomeValueDraft((d) => ({...d, value: e.target.value}))}
                  placeholder="e.g. 525000"
                />
              </AdminField>
              <p className="text-[11px] text-neutral-400">
                Used for equity and LTV. Overrides the ATTOM estimate for this property.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn border-gray-200"
                  onClick={() => {
                    setUnlocked((u) => ({...u, homeValue: false}));
                    setHomeValueDraft(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary disabled:opacity-60"
                  disabled={saving}
                  onClick={saveHomeValueAdmin}
                >
                  Save
                </button>
              </div>
            </div>
          ) : homeValue ? (
            <>
              {equity ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-3">
                  You have built about{" "}
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {formatCurrency(equity.amount, {compact: true})}
                  </span>{" "}
                  in equity.
                </p>
              ) : (
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-3">
                  Estimated equity and LTV appear once a current or estimated mortgage
                  balance is available.
                </p>
              )}
              <div className="flex items-center gap-4">
                {equity ? (
                  <EquityDonutChart
                    equityPercent={equity.percent}
                    equityAmount={equity.amount}
                    ltvPercent={data.ltv?.percent}
                    debtAmount={remaining?.value}
                    otherLiensPercent={otherLiensPct}
                    otherLiensAmount={data.otherLiens?.value}
                  />
                ) : null}
                <ul className="text-sm space-y-1.5 min-w-0 flex-1">
                  <li className="flex justify-between gap-3">
                    <span className="text-neutral-500">Equity</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(equity?.amount) ?? "Not available"}
                    </span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-neutral-500">Debt (mortgage)</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(remaining?.value) ?? "Not available"}
                    </span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-neutral-500">Other liens</span>
                    <span className="font-medium tabular-nums">
                      {data.otherLiens ? formatCurrency(data.otherLiens.value) : "None recorded"}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400">Home value</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(homeValue.value)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400">Mortgage</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(remaining?.value) ?? "Not available"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400">LTV</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatPercent(data.ltv?.percent, 1) ?? "Not available"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400 mt-3">
                {homeValue.source === "verified"
                  ? "Source: Verified home value"
                  : "Source: Public records & market estimates"}
              </p>
            </>
          ) : (
            <EmptyStateCard
              icon={attomInFlight ? Loader2 : BarChart3}
              iconClassName={attomInFlight ? "animate-spin" : undefined}
              title="Estimated value not available yet"
              description={
                attomInFlight
                  ? "We're looking up public records and market estimates."
                  : "We don't have an ATTOM AVM for this property yet. Ownership and tax records may still appear below."
              }
              actionLabel={
                attomInFlight
                  ? undefined
                  : canUnlockFinancials
                    ? "Add home value"
                    : homeValueAdjustmentUrl
                      ? "Request data adjustment"
                      : undefined
              }
              onAction={
                attomInFlight
                  ? undefined
                  : canUnlockFinancials
                    ? beginHomeValueEdit
                    : openHomeValueAdjustment
              }
            />
          )}
        </SectionCard>

        <SectionCard
          flat
          title="Monthly Housing Costs"
          icon={CreditCard}
          badge={monthly?.total != null ? <ProvenanceBadge source="estimated" /> : null}
        >
          {monthly?.total != null ? (
            <>
              <p className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white mb-1">
                {formatCurrency(monthly.total)}
                <span className="text-sm font-semibold text-neutral-400 ml-1">/mo</span>
              </p>
              <p className="text-xs text-neutral-500 mb-3">
                {monthly.isPartial
                  ? "Estimated known monthly costs. Add insurance and HOA for a complete estimate."
                  : "Estimated monthly total"}
              </p>
              <HousingCostsBar categories={costCategories} total={monthly.total} />
              <p className="text-[11px] text-neutral-400 mt-3">
                Source: Lender, tax, insurance & HOA
              </p>
            </>
          ) : (
            <EmptyStateCard
              icon={CreditCard}
              title="No monthly costs yet"
              description="Add mortgage, insurance, or HOA details to build an ownership-cost estimate."
              actionLabel="Complete mortgage details"
              onAction={() => setModal("mortgage")}
            />
          )}
        </SectionCard>

        <SectionCard
          flat
          title="Mortgage Summary"
          icon={Landmark}
          badge={mortgage.source ? <ProvenanceBadge source={mortgage.source} /> : null}
          action={
            <PublicRecordLock
              canUnlock={canUnlockFinancials}
              unlocked={unlocked.mortgage}
              onToggle={() => {
                if (unlocked.mortgage) {
                  setUnlocked((u) => ({...u, mortgage: false}));
                  setMortgageDraft(null);
                } else {
                  beginMortgageEdit();
                }
              }}
            />
          }
        >
          {unlocked.mortgage && mortgageDraft ? (
            <div>
              <AdminField label="Lender">
                <input
                  className="form-input w-full"
                  value={mortgageDraft.lender}
                  onChange={(e) => setMortgageDraft((d) => ({...d, lender: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Original amount">
                <input
                  className="form-input w-full"
                  value={mortgageDraft.originalAmount}
                  onChange={(e) => setMortgageDraft((d) => ({...d, originalAmount: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Recorded interest rate (%)">
                <input
                  type="number"
                  step="0.01"
                  className="form-input w-full"
                  value={mortgageDraft.interestRate}
                  onChange={(e) => setMortgageDraft((d) => ({...d, interestRate: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Term (months)">
                <input
                  type="number"
                  min={1}
                  max={720}
                  className="form-input w-full"
                  value={mortgageDraft.termMonths}
                  onChange={(e) => setMortgageDraft((d) => ({...d, termMonths: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Origination date">
                <input
                  type="date"
                  className="form-input w-full"
                  value={mortgageDraft.originationDate}
                  onChange={(e) => setMortgageDraft((d) => ({...d, originationDate: e.target.value}))}
                />
              </AdminField>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn border-gray-200"
                  onClick={() => {
                    setUnlocked((u) => ({...u, mortgage: false}));
                    setMortgageDraft(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary disabled:opacity-60"
                  disabled={saving}
                  onClick={saveMortgageAdmin}
                >
                  Save
                </button>
              </div>
            </div>
          ) : attomInFlight && !mortgage.hasRecordedMortgage && !remaining ? (
            <EmptyStateCard
              icon={Loader2}
              iconClassName="animate-spin"
              title="Looking up mortgage records"
              description="We're checking public records for an active mortgage."
            />
          ) : mortgage.hasRecordedMortgage || remaining ? (
            <>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                <DataRow label="Lender" value={mortgage.lender} empty={!mortgage.lender} loading={attomLoading} />
                <DataRow label="Loan type" value={mortgage.loanType} empty={!mortgage.loanType} loading={attomLoading} />
                <DataRow
                  label="Interest rate"
                  value={mortgage.interestRate?.value != null ? `${mortgage.interestRate.value}%` : null}
                  empty={mortgage.interestRate?.value == null}
                  loading={attomLoading}
                />
                <DataRow
                  label="Original amount"
                  value={formatCurrency(mortgage.originalAmount?.value)}
                  empty={mortgage.originalAmount?.value == null}
                  loading={attomLoading}
                />
                <DataRow
                  label={remaining?.source === "verified" ? "Current balance" : "Estimated balance"}
                  value={formatCurrency(remaining?.value)}
                  empty={remaining?.value == null}
                  loading={attomLoading}
                />
                <DataRow
                  label="Next payment due"
                  value={formatDate(mortgage.nextPaymentDue)}
                  empty={!mortgage.nextPaymentDue}
                  loading={attomLoading}
                />
              </div>
              <CardLink onClick={() => setModal("mortgage")}>
                {remaining?.source === "verified" ? "View mortgage details" : "Complete mortgage details"}
              </CardLink>
            </>
          ) : (
            <EmptyStateCard
              icon={Landmark}
              title="No mortgage on record"
              description="Public records don't show an active mortgage. If you have a loan, add the current details."
              actionLabel="Complete mortgage details"
              onAction={() => setModal("mortgage")}
            />
          )}
        </SectionCard>

        <SectionCard
          flat
          title="Ownership & Financing"
          icon={Home}
          badge={<ProvenanceBadge source="public_record" />}
          action={
            <PublicRecordLock
              canUnlock={canUnlockFinancials}
              unlocked={unlocked.ownership}
              onToggle={() => {
                if (unlocked.ownership) {
                  setUnlocked((u) => ({...u, ownership: false}));
                  setOwnershipDraft(null);
                } else {
                  beginOwnershipEdit();
                }
              }}
            />
          }
        >
          {unlocked.ownership && ownershipDraft ? (
            <div>
              <AdminField label="Owner occupied">
                <select
                  className="form-input w-full"
                  value={ownershipDraft.ownerOccupied}
                  onChange={(e) => setOwnershipDraft((d) => ({...d, ownerOccupied: e.target.value}))}
                >
                  <option value="">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </AdminField>
              <AdminField label="Occupancy">
                <input
                  className="form-input w-full"
                  value={ownershipDraft.occupancy}
                  onChange={(e) => setOwnershipDraft((d) => ({...d, occupancy: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Last recorded sale date">
                <input
                  type="date"
                  className="form-input w-full"
                  value={ownershipDraft.lastSaleDate}
                  onChange={(e) => setOwnershipDraft((d) => ({...d, lastSaleDate: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Last recorded sale">
                <input
                  className="form-input w-full"
                  value={ownershipDraft.lastSalePrice}
                  onChange={(e) => setOwnershipDraft((d) => ({...d, lastSalePrice: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Annual tax">
                <input
                  className="form-input w-full"
                  value={ownershipDraft.annualTaxAmount}
                  onChange={(e) => setOwnershipDraft((d) => ({...d, annualTaxAmount: e.target.value}))}
                />
              </AdminField>
              <AdminField label="Tax year">
                <input
                  type="number"
                  className="form-input w-full"
                  value={ownershipDraft.taxYear}
                  onChange={(e) => setOwnershipDraft((d) => ({...d, taxYear: e.target.value}))}
                />
              </AdminField>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn border-gray-200"
                  onClick={() => {
                    setUnlocked((u) => ({...u, ownership: false}));
                    setOwnershipDraft(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary disabled:opacity-60"
                  disabled={saving}
                  onClick={saveOwnershipAdmin}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            <DataRow
              label="Owner occupied"
              value={ownership.ownerOccupied == null ? null : ownership.ownerOccupied ? "Yes" : "No"}
              empty={ownership.ownerOccupied == null}
              loading={attomLoading}
            />
            <DataRow label="Occupancy" value={ownership.occupancy} empty={!ownership.occupancy} loading={attomLoading} />
            <DataRow
              label="Purchase date"
              value={formatDate(ownership.purchaseDate, {month: "short", year: "numeric"})}
              empty={!ownership.purchaseDate}
              loading={attomLoading}
            />
            <DataRow
              label="Last recorded sale"
              value={formatCurrency(ownership.purchasePrice?.value)}
              empty={ownership.purchasePrice?.value == null}
              note={saleNote}
              loading={attomLoading}
            />
            <DataRow
              label="LTV"
              value={formatPercent(ownership.ltv?.percent, 1)}
              empty={ownership.ltv?.percent == null}
              loading={attomLoading}
            />
            <DataRow label="Vesting" value={ownership.vesting} empty={!ownership.vesting} loading={attomLoading} />
            <DataRow
              label="Annual tax"
              value={formatCurrency(data?.tax?.annualAmount?.value)}
              empty={data?.tax?.annualAmount?.value == null}
              loading={attomLoading}
            />
            <DataRow
              label="Tax year"
              value={data?.tax?.year}
              empty={data?.tax?.year == null}
              loading={attomLoading}
            />
          </div>
          )}
          {!unlocked.ownership && <CardLink onClick={() => setModal("ownership")}>View details</CardLink>}
        </SectionCard>

        <SectionCard
          flat
          title="Upcoming Obligations"
          icon={Calendar}
        >
          {upcoming.length === 0 ? (
            <EmptyStateCard
              icon={Calendar}
              title="No upcoming obligations yet"
              description="We'll list mortgage, tax, insurance, and HOA items when dates or amounts are known."
            />
          ) : (
            <>
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {item.missing
                          ? "Not added"
                          : item.date
                            ? formatDate(item.date)
                            : item.cadence === "annual"
                              ? item.year
                                ? `Annual · ${item.year}`
                                : "Annual"
                              : "Date not on file"}
                      </p>
                    </div>
                    {item.missing ? (
                      <GhostAdd onClick={() => setModal(item.id === "hoa" ? "hoa" : "insurance")}>
                        Add
                      </GhostAdd>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <CardLink onClick={() => setModal("schedule")}>View full schedule</CardLink>
            </>
          )}
        </SectionCard>

        <SectionCard
          flat
          title="Insights"
          icon={Lightbulb}
          badge={<StatusBadge tone="neutral">Generated</StatusBadge>}
        >
          {dashboardInsights.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Insights appear as we gather value, equity, and ownership-cost data.
            </p>
          ) : (
            <ul className="space-y-3">
              {dashboardInsights.map((insight) => (
                <li key={insight.id} className="flex gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                  {insight.kind === "flag" ? (
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-[#456564] shrink-0 mt-0.5" />
                  )}
                  {insight.text}
                </li>
              ))}
            </ul>
          )}
          {(data?.insights || []).length > 3 && (
            <button
              type="button"
              onClick={() => setModal("insights")}
              className="mt-3 text-sm font-medium text-[#456564] hover:underline"
            >
              See all insights
            </button>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SectionCard flat title="Complete your financial profile" icon={TrendingUp}>
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {data?.profile?.percent ?? 0}%
            <span className="text-sm font-medium text-neutral-400 ml-1">complete</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {(data?.profile?.items || []).map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${item.complete ? "bg-emerald-500" : "bg-neutral-300"}`}
                />
                <span className={item.complete ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <CardLink
            onClick={() => {
              const next = (data?.profile?.items || []).find((i) => !i.complete);
              if (next?.id === "insurance") setModal("insurance");
              else if (next?.id === "hoa") setModal("hoa");
              else setModal("mortgage");
            }}
          >
            Update financial profile
          </CardLink>
        </SectionCard>

        <SectionCard flat title="Value & equity trend" icon={BarChart3}>
          {trendChart ? (
            <div className="h-44">
              <Line
                data={trendChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {legend: {display: false}},
                  scales: {
                    x: {grid: {display: false}, ticks: {font: {size: 10}, color: "#9ca3af"}},
                    y: {
                      grid: {color: "rgba(0,0,0,0.04)"},
                      ticks: {
                        font: {size: 10},
                        color: "#9ca3af",
                        callback: (v) => formatShortCurrency(v),
                      },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <EmptyStateCard
              icon={BarChart3}
              title="Not enough history yet"
              description="We'll chart estimated value and equity after additional public-records updates."
            />
          )}
        </SectionCard>

        <SectionCard flat title="Refinance opportunity" icon={TrendingUp}>
          <EmptyStateCard
            icon={TrendingUp}
            title="Coming soon"
            description="Refinance scenarios will appear here once we connect current rate data. This is not a loan offer or qualification."
          />
        </SectionCard>

        <SectionCard
          flat
          title="Financial documents"
          icon={FileText}
          action={
            <button
              type="button"
              onClick={() => openUpload("choose")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#456564]"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload document
            </button>
          }
        >
          {financialDocs.length === 0 ? (
            <EmptyStateCard
              icon={FileText}
              title="No financial documents yet"
              description="Mortgage statements, tax bills, insurance declarations, and HOA statements will appear here."
              actionLabel="Go to Documents"
              onAction={() => onNavigateTab?.("documents")}
            />
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {financialDocs.slice(0, 5).map((doc) => (
                <li key={doc.id} className="py-2 flex justify-between gap-2 text-sm">
                  <span className="truncate">{doc.name}</span>
                  <span className="text-xs text-neutral-400 shrink-0 capitalize">{doc.type}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard flat title="Data sources & accuracy" icon={Info} className="md:col-span-2 xl:col-span-2">
          <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1.5 leading-relaxed">
            <li>Public record values come from ATTOM assessor and recorder data.</li>
            <li>Estimated home value is an ATTOM AVM, not the assessed tax value.</li>
            <li>Estimated mortgage balance is amortized from the original recorded loan unless you verify it.</li>
            <li>We never invent payment due dates from public records.</li>
            <li>Equity % and loan-to-value (LTV) are different metrics.</li>
          </ul>
        </SectionCard>
      </div>

      <AddInsuranceModal
        isOpen={modal === "insurance"}
        onClose={() => setModal(null)}
        initial={data?.insurance || {}}
        saving={saving}
        onSave={(payload) =>
          patch(() => AppApi.patchPropertyFinancialsInsurance(resolvedId, payload))
        }
        onUploadInstead={() => openUpload("insurance")}
      />
      <AddHoaModal
        isOpen={modal === "hoa"}
        onClose={() => setModal(null)}
        initial={data?.hoa || {}}
        saving={saving}
        onSave={(payload) => patch(() => AppApi.patchPropertyFinancialsHoa(resolvedId, payload))}
        onMarkNone={() =>
          patch(() => AppApi.patchPropertyFinancialsHoa(resolvedId, {notApplicable: true}))
        }
        onUploadInstead={() => openUpload("hoa")}
      />
      <MortgageDetailsModal
        isOpen={modal === "mortgage"}
        onClose={() => setModal(null)}
        mortgage={mortgage}
        saving={saving}
        onSave={(payload) =>
          patch(() => AppApi.patchPropertyFinancialsMortgage(resolvedId, payload))
        }
        onUploadInstead={() => openUpload("mortgage")}
      />
      <DetailModal open={modal === "ownership"} onClose={() => setModal(null)} title="Ownership details">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          <DataRow label="Owner occupied" value={ownership.ownerOccupied ? "Yes" : ownership.ownerOccupied === false ? "No" : null} empty={ownership.ownerOccupied == null} />
          <DataRow label="Occupancy" value={ownership.occupancy} empty={!ownership.occupancy} />
          <DataRow label="Vesting" value={ownership.vesting} empty={!ownership.vesting} />
          <DataRow label="Purchase date" value={formatDate(ownership.purchaseDate)} empty={!ownership.purchaseDate} />
          <DataRow
            label="Last recorded sale"
            value={formatCurrency(ownership.purchasePrice?.value)}
            empty={!ownership.purchasePrice}
            note={saleNote}
          />
          <DataRow
            label="Assessed value"
            value={formatCurrency(data?.assessedValue?.value)}
            empty={!data?.assessedValue}
          />
          <DataRow
            label="Assessor market value"
            value={formatCurrency(data?.assessorMarketValue?.value)}
            empty={!data?.assessorMarketValue}
          />
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          Assessed and assessor market values are public record and are not used as estimated home value.
        </p>
      </DetailModal>
      <DetailModal open={modal === "schedule"} onClose={() => setModal(null)} title="Full schedule">
        {(data?.obligations || []).length === 0 ? (
          <p className="text-sm text-neutral-500">No known obligations yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {(data.obligations || []).map((item) => (
              <li key={item.id} className="py-2 flex justify-between gap-3 text-sm">
                <span>
                  {item.label}
                  <span className="block text-xs text-neutral-400">
                    {item.date ? formatDate(item.date) : item.cadence || "Date not on file"}
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {item.amount != null ? formatCurrency(item.amount) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailModal>
      <DetailModal open={modal === "insights"} onClose={() => setModal(null)} title="All insights">
        <ul className="space-y-3">
          {(data?.insights || []).map((insight) => (
            <li key={insight.id} className="text-sm text-neutral-700 dark:text-neutral-200">
              {insight.text}
            </li>
          ))}
        </ul>
      </DetailModal>

      <UploadDocumentModal
        isOpen={Boolean(uploadType)}
        onClose={() => setUploadType(null)}
        propertyId={resolvedId}
        financialUpload
        presetFilingType={uploadType === "choose" ? null : uploadType}
        onSuccess={() => {
          setUploadType(null);
          void load();
        }}
      />
    </div>
  );
}

export default FinancialsTab;
