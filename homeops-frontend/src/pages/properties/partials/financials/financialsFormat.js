export function formatCurrency(value, { compact = false } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (compact) {
    if (Math.abs(n) >= 1_000_000) {
      return `$${(n / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
    }
    if (Math.abs(n) >= 10_000) {
      return `$${Math.round(n / 1000)}K`;
    }
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatShortCurrency(value) {
  return formatCurrency(value, { compact: true }) ?? "";
}

export function formatPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return `${Number(value).toFixed(digits)}%`;
}

export function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return null;
  const raw = String(value);
  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", options);
}

export function formatMonthYear(value) {
  return formatDate(value, { month: "short", year: "numeric" });
}

export function sourceLabel(source) {
  switch (source) {
    case "public_record":
      return "Public record";
    case "estimated":
      return "Estimated";
    case "calculated":
      return "Calculated";
    case "verified":
      return "Verified";
    default:
      return null;
  }
}

export function fieldValue(field) {
  if (field == null) return null;
  if (typeof field === "object" && "value" in field) return field.value;
  return field;
}
