import React from "react";

const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

import {
  Star,
  ShieldCheck,
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  Share2,
  CalendarCheck,
} from "lucide-react";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#456564]/40 dark:focus:ring-[#7aa3a2]/40";

function ProfileHeader({
  professional,
  saved,
  onSave,
  onRequestQuote,
  onShare,
}) {
  const stars = Array.from({ length: 5 }, (_, i) => ({
    filled: i < Math.floor(professional.rating),
    half:
      i >= Math.floor(professional.rating) && i < professional.rating,
    key: i,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-lg p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
        <img
          src={professional.photoUrl || PLACEHOLDER_IMG}
          alt={professional.name}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover ring-2 ring-white dark:ring-gray-700 shadow-md shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight truncate">
            {professional.name}
          </h1>
          <p className="text-sm sm:text-base text-[#456564] dark:text-[#7aa3a2] font-semibold truncate mt-0.5">
            {professional.companyName}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">
              {professional.categoryName}
            </span>
            <div className="flex items-center gap-0.5">
              {stars.map((s) => (
                <Star
                  key={s.key}
                  className={`w-3.5 h-3.5 ${
                    s.filled
                      ? "fill-amber-400 text-amber-400"
                      : s.half
                        ? "fill-amber-400/50 text-amber-400"
                        : "fill-gray-200 dark:fill-gray-600 text-gray-200"
                  }`}
                />
              ))}
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                {professional.rating}
              </span>
              <span className="text-xs text-gray-400 ml-0.5">
                ({professional.reviewCount})
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={onRequestQuote}
            className={`${BTN_BASE} bg-[#456564] hover:bg-[#34514f] text-white shadow-sm hover:shadow-md dark:bg-[#7aa3a2] dark:hover:bg-[#5a8a88] dark:text-gray-900`}
          >
            <MessageSquare className="w-4 h-4" />
            Request Quote
          </button>
          <button
            type="button"
            onClick={onSave}
            className={`${BTN_BASE} ${
              saved
                ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:border-[#7aa3a2] dark:bg-[#7aa3a2]/10 dark:text-[#7aa3a2]"
                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#456564] hover:text-[#456564] dark:hover:border-[#7aa3a2] dark:hover:text-[#7aa3a2] bg-white dark:bg-gray-800"
            }`}
          >
            {saved ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={onShare}
            className={`${BTN_BASE} border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#456564] hover:text-[#456564] dark:hover:border-[#7aa3a2] dark:hover:text-[#7aa3a2] bg-white dark:bg-gray-800`}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            type="button"
            disabled
            className={`${BTN_BASE} border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed opacity-70`}
            title="Coming soon"
          >
            <CalendarCheck className="w-4 h-4" />
            Schedule
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
              Soon
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;
