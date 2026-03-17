import React from "react";
import { User, Mail, CreditCard, Building2, Clock } from "lucide-react";

const SLA_BY_TIER = {
  premium: 4,
  win: 4,
  pro: 8,
  maintain: 8,
  agent: 24,
  basic: 24,
  free: 48,
};

const TIER_COLORS = {
  premium: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  win: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  pro: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  maintain: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  agent: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
  basic: "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400",
  free: "bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400",
};

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
          {children}
        </div>
      </div>
    </div>
  );
}

function CustomerInfoCard({ ticket }) {
  const tier = (ticket?.subscriptionTier || "free").toLowerCase();
  const slaHours = SLA_BY_TIER[tier] ?? 48;
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.free;
  const initials = (ticket?.createdByName || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center text-sm font-semibold text-[#456564] dark:text-[#7a9e9c]">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {ticket?.createdByName || "Unknown"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {ticket?.createdByEmail || "—"}
          </div>
        </div>
      </div>

      <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700/50">
        <InfoRow icon={Mail} label="Email">
          {ticket?.createdByEmail || "—"}
        </InfoRow>
        <InfoRow icon={CreditCard} label="Plan">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${tierColor}`}
          >
            {ticket?.subscriptionTier || "Free"}
          </span>
        </InfoRow>
        <InfoRow icon={Building2} label="Account ID">
          {ticket?.accountId ?? "—"}
        </InfoRow>
        <InfoRow icon={Clock} label="SLA">
          {slaHours}h response time
        </InfoRow>
      </div>
    </div>
  );
}

export default CustomerInfoCard;
