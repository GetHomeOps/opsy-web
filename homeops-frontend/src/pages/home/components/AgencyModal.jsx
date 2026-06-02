import React, {useEffect, useRef} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {X, Building2, MapPin, Phone, Globe, ExternalLink} from "lucide-react";

function agencyInitials(name) {
  if (!name || typeof name !== "string") return "A";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatWebsiteUrl(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function formatWebsiteLabel(url) {
  if (!url) return "";
  return String(url)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function AgencyModal({agency, isOpen, onClose}) {
  const {t} = useTranslation();
  const panelRef = useRef(null);
  const firstFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => firstFocusRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen || !agency?.name) return null;

  const logoUrl = agency.logoDisplayUrl;
  const initials = agencyInitials(agency.name);
  const websiteHref = formatWebsiteUrl(agency.website);
  const locationParts = [
    agency.addressLine1,
    [agency.city, agency.state].filter(Boolean).join(", "),
  ].filter(Boolean);
  const location = locationParts.join(", ");
  const showLegalName =
    agency.legalName &&
    agency.legalName.trim().toLowerCase() !== agency.name.trim().toLowerCase();
  const hasDetails = location || agency.phone || websiteHref;

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("homeownerHome.agencyModalAria", {name: agency.name})}
    >
      <div
        className="fixed inset-0 bg-gray-900/30 animate-in fade-in duration-200"
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
      >
        {/* Green header — logo left, name right */}
        <div className="relative bg-gradient-to-br from-[#3a5857] to-[#2a4241] px-6 pt-6 pb-5">
          <button
            ref={firstFocusRef}
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t("common.close") || "Close"}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden ring-2 ring-white/25 bg-white/10 shadow-sm flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-white/90">
                  {initials}
                </span>
              )}
              {!logoUrl && (
                <Building2
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-white/30"
                  aria-hidden
                />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-0.5">
                {t("homeownerHome.agentBrokerage")}
              </p>
              <h2 className="text-lg font-bold text-white leading-snug">
                {agency.name}
              </h2>
              {showLegalName && (
                <p className="text-sm text-white/50 mt-0.5">{agency.legalName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="px-6 py-5">
          {hasDetails ? (
            <div className="space-y-3">
              {location && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                    {location}
                  </p>
                </div>
              )}
              {agency.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <a
                    href={`tel:${agency.phone}`}
                    className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#456564] dark:hover:text-[#6fb5b4] transition-colors"
                  >
                    {agency.phone}
                  </a>
                </div>
              )}
              {websiteHref && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[#456564] dark:text-[#6fb5b4] hover:underline"
                  >
                    {formatWebsiteLabel(agency.website)}
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t("homeownerHome.agencyNoDetails")}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default AgencyModal;
