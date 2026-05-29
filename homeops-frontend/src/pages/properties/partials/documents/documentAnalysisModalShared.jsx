import React from "react";
import { ClipboardList, FileSearch, FileText, ScanText, ShieldCheck } from "lucide-react";
import opsyFavicon from "../../../../images/opsy_favicon.png";
import opsyWritingIcon from "../../../../images/opsy_writing.webp";

/** Fixed shell so prompt, results, and insights modals stay the same size. */
export const DOCUMENT_ANALYSIS_MODAL_SHELL =
  "w-full max-w-2xl h-[min(640px,85vh)] overflow-hidden flex flex-col";

export const DOCUMENT_ANALYSIS_MODAL_INNER = "flex flex-col h-full min-h-0";

export const DOCUMENT_ANALYSIS_MODAL_BODY =
  "flex-1 min-h-0 overflow-y-auto px-5 py-4";

export const DOCUMENT_ANALYSIS_PROMPT_MODAL_SHELL =
  "w-full max-w-lg overflow-hidden flex flex-col";

export function OpsyModalIcon({size = 40, className = ""}) {
  return (
    <img
      src={opsyFavicon}
      alt=""
      aria-hidden
      className={`rounded-lg object-contain shrink-0 ${className}`}
      style={{width: size, height: size}}
    />
  );
}

