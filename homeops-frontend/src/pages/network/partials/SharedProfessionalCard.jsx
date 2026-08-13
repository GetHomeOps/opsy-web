import React, {useState, useEffect} from "react";
import {Briefcase, Phone, Mail, Star, MapPin, Bookmark, Check, Loader2} from "lucide-react";
import AppApi, {getApiErrorMessage} from "../../../api/api";
import {
  formatUSPhoneInput,
  telUriFromUSPhone,
} from "../../../utils/formatUSPhone";

function SharedProfessionalCard({professionalId, isOwn}) {
  const [professional, setProfessional] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    AppApi.getProfessional(professionalId)
      .then((p) => {
        if (!cancelled) {
          setProfessional(p);
          setSaved(Boolean(p?.saved));
        }
      })
      .catch(() => {
        if (!cancelled) setProfessional(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [professionalId]);

  const handleSave = async (e) => {
    e.stopPropagation();
    if (saving || saved || !professionalId) return;
    setSaving(true);
    setError(null);
    try {
      await AppApi.saveProfessional(professionalId);
      setSaved(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save professional"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 w-56">
        <p className="text-xs text-gray-500">Loading professional…</p>
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 w-56">
        <p className="text-xs text-gray-500">Professional not found</p>
      </div>
    );
  }

  const name =
    professional.company_name ||
    professional.companyName ||
    professional.contact_name ||
    professional.contactName ||
    "Unnamed";
  const category = professional.category_name || professional.categoryName;
  const city = professional.city;
  const phoneRaw = professional.phone;
  const phone =
    formatUSPhoneInput(phoneRaw || "") || (phoneRaw || "").trim() || "";
  const phoneTel = telUriFromUSPhone(phoneRaw || "");
  const email = professional.email;
  const rating = professional.avg_rating || professional.avgRating;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 w-64 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
          <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {name}
          </p>
          {category && (
            <p className="text-[11px] text-gray-500 truncate">{category}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {rating && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Star className="w-3 h-3 fill-current" />
            <span>{Number(rating).toFixed(1)}</span>
          </div>
        )}
        {city && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{city}</span>
          </div>
        )}
        {phone && (
          phoneTel ? (
            <a
              href={phoneTel}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-[#456564] dark:hover:text-[#6fb5b4]"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="w-3 h-3 shrink-0" />
              <span className="truncate">{phone}</span>
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <Phone className="w-3 h-3 shrink-0" />
              <span className="truncate">{phone}</span>
            </div>
          )
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-[#456564] dark:hover:text-[#6fb5b4]"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{email}</span>
          </a>
        )}
      </div>

      {!isOwn && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[#456564] text-white hover:bg-[#3a5554] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : saved ? (
              <Check className="w-3 h-3" />
            ) : (
              <Bookmark className="w-3 h-3" />
            )}
            {saved ? "Saved" : "Save to Professionals"}
          </button>
          {error && (
            <p className="text-[11px] text-red-500 mt-1.5">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default SharedProfessionalCard;
