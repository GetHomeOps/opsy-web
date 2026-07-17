import React from "react";
import {Home} from "lucide-react";
import SectionCard from "../../properties/partials/passport/SectionCard";
import {IDENTITY_PROFILE_FIELD_GROUPS} from "../prePurchaseUtils";

/**
 * Read-only property profile built from ATTOM/RentCast identity data captured
 * during setup. Excludes ownership fields. Prefer IdentityTab on analysis pages.
 */
export default function PropertyProfileCard({analysis, className = ""}) {
  const identity = analysis?.identityData || null;
  const source = analysis?.identityDataSource;
  const sourceLabel =
    source === "rentcast" ? "RentCast" : source === "attom" ? "ATTOM" : null;

  const groupsWithData = identity
    ? IDENTITY_PROFILE_FIELD_GROUPS.map((group) => ({
        label: group.label,
        fields: group.fields.filter(
          (f) =>
            identity[f.key] != null && String(identity[f.key]).trim() !== ""
        ),
      })).filter((group) => group.fields.length > 0)
    : [];

  const hasData = groupsWithData.length > 0;

  return (
    <SectionCard
      title="Property Profile"
      icon={Home}
      description="Identity details pulled from public records"
      badge={
        sourceLabel && hasData ? (
          <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
            Source: {sourceLabel}
          </span>
        ) : null
      }
      className={className}
    >
      {!hasData ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No public-records data was found for this address. You can still upload
          documents below to run the analysis.
        </p>
      ) : (
        <div className="space-y-5">
          {groupsWithData.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                {group.label}
              </h4>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                {group.fields.map((f) => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-0.5">
                      {f.label}
                    </dt>
                    <dd className="text-sm text-neutral-800 dark:text-neutral-200 truncate">
                      {String(identity[f.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