const FIELD_KEY_LABELS = {
  totalPrice: "Total price",
  lineItems: "Line items",
  termsAndConditions: "Terms & conditions",
  validUntil: "Valid until",
  installDate: "Install date",
  reportDate: "Report date",
  nextServiceDate: "Next service date",
  maintenanceScheduleRecommendation: "Maintenance schedule",
  suggestedNextDates: "Suggested next dates",
  keyDates: "Key dates",
  cost: "Cost",
  totalCost: "Total cost",
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONEY_FIELD_KEYS = new Set([
  "cost",
  "totalCost",
  "totalPrice",
  "price",
  "amount",
  "unitPrice",
]);

export function isMoneyField(fieldKey, label) {
  if (MONEY_FIELD_KEYS.has(fieldKey)) return true;
  if (label && /\b(total\s*)?(cost|price|amount)\b/i.test(label)) return true;
  return false;
}

function parseMoneyAmount(val) {
  if (val == null || val === "") return null;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const text = String(val).trim();
  if (!text) return null;
  const cleaned = text.replace(/^\$/, "").replace(/,/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

export function formatCurrencyValue(val) {
  if (val == null || val === "") return "—";
  const amount = parseMoneyAmount(val);
  if (amount != null) return CURRENCY_FORMATTER.format(amount);
  const text = String(val).trim();
  if (/^\$[\d,]+(?:\.\d{2})?$/.test(text)) return text;
  return text || "—";
}

/** Turn camelCase field keys into readable labels. */
export function formatFieldLabel(fieldKey, label) {
  if (label && label !== fieldKey) return label;
  if (FIELD_KEY_LABELS[fieldKey]) return FIELD_KEY_LABELS[fieldKey];
  if (!fieldKey) return "Field";
  return fieldKey
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

const MAX_COMPACT_TEXT_LENGTH = 280;

/** Remove JS serialization artifacts and collapse repeated segments in long note strings. */
function sanitizeAnalysisText(text) {
  if (typeof text !== "string") return text;
  let cleaned = text
    .replace(/\s*\[object Object\]\s*(?:,\s*\[object Object\])*\s*/gi, " ")
    .replace(/;\s*;+/g, "; ")
    .replace(/\.\s*\.+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return cleaned;

  const splitPattern = /;\s+|\n+/;
  if (splitPattern.test(cleaned)) {
    const segments = cleaned
      .split(splitPattern)
      .map((part) => part.trim().replace(/[.;,\s]+$/, ""))
      .filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const segment of segments) {
      const key = segment.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(segment);
    }
    if (unique.length < segments.length) {
      cleaned = unique.join("; ");
    }
  }

  return cleaned;
}

function truncateForDisplay(text, maxLength = MAX_COMPACT_TEXT_LENGTH) {
  if (typeof text !== "string" || text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.trim()}…`;
}

function formatObjectValue(obj) {
  if (obj == null) return "";
  if (typeof obj !== "object") return String(obj);

  const scalar =
    obj.text ?? obj.label ?? obj.description ?? obj.name ?? obj.item ?? obj.service ?? obj.title;
  if (typeof scalar === "string" && scalar.trim()) return scalar.trim();
  if (typeof scalar === "number") return String(scalar);

  const nestedValue = obj.value;
  if (typeof nestedValue === "string" && nestedValue.trim()) return nestedValue.trim();
  if (typeof nestedValue === "number") return String(nestedValue);

  const parts = [];
  const desc = obj.description || obj.name || obj.item || obj.service || obj.title;
  if (desc) parts.push(String(desc));

  const qty = obj.quantity ?? obj.qty;
  if (qty != null) parts.push(`Qty: ${qty}`);

  const price = obj.price ?? obj.unitPrice ?? obj.amount ?? obj.total ?? obj.cost;
  if (price != null) {
    parts.push(formatCurrencyValue(price));
  }

  if (parts.length) return parts.join(" · ");

  const entries = Object.entries(obj).filter(
    ([, v]) => v != null && v !== "" && typeof v !== "object",
  );
  if (entries.length > 0 && entries.length <= 5) {
    return entries
      .map(([k, v]) => `${formatFieldLabel(k)}: ${v}`)
      .join(", ");
  }

  return JSON.stringify(obj);
}

const LINE_ITEM_QTY_PATTERN = /^Qty:\s*(.+)$/i;

function formatLineItemPrice(price) {
  if (price == null || price === "") return null;
  const formatted = formatCurrencyValue(price);
  return formatted === "—" ? null : formatted;
}

function parseLineItemObject(obj) {
  const description =
    obj.description ||
    obj.name ||
    obj.item ||
    obj.service ||
    obj.text ||
    obj.label ||
    obj.title ||
    "";
  const qty = obj.quantity ?? obj.qty ?? null;
  const price = formatLineItemPrice(
    obj.price ?? obj.unitPrice ?? obj.amount ?? obj.total ?? obj.cost,
  );

  return {
    description: description ? String(description).trim() : formatObjectValue(obj),
    qty: qty != null && qty !== "" ? String(qty) : null,
    price,
  };
}

function parseLineItemSegment(segment) {
  const text = String(segment || "").trim().replace(/^•\s*/, "");
  if (!text) return null;

  const parts = text.split(/\s·\s/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return { description: text, qty: null, price: null };
  }

  let description = "";
  let qty = null;
  let price = null;

  for (const part of parts) {
    const qtyMatch = part.match(LINE_ITEM_QTY_PATTERN);
    if (qtyMatch) {
      qty = qtyMatch[1].trim();
      continue;
    }
    const maybePrice = formatLineItemPrice(part);
    if (
      maybePrice &&
      (/^\$/.test(maybePrice) || /^[\d,]+(?:\.\d{2})?$/.test(part))
    ) {
      price = maybePrice;
      continue;
    }
    description = description ? `${description} · ${part}` : part;
  }

  return {
    description: description || text,
    qty,
    price,
  };
}

/** Normalize line items from arrays, objects, or serialized storage strings. */
export function normalizeLineItems(val) {
  if (val == null || val === "") return [];

  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (item == null) return null;
        if (typeof item === "string") return parseLineItemSegment(item);
        if (typeof item === "object") return parseLineItemObject(item);
        return parseLineItemSegment(String(item));
      })
      .filter((row) => row?.description);
  }

  if (typeof val === "object") {
    const row = parseLineItemObject(val);
    return row.description ? [row] : [];
  }

  const text = sanitizeAnalysisText(String(val));
  if (!text || text === "—") return [];

  const segments = text.includes(";")
    ? text.split(/;\s+/)
    : text.includes("\n")
      ? text.split(/\n+/)
      : [text];

  return segments
    .map((segment) => parseLineItemSegment(segment))
    .filter((row) => row?.description);
}

export function isLineItemsField(fieldKey) {
  return fieldKey === "lineItems";
}

export function LineItemsList({ items, className = "" }) {
  const rows = normalizeLineItems(items);
  if (!rows.length) return <span>—</span>;

  return (
    <div
      className={`mt-1 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      <table className="w-full text-left text-[11px]">
        <thead className="bg-gray-50 dark:bg-gray-800/60 text-[10px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-2.5 py-1.5 font-medium">Item</th>
            <th className="px-2 py-1.5 font-medium w-14 text-right">Qty</th>
            <th className="px-2 py-1.5 font-medium w-20 text-right">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-600 dark:text-gray-400">
          {rows.map((row, index) => (
            <tr key={`${row.description}-${index}`}>
              <td className="px-2.5 py-1.5 align-top leading-snug">{row.description}</td>
              <td className="px-2 py-1.5 text-right align-top tabular-nums">
                {row.qty ?? "—"}
              </td>
              <td className="px-2 py-1.5 text-right align-top tabular-nums whitespace-nowrap">
                {row.price ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function formatAnalysisValue(val, { compact = false, fieldKey, label } = {}) {
  if (val == null || val === "") return "—";

  if (
    isMoneyField(fieldKey, label) &&
    (typeof val === "number" || typeof val === "string")
  ) {
    const formatted = formatCurrencyValue(val);
    return compact ? truncateForDisplay(formatted) : formatted;
  }

  let result;
  if (Array.isArray(val)) {
    const formatted = val
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string") return sanitizeAnalysisText(item);
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        if (typeof item === "object") return formatObjectValue(item);
        return String(item);
      })
      .filter(Boolean);
    if (formatted.length === 0) return "—";
    if (formatted.length === 1) result = formatted[0];
    else result = formatted.map((line) => `• ${line}`).join("\n");
  } else if (typeof val === "object") {
    result = formatObjectValue(val);
  } else {
    result = sanitizeAnalysisText(String(val));
  }
  if (compact) return truncateForDisplay(result);
  return result;
}

const SYSTEM_DATA_KEY_LABELS = {
  notes: "Notes",
  issues: "Issues",
  material: "Material",
  warranty: "Warranty",
  condition: "Condition",
  install_date: "Install date",
  last_inspection: "Last inspection",
  next_service_date: "Next service date",
};

export function formatSystemDataKeyLabel(systemDataKey) {
  if (!systemDataKey || systemDataKey.startsWith("__")) return "Current value";
  return SYSTEM_DATA_KEY_LABELS[systemDataKey] || formatFieldLabel(systemDataKey);
}

/** Group review fields that share the same stored system value (e.g. many fields → notes). */
export function groupSharedCurrentValues(reviewFields = []) {
  const groups = new Map();
  for (const field of reviewFields) {
    const raw = field.currentValue;
    if (raw == null || raw === "") continue;
    const formatted = formatAnalysisValue(raw, { compact: true });
    if (!formatted || formatted === "—") continue;
    const groupKey = `${field.systemDataKey ?? "value"}::${formatted}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        systemDataKey: field.systemDataKey,
        formattedValue: formatted,
        fullValue: formatAnalysisValue(raw),
        fieldKeys: [],
      });
    }
    groups.get(groupKey).fieldKeys.push(field.fieldKey);
  }
  return [...groups.values()].filter((group) => group.fieldKeys.length > 0);
}

const DOCUMENT_INSIGHTS_EMPTY_FEATURES = [
  {
    icon: ScanText,
    title: "Automatic extraction",
    desc: "Opsy reads your documents and pulls out dates, specs, and findings.",
  },
  {
    icon: FileText,
    title: "Organized by system",
    desc: "Insights are grouped by category so you can scan what matters fast.",
  },
  {
    icon: ShieldCheck,
    title: "Review before applying",
    desc: "You choose which extracted details get added to your property.",
  },
];

export function DocumentAnalysisEmptyState({
  title = "No AI document insights yet",
  description = "Upload a document using the Upload button and Opsy will extract key details for this system.",
  systemLabel,
}) {
  return (
    <div className="flex flex-col items-center py-6 sm:py-8">
      <img
        src={opsyWritingIcon}
        alt="Opsy"
        className="w-28 h-28 object-contain mb-5 drop-shadow-sm"
      />

      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5 text-center">
        {title}
        {systemLabel ? (
          <>
            {" "}
            for{" "}
            <span className="text-[#456564] dark:text-[#5a7a78]">{systemLabel}</span>
          </>
        ) : null}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm leading-relaxed mb-6">
        {description}
      </p>

      <div className="w-full max-w-md space-y-2.5">
        {DOCUMENT_INSIGHTS_EMPTY_FEATURES.map(({ icon: Icon, title: featureTitle, desc }) => (
          <div
            key={featureTitle}
            className="flex gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40"
          >
            <div className="shrink-0 w-9 h-9 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
              <Icon className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-0.5">
                {featureTitle}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const INSPECTION_OPSYMIZATION_HINTS = [
  { icon: FileSearch, text: "Property condition and per-system ratings" },
  { icon: ClipboardList, text: "Findings, evidence, and maintenance suggestions" },
  { icon: ShieldCheck, text: "Same Passport Opsymization flow — you review before applying" },
];

export function InspectionOpsymizationPromptContent({
  documentName,
  hints = INSPECTION_OPSYMIZATION_HINTS,
}) {
  const docName = documentName || "this document";

  return (
    <div className="flex flex-col items-center py-5 sm:py-6">
      <img
        src={opsyWritingIcon}
        alt="Opsy"
        className="w-24 h-24 object-contain mb-4 drop-shadow-sm"
      />

      <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm leading-relaxed mb-5">
        This looks like an inspection report. Run Opsymization on{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{docName}</span>{" "}
        to extract condition, system findings, and maintenance recommendations.
      </p>

      <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          What Opsymization extracts
        </p>
        <ul className="space-y-2.5">
          {hints.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-md bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center mt-0.5">
                <Icon className="w-3.5 h-3.5 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pt-1">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DocumentAnalysisPromptContent({
  documentName,
  systemLabel,
  hints = [
    { icon: ScanText, text: "Dates, specs, pricing, and findings" },
    { icon: FileText, text: "Details organized for your property system" },
    { icon: ShieldCheck, text: "Nothing is applied until you review it" },
  ],
}) {
  const docName = documentName || "this document";

  return (
    <div className="flex flex-col items-center py-5 sm:py-6">
      <img
        src={opsyWritingIcon}
        alt="Opsy"
        className="w-24 h-24 object-contain mb-4 drop-shadow-sm"
      />

      <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm leading-relaxed mb-5">
        Would you like Opsy to analyze{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{docName}</span>
        {systemLabel ? (
          <>
            {" "}
            and extract key details for{" "}
            <span className="font-semibold text-[#456564] dark:text-[#5a7a78]">
              {systemLabel}
            </span>
          </>
        ) : (
          " and extract key details"
        )}
        ?
      </p>

      <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          What Opsy extracts
        </p>
        <ul className="space-y-2.5">
          {hints.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-md bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center mt-0.5">
                <Icon className="w-3.5 h-3.5 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pt-1">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function formatAnalysisDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
