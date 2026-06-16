/** Shared auth page colors and class names (matches Opsy sign-in design). */
export const AUTH = {
  green: "#2D4A44",
  greenHover: "#243a36",
  gold: "#C5A87F",
  cream: "#F5F1EA",
};

export const authInputClass =
  "w-full rounded-xl border-0 bg-[#F5F1EA] px-4 py-3 text-[#2D4A44] placeholder:text-gray-400 shadow-none ring-1 ring-[#E8E2D8] focus:ring-2 focus:ring-[#2D4A44]/25 focus:bg-white text-base";

export const authLabelClass =
  "block text-sm font-medium text-[#2D4A44]/80 mb-1.5";

export const authPrimaryButtonClass =
  "w-full rounded-xl bg-[#2D4A44] py-3.5 font-auth-serif text-base font-medium text-white transition-colors hover:bg-[#243a36] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

export const authSecondaryButtonClass =
  "w-full rounded-xl border-2 border-[#C5A87F] bg-white py-3 font-auth-serif text-base font-medium text-[#C5A87F] transition-colors hover:bg-[#F5F1EA]/40 inline-flex items-center justify-center";

export const authGoogleButtonClass =
  "w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 flex items-center justify-center gap-2.5";

export function GoogleIcon({className = "w-5 h-5"}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
