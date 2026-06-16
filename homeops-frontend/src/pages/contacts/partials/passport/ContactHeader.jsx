import React from "react";
import {
  Mail,
  Phone,
  Building2,
  Briefcase,
  Home,
  FileText,
  User as UserIcon,
} from "lucide-react";

const PASSPORT_CARD_SHADOW =
  "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";

const STAT_ICONS = {
  properties: Home,
  documents: FileText,
};

function StatCell({icon: Icon, label, value, hasDivider}) {
  const display = value != null && value !== "" ? String(value) : "0";
  return (
    <div
      className={`relative flex items-center justify-center gap-2.5 px-3 py-3.5 min-w-0 ${
        hasDivider
          ? "before:absolute before:left-0 before:top-1/2 before:h-10 before:w-px before:-translate-y-1/2 before:bg-neutral-200/90 dark:before:bg-neutral-700/70"
          : ""
      }`}
    >
      {Icon && (
        <Icon className="w-[18px] h-[18px] text-neutral-400 dark:text-neutral-500 shrink-0" />
      )}
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] font-bold text-neutral-900 dark:text-white leading-none truncate tabular-nums">
          {display}
        </span>
        <span
          className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight truncate"
          title={label}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function MetaRow({icon: Icon, children}) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-2 min-w-0 text-sm text-neutral-600 dark:text-neutral-400">
      <Icon className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

/**
 * Hero summary card for the Contact Passport. Presentational only — all data
 * and handlers are passed in from ContactFormContainer.
 */
function ContactHeader({
  name,
  email,
  phone,
  company,
  jobTitle,
  typeLabel,
  statusLabel = "Active",
  stats = {},
  imageSlot,
  imageUrl,
  isEditing = false,
  isNew = false,
  headerRef,
}) {
  const initials = (name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const statItems = [
    {id: "properties", label: "Properties", value: stats.properties ?? 0},
    {id: "documents", label: "Records", value: stats.documents ?? 0},
  ];

  return (
    <section
      ref={headerRef}
      className="rounded-2xl overflow-hidden border border-neutral-200/80 bg-white dark:border-neutral-700/50 dark:bg-neutral-900"
      style={{boxShadow: PASSPORT_CARD_SHADOW}}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-5 p-4 md:p-6">
        {/* Avatar */}
        <div className="shrink-0">
          {isEditing ? (
            imageSlot
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-[120px] h-[120px] rounded-2xl object-cover border border-neutral-200/80 dark:border-neutral-700/50"
            />
          ) : (
            <div className="w-[120px] h-[120px] rounded-2xl bg-[#456564] dark:bg-[#5a7a78] flex items-center justify-center text-white text-3xl font-semibold">
              {initials || <UserIcon className="w-12 h-12" />}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-[32px] font-semibold text-neutral-900 dark:text-white tracking-tight leading-tight truncate">
                {name || (isNew ? "New Contact" : "Unnamed Contact")}
              </h1>
              <div className="mt-2 space-y-1.5">
                <MetaRow icon={Mail}>{email}</MetaRow>
                <MetaRow icon={Phone}>{phone}</MetaRow>
                <MetaRow icon={Building2}>{company}</MetaRow>
                <MetaRow icon={Briefcase}>{jobTitle}</MetaRow>
              </div>
            </div>

            {/* Right: badges */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              {typeLabel && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#456564]/10 text-[#456564] border border-[#456564]/20 dark:bg-[#5a7a78]/20 dark:text-[#7fa3a1] dark:border-[#5a7a78]/30 whitespace-nowrap">
                  {typeLabel}
                </span>
              )}
              {statusLabel && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-400/30 dark:text-emerald-300 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {statusLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="border-t border-neutral-200/90 dark:border-neutral-700/60">
        <div className="grid grid-cols-2">
          {statItems.map((item, index) => (
            <StatCell
              key={item.id}
              icon={STAT_ICONS[item.id]}
              label={item.label}
              value={item.value}
              hasDivider={index > 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ContactHeader;
