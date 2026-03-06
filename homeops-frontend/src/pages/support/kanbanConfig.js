/**
 * Shared Kanban configuration for Support and Feedback management.
 * Standard 4-column layout: New, In Progress, Completed, Closed.
 */

/** Support ticket columns - maps to backend statuses */
export const SUPPORT_COLUMNS = [
  { id: "new", title: "New", status: "new" },
  { id: "in_progress", title: "In Progress", status: "working_on_it" },
  { id: "completed", title: "Completed", status: "solved" },
  { id: "closed", title: "Closed", status: "closed" },
];

/** Feedback ticket columns */
export const FEEDBACK_COLUMNS = [
  { id: "new", title: "New", status: "new" },
  { id: "in_progress", title: "In Progress", status: "under_review" },
  { id: "completed", title: "Completed", status: "implemented" },
  { id: "closed", title: "Closed", status: "rejected" },
];

/** Map backend status to column id (support) */
export function supportToColumnStatus(s) {
  if (s === "new") return "new";
  if (["working_on_it", "waiting_on_user", "in_progress"].includes(s)) return "in_progress";
  if (["solved", "resolved"].includes(s)) return "completed";
  if (s === "closed") return "closed";
  return "new";
}

/** Map backend status to column id (feedback) */
export function feedbackToColumnStatus(s) {
  if (s === "new") return "new";
  if (["under_review", "planned", "working_on_it"].includes(s)) return "in_progress";
  if (s === "implemented") return "completed";
  if (s === "rejected") return "closed";
  return "new";
}

/** Map column id to backend status */
export function columnToSupportStatus(colId) {
  return SUPPORT_COLUMNS.find((c) => c.id === colId)?.status ?? "new";
}

export function columnToFeedbackStatus(colId) {
  return FEEDBACK_COLUMNS.find((c) => c.id === colId)?.status ?? "new";
}
