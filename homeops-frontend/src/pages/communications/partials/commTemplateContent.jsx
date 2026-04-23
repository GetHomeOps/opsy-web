/**
 * Defaults + merge helper for comm template content.
 *
 * `form.content` is a JSONB blob on the backend. It always carries `body` and
 * `layout`, and optionally any of the fields below — editable inline from the
 * Live Preview. `getMergedCommContent` returns a fully-populated object so
 * layout components can render without null-checking.
 */

/** Default palette when a template or snapshot omits a color. */
export const DEFAULT_COMM_PRIMARY = "#456564";
export const DEFAULT_COMM_SECONDARY = "#f9fafb";

/**
 * Picks theme fields to store on `content.templateTheme` at save time so
 * recipients render the same colors/brand the author saw, even if the account
 * template row is edited later.
 */
export function buildTemplateThemeSnapshot(template) {
  if (!template) return null;
  return {
    primaryColor: template.primaryColor || DEFAULT_COMM_PRIMARY,
    secondaryColor: template.secondaryColor || DEFAULT_COMM_SECONDARY,
    brandName: template.brandName?.trim() || "Opsy",
    footerText: template.footerText || "",
  };
}

/**
 * Merges stored snapshot with the template row. Use `preferContentSnapshot`
 * in recipient view so the frozen snapshot wins; in the composer, live
 * `template` state should win.
 */
export function getEffectiveTemplateTheme(
  content,
  templateFromApi,
  { preferContentSnapshot = false } = {},
) {
  const snap = content?.templateTheme;
  const t = templateFromApi || {};
  if (preferContentSnapshot) {
    return {
      primaryColor: snap?.primaryColor || t.primaryColor || DEFAULT_COMM_PRIMARY,
      secondaryColor:
        snap?.secondaryColor || t.secondaryColor || DEFAULT_COMM_SECONDARY,
      brandName: snap?.brandName ?? t.brandName ?? "Opsy",
      footerText: snap?.footerText ?? t.footerText ?? "",
    };
  }
  return {
    primaryColor: t.primaryColor || snap?.primaryColor || DEFAULT_COMM_PRIMARY,
    secondaryColor:
      t.secondaryColor || snap?.secondaryColor || DEFAULT_COMM_SECONDARY,
    brandName: t.brandName ?? snap?.brandName ?? "Opsy",
    footerText: t.footerText ?? snap?.footerText ?? "",
  };
}

export const DEFAULT_COMM_CONTENT = {
  announcementBadge: "Announcement",
  newsletterTagline: "A roundup of updates and resources",
  newsletterInThisIssueLabel: "In this issue",
  newsletterFeaturedLabel: "Featured",
  promotionalBadge: "Limited time",
  promotionalCtaNote: "Takes less than a minute",
  digestHeaderLabel: "This week",
  digestSubtitle: "Everything worth knowing, in one place",
  statCards: [
    { value: "12", label: "Updates" },
    { value: "3", label: "Featured" },
    { value: "5", label: "New" },
  ],
  /** Toggles for “add” affordances in the live preview (editor only; never sent as raw UI). */
  editorUi: {
    showStatAdd: true,
    showSocialAdd: true,
  },
};

/** Returns `content` merged over DEFAULT_COMM_CONTENT (stable shape). */
export function getMergedCommContent(content) {
  const raw = { ...DEFAULT_COMM_CONTENT, ...(content || {}) };
  if (!Array.isArray(raw.statCards) || raw.statCards.length === 0) {
    raw.statCards = DEFAULT_COMM_CONTENT.statCards;
  }
  const merged = {
    ...raw,
    editorUi: {
      ...DEFAULT_COMM_CONTENT.editorUi,
      ...(raw.editorUi || {}),
    },
  };
  return merged;
}
