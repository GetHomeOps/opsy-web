import React, {useState, useCallback} from "react";
import {useNavigate} from "react-router-dom";

const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
import {
  Star,
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Shield,
  Award,
} from "lucide-react";
import useCurrentAccount from "../../../hooks/useCurrentAccount";

function ProjectImageCarousel({photos}) {
  const [current, setCurrent] = useState(0);
  const displayPhotos = photos.slice(0, 4);
  const total = displayPhotos.length;

  const prev = useCallback(
    (e) => {
      e.stopPropagation();
      setCurrent((c) => (c - 1 + total) % total);
    },
    [total],
  );

  const next = useCallback(
    (e) => {
      e.stopPropagation();
      setCurrent((c) => (c + 1) % total);
    },
    [total],
  );

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-gray-100 dark:bg-gray-700 group/carousel"
    >
      {displayPhotos.map((photo, idx) => (
        <img
          key={photo.id}
          src={photo.url || PLACEHOLDER_IMG}
          alt={photo.caption}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            idx === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 dark:bg-gray-800/90 shadow flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-gray-700 dark:text-gray-200" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 dark:bg-gray-800/90 shadow flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronRight className="w-3.5 h-3.5 text-gray-700 dark:text-gray-200" />
          </button>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1">
            {displayPhotos.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === current ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {photos.length > 4 && (
        <span className="absolute bottom-2.5 right-2.5 text-[10px] font-medium bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-md">
          +{photos.length - 4} more
        </span>
      )}
    </div>
  );
}

function ProfessionalCard({
  professional,
  onToggleSave,
  compact = false,
  variant,
}) {
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";

  const goToProfile = () => {
    navigate(
      accountUrl
        ? `/${accountUrl}/professionals/${professional.id}`
        : `/professionals/${professional.id}`,
    );
  };

  const stars = Array.from({length: 5}, (_, i) => {
    const filled = i < Math.floor(professional.rating);
    const half = !filled && i < professional.rating;
    return {filled, half, key: i};
  });

  if (variant === "directory-teaser") {
    const mainImage =
      professional.projectPhotos[0]?.url || professional.photoUrl || PLACEHOLDER_IMG;
    return (
      <div
        onClick={goToProfile}
        className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-800/60 shadow-sm cursor-pointer group hover:bg-gray-100/90 dark:hover:bg-gray-800/90 hover:border-[#456564]/25 dark:hover:border-[#7aa3a2]/30 hover:shadow-md transition-all duration-200"
      >
        <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 ring-1 ring-gray-200/80 dark:ring-gray-600/50">
          <img
            src={mainImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
            {professional.companyName}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {professional.categoryName}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {stars.slice(0, 5).map((s) => (
              <Star
                key={s.key}
                className={`w-2.5 h-2.5 ${
                  s.filled
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-200 dark:fill-gray-600 text-gray-200"
                }`}
              />
            ))}
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 ml-0.5">
              {professional.rating}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "grid") {
    const mainImage =
      professional.projectPhotos[0]?.url || professional.photoUrl || PLACEHOLDER_IMG;
    return (
      <div
        onClick={goToProfile}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm overflow-hidden cursor-pointer group"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
          <img
            src={mainImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        <div className="p-3.5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
            {professional.companyName}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {professional.categoryName}
          </p>
          <div className="flex items-center gap-1 mt-1.5">
            {stars.map((s) => (
              <Star
                key={s.key}
                className={`w-3 h-3 ${
                  s.filled
                    ? "fill-amber-400 text-amber-400"
                    : s.half
                      ? "fill-amber-400/50 text-amber-400"
                      : "fill-gray-200 dark:fill-gray-600 text-gray-200"
                }`}
              />
            ))}
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 ml-0.5">
              {professional.rating}
            </span>
            <span className="text-[11px] text-gray-400">
              ({professional.reviewCount})
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{professional.serviceArea}</span>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        onClick={goToProfile}
        className="flex items-center gap-4 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 cursor-pointer group"
      >
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden">
          <img
            src={professional.projectPhotos[0]?.url || professional.photoUrl || PLACEHOLDER_IMG}
            alt={professional.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#456564] dark:group-hover:text-[#7aa3a2] transition-colors truncate leading-tight">
            {professional.companyName}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {professional.categoryName}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-500">
          <Star className="w-3.5 h-3.5 fill-current" />
          <span className="font-medium">{professional.rating}</span>
        </div>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 p-2 rounded-lg text-[#456564] hover:bg-[#456564]/10 transition-colors"
          title="Contact"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={goToProfile}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm cursor-pointer group overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Left: Project photos — wider, image-dominant */}
        <div className="sm:w-[300px] lg:w-[340px] xl:w-[360px] shrink-0 h-44 sm:h-auto sm:min-h-[190px]">
          <ProjectImageCarousel
            photos={professional.projectPhotos}
          />
        </div>

        {/* Right: Info panel */}
        <div className="flex-1 min-w-0 p-5 sm:p-6 flex flex-col">
          {/* Top row: Avatar + Name block + Action buttons */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <img
                src={professional.photoUrl || PLACEHOLDER_IMG}
                alt=""
                className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700 shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-gray-900 dark:text-white group-hover:text-[#456564] dark:group-hover:text-[#7aa3a2] transition-colors truncate leading-snug">
                  {professional.companyName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {professional.categoryName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm font-bold text-[#456564] dark:text-[#7aa3a2]">
                    {professional.rating}
                  </span>
                  <div className="flex items-center">
                    {stars.map((s) => (
                      <Star
                        key={s.key}
                        className={`w-3 h-3 ${
                          s.filled
                            ? "fill-amber-400 text-amber-400"
                            : s.half
                              ? "fill-amber-400/50 text-amber-400"
                              : "fill-gray-200 dark:fill-gray-600 text-gray-200 dark:text-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({professional.reviewCount})
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#456564] text-white hover:bg-[#34514f] transition-colors shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Message
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave?.(professional.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  professional.saved
                    ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:border-[#7aa3a2] dark:text-[#7aa3a2]"
                    : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#456564] hover:text-[#456564] dark:hover:border-[#7aa3a2] dark:hover:text-[#7aa3a2]"
                }`}
              >
                {professional.saved ? (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                {professional.saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <Shield className="w-2.5 h-2.5" />
              Verified
            </span>
            {professional.yearsInBusiness >= 10 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                <Award className="w-2.5 h-2.5" />
                {professional.yearsInBusiness}+ Yrs
              </span>
            )}
            {professional.languages.length > 1 && (
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {professional.languages.join(", ")}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="mt-3 text-[13px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed flex-1">
            {professional.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/30">
            <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <MapPin className="w-3 h-3" />
              <span>{professional.serviceArea}</span>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {professional.projectPhotos.length} projects
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfessionalCard;
