import React, {useCallback, useEffect, useState} from "react";
import {Home, PiggyBank, CreditCard, ChevronRight} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import ProvenanceBadge from "./ProvenanceBadge";
import AttomSyncBanner from "./AttomSyncBanner";
import AppApi from "../../../../api/api";
import {formatCurrency, formatPercent} from "./financialsFormat";

function Kpi({icon: Icon, label, value, hint, source, loading}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-neutral-400" />
        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.06em] truncate">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-6 w-24 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
      ) : (
        <p className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
          {value ?? "Not available"}
        </p>
      )}
      {hint && <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>}
      {source && <div className="mt-1"><ProvenanceBadge source={source} /></div>}
    </div>
  );
}

function OverviewFinancialsPreview({propertyId, attomRefresh, onNavigateTab}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(propertyId));

  const load = useCallback(async () => {
    if (!propertyId) {
      setLoading(false);
      return;
    }
    try {
      const financials = await AppApi.getPropertyFinancials(propertyId);
      setData(financials);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      setData(null);
      return undefined;
    }
    setLoading(true);
    void load();
    return undefined;
  }, [propertyId, load]);

  const attomInFlight =
    data?.attomStatus === "loading" || Boolean(attomRefresh?.isActive);
  const attomLoading = loading || attomInFlight;

  useEffect(() => {
    const inFlight =
      data?.attomStatus === "loading" || Boolean(attomRefresh?.isActive);
    if (!propertyId || !inFlight) return undefined;
    const t = setInterval(() => {
      void load();
    }, 4000);
    return () => clearInterval(t);
  }, [propertyId, data?.attomStatus, attomRefresh?.isActive, load]);

  useEffect(() => {
    if (attomRefresh?.jobStatus === "completed") void load();
  }, [attomRefresh?.jobStatus, load]);

  const remainingLabel = formatCurrency(data?.remainingMortgage?.value)
    ?? (data?.mortgage?.hasRecordedMortgage
      ? "Not available"
      : attomLoading
        ? null
        : data
          ? "No mortgage on record"
          : null);

  return (
    <SectionCard
      flat
      title="Financials"
      description="Value, equity, and remaining mortgage for this property"
      action={
        onNavigateTab ? (
          <button
            type="button"
            onClick={() => onNavigateTab("financials")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#456564]"
          >
            View Financials
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : null
      }
    >
      {attomInFlight && <AttomSyncBanner compact className="mb-3" />}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi
          icon={Home}
          label="Estimated Home Value"
          value={formatCurrency(data?.homeValue?.value)}
          source={data?.homeValue?.source}
          loading={attomLoading && !data?.homeValue}
        />
        <Kpi
          icon={PiggyBank}
          label="Estimated Equity"
          value={formatCurrency(data?.equity?.amount)}
          hint={
            data?.equity?.percent != null
              ? `${formatPercent(data.equity.percent, 0)} of value`
              : null
          }
          source={data?.equity?.source}
          loading={attomLoading && !data?.equity}
        />
        <Kpi
          icon={CreditCard}
          label="Remaining Mortgage"
          value={remainingLabel}
          source={data?.remainingMortgage?.source}
          loading={attomLoading && !data?.remainingMortgage}
        />
      </div>
    </SectionCard>
  );
}

export default OverviewFinancialsPreview;
