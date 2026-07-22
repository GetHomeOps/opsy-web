import React, {useState} from "react";
import {Link, useParams} from "react-router-dom";
import {MapPin, Star} from "lucide-react";
import {
  professionalDisplayName,
  professionalLocation,
} from "../prePurchaseUtils";

export default function MatchedProfessionalsList({
  matches = [],
  limit = 4,
  emptyMessage = "No professional matches yet.",
  scoutTab = "overview",
}) {
  const {accountUrl, analysisId} = useParams();
  const rows = matches.slice(0, limit);
  const [failedPhotoIds, setFailedPhotoIds] = useState(() => new Set());

  const profileLinkState =
    accountUrl && analysisId
      ? {
          from: "scout",
          backLabel: "Opsy Scout",
          backTo: `/${accountUrl}/pre-purchase/${analysisId}`,
          tab: scoutTab,
        }
      : undefined;

  if (!rows.length) {
    return <p className="text-sm text-neutral-500">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((m) => {
        const name = professionalDisplayName(m);
        const location = professionalLocation(m);
        const showPhoto = Boolean(m.profilePhotoUrl) && !failedPhotoIds.has(m.id);
        return (
          <li key={m.id} className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-neutral-500">
              {showPhoto ? (
                <img
                  src={m.profilePhotoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => {
                    setFailedPhotoIds((prev) => {
                      if (prev.has(m.id)) return prev;
                      const next = new Set(prev);
                      next.add(m.id);
                      return next;
                    });
                  }}
                />
              ) : (
                name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                {name}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-500">
                <span className="truncate">
                  {m.subcategoryName || m.categoryName || "Professional"}
                </span>
                {m.rating != null && (
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    <Star
                      className="w-3 h-3 fill-amber-400 text-amber-400"
                      aria-hidden
                    />
                    {Number(m.rating).toFixed(1)}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-0.5 truncate">
                    <MapPin className="w-3 h-3" aria-hidden />
                    {location}
                  </span>
                )}
              </div>
            </div>
            <Link
              to={`/${accountUrl}/professionals/${m.professionalId}`}
              state={profileLinkState}
              className="btn-sm border shrink-0 text-xs px-2.5 py-1"
            >
              View
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
