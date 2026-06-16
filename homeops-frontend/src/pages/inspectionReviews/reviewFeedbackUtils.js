/** Parse stored review_notes (JSON or legacy plain text). */
export function parseReviewNotes(raw) {
  if (!raw) return {comment: "", suggestedImprovements: ""};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        comment: parsed.comment || "",
        suggestedImprovements: parsed.suggestedImprovements || "",
      };
    }
  } catch {
    // legacy plain-text notes
  }
  return {comment: String(raw), suggestedImprovements: ""};
}

export function hasReviewFeedback(raw) {
  const {comment, suggestedImprovements} = parseReviewNotes(raw);
  return Boolean(comment.trim() || suggestedImprovements.trim());
}
