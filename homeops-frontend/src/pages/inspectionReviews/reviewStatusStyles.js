export const REVIEW_STATUS_STYLES = {
  pending_review: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-300",
    label: "New",
  },
  revision_requested: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-300",
    label: "Further review",
  },
  approved: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-300",
    label: "Approved",
  },
};

export function getReviewStatusStyle(status) {
  return REVIEW_STATUS_STYLES[status] || REVIEW_STATUS_STYLES.pending_review;
}

export function ReviewStatusBadge({status, size = "sm", className = ""}) {
  const style = getReviewStatusStyle(status);
  const sizeClass =
    size === "md"
      ? "px-2.5 py-0.5 text-xs"
      : "px-2 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${style.bg} ${style.text} ${className}`}
    >
      {style.label}
    </span>
  );
}
