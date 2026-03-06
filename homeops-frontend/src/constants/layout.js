/**
 * Standard page layout padding for consistent spacing across the app.
 * - Mobile: no lateral padding (edge-to-edge) for maximum content area
 * - sm–lg (640–1400px): reduced padding for tighter layout
 * - xxl (1400px+): increased padding for breathing room on large screens
 *
 * Best practices:
 * - Form/settings pages: Use `form` or `settings` for constrained width (max-w-5xl/6xl)
 *   to keep form fields readable (45–75 ch per line) and margins consistent.
 * - List pages: Use `list` for wider content (tables, cards).
 * - Single source of truth: Prefer layout constants over inline classes.
 */
export const PAGE_LAYOUT = {
  /** List pages: px-0 mobile, sm:px-4 lg:px-5 ≤1400px, xxl:px-12 >1400px */
  list: "px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto",
  /** List horizontal padding only (for custom layouts like Kanban) */
  listPaddingX: "px-0 sm:px-4 lg:px-5 xxl:px-12",
  /** Form container pages (ContactFormContainer, UserFormContainer, etc.) */
  form: "px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto",
  /** Form horizontal padding only (for custom layouts like PropertyFormContainer) */
  formPaddingX: "px-0 sm:px-4 lg:px-5 xxl:px-12",
  /** Settings pages (Configuration, Billing, Support forms): matches form padding & width */
  settings: "px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto",
};

/** Shared card styling for Settings pages (Configuration, Support, etc.) */
export const SETTINGS_CARD = {
  card: "rounded-xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 shadow-sm overflow-hidden",
  header: "px-6 py-5 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/60",
  body: "p-6",
};
