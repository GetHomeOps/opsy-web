import React from "react";
import { FileUp, Video, Link, ExternalLink, Play, ArrowRight, ImageIcon } from "lucide-react";
import { getVideoThumbnailSync } from "../../../utils/videoThumbnail";

/** Decode HTML entities if content was stored escaped. */
export function getBodyHtml(content) {
  const raw =
    typeof content?.body === "string"
      ? content.body
      : typeof content === "string"
        ? content
        : "";
  if (!raw) return "";
  if (raw.includes("&lt;") || raw.includes("&gt;") || raw.includes("&amp;")) {
    const el = document.createElement("div");
    el.innerHTML = raw;
    return el.innerHTML;
  }
  return raw;
}

export const LAYOUTS = [
  {
    id: "classic",
    name: "Classic",
    description: "Clean header, body content, and attachments",
  },
  {
    id: "hero",
    name: "Hero Banner",
    description: "Bold hero image with prominent headline",
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "Centered card with featured content",
  },
];

function LogoOrBrand({ template, primaryColor }) {
  if (template?.logoKey) {
    return (
      <div className="w-24 h-8 mx-auto bg-white/20 rounded flex items-center justify-center text-white text-xs font-medium">
        Logo
      </div>
    );
  }
  return (
    <div className="text-white text-sm font-semibold tracking-wide opacity-90">
      Opsy
    </div>
  );
}

function BodyContent({ content, viewMode }) {
  const html = getBodyHtml(content);
  if (!html) {
    return (
      <p className="text-sm text-gray-400 italic">
        Your message content will appear here…
      </p>
    );
  }
  return (
    <div
      className="prose prose-sm max-w-none text-gray-700 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:mt-3 [&_h3]:mb-2 [&_img]:rounded-lg [&_img]:max-w-full"
      style={{ fontSize: viewMode === "mobile" ? "13px" : "14px", lineHeight: 1.6 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CtaButton({ att, primaryColor, size = "normal" }) {
  const isVideo = att.type === "video_link";
  const label = isVideo ? "Watch Video" : "Learn More";
  const Icon = isVideo ? Play : ArrowRight;
  const py = size === "large" ? "py-3.5" : "py-2.5";
  const px = size === "large" ? "px-8" : "px-6";
  const text = size === "large" ? "text-sm" : "text-xs";
  return (
    <a
      href={att.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 ${px} ${py} rounded-lg text-white font-semibold ${text} transition-opacity hover:opacity-90`}
      style={{ backgroundColor: primaryColor }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </a>
  );
}

function SecondaryLink({ att }) {
  const isVideo = att.type === "video_link";
  const thumb = isVideo ? getVideoThumbnailSync(att.url) : null;
  return (
    <a
      href={att.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
    >
      {thumb ? (
        <img src={thumb} alt="" className="w-14 h-10 rounded object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          {isVideo ? (
            <Video className="w-4 h-4 text-purple-500" />
          ) : (
            <Link className="w-4 h-4 text-emerald-500" />
          )}
        </div>
      )}
      <span className="text-xs text-gray-700 truncate flex-1">
        {att.url || (isVideo ? "Video" : "Link")}
      </span>
      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
    </a>
  );
}

function FileAttachments({ attachments, attachmentUrls }) {
  const files = attachments.filter((a) => a.type === "image" || a.type === "pdf");
  if (files.length === 0) return null;
  return (
    <div className="space-y-2 pt-4 mt-4 border-t border-gray-200/60">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
        Attachments
      </p>
      {files.map((att, idx) => {
        if (att.type === "image") {
          const url = att.fileKey ? attachmentUrls[att.fileKey] : null;
          return url ? (
            <img
              key={idx}
              src={url}
              alt=""
              className="w-full rounded-lg object-cover max-h-44"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div key={idx} className="w-full h-24 rounded-lg bg-gray-100 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-gray-400" />
            </div>
          );
        }
        return (
          <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-gray-200">
            <FileUp className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-gray-700">
              {att.filename || "Document.pdf"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FooterArea({ footerText, primaryColor }) {
  if (!footerText) return null;
  return (
    <div
      className="px-5 py-3 text-center border-t"
      style={{ borderTopColor: `${primaryColor}20`, color: "#9ca3af", fontSize: "11px" }}
    >
      {footerText}
    </div>
  );
}

/* ─── Layout A: Classic ─── */
export function ClassicLayout({
  form, template, primaryColor, bgColor, footerText, previewImageUrl, attachmentUrls, viewMode,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );

  return (
    <div style={{ backgroundColor: bgColor }}>
      {/* Header */}
      <div className="px-5 py-4 text-center" style={{ backgroundColor: primaryColor }}>
        <LogoOrBrand template={template} primaryColor={primaryColor} />
      </div>

      <div className="px-5 py-5">
        {/* Subject */}
        <h2 className="text-lg font-bold mb-3" style={{ color: "#1f2937" }}>
          {form.subject || "Subject line"}
        </h2>

        {/* Preview image */}
        {previewImageUrl && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img src={previewImageUrl} alt="" className="w-full h-auto max-h-48 object-cover" />
          </div>
        )}

        <BodyContent content={form.content} viewMode={viewMode} />

        {/* Link CTA blocks */}
        {linkAtts.length > 0 && (
          <div className="mt-5 space-y-2">
            {linkAtts.map((att, idx) => (
              <SecondaryLink key={idx} att={att} />
            ))}
          </div>
        )}

        <FileAttachments
          attachments={form.attachments || []}
          attachmentUrls={attachmentUrls}
        />
      </div>

      <FooterArea footerText={footerText} primaryColor={primaryColor} />
    </div>
  );
}

/* ─── Layout B: Hero / Banner ─── */
export function HeroLayout({
  form, template, primaryColor, bgColor, footerText, previewImageUrl, attachmentUrls, viewMode,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );
  const primaryCta = linkAtts[0] || null;
  const secondaryLinks = linkAtts.slice(1);

  return (
    <div style={{ backgroundColor: bgColor }}>
      {/* Narrow branded bar */}
      <div className="px-4 py-2.5 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
        <LogoOrBrand template={template} primaryColor={primaryColor} />
      </div>

      {/* Hero area */}
      {previewImageUrl ? (
        <div className="relative">
          <img
            src={previewImageUrl}
            alt=""
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      ) : (
        <div
          className="h-36 flex items-end justify-center pb-5"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 50%, ${primaryColor}99 100%)`,
          }}
        >
          <h2 className="text-xl font-bold text-white text-center px-5 drop-shadow-sm max-w-[90%]">
            {form.subject || "Your headline here"}
          </h2>
        </div>
      )}

      <div className="px-5 py-5">
        {/* Subject (shown separately when hero image is present) */}
        {previewImageUrl && (
          <h2 className="text-xl font-bold mb-1" style={{ color: "#1f2937" }}>
            {form.subject || "Subject line"}
          </h2>
        )}

        <BodyContent content={form.content} viewMode={viewMode} />

        {/* Primary CTA */}
        {primaryCta && (
          <div className="mt-5 text-center">
            <CtaButton att={primaryCta} primaryColor={primaryColor} size="large" />
          </div>
        )}

        {/* Secondary links */}
        {secondaryLinks.length > 0 && (
          <div className="mt-4 space-y-2">
            {secondaryLinks.map((att, idx) => (
              <SecondaryLink key={idx} att={att} />
            ))}
          </div>
        )}

        <FileAttachments
          attachments={form.attachments || []}
          attachmentUrls={attachmentUrls}
        />
      </div>

      <FooterArea footerText={footerText} primaryColor={primaryColor} />
    </div>
  );
}

/* ─── Layout C: Announcement / Card ─── */
export function AnnouncementLayout({
  form, template, primaryColor, bgColor, footerText, previewImageUrl, attachmentUrls, viewMode,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );
  const primaryCta = linkAtts[0] || null;
  const secondaryLinks = linkAtts.slice(1);

  const cardBg = bgColor === "#f9fafb" || bgColor === "#ffffff" ? "#f3f4f6" : bgColor;

  return (
    <div style={{ backgroundColor: cardBg }}>
      {/* Header */}
      <div className="px-5 py-4 text-center" style={{ backgroundColor: primaryColor }}>
        <LogoOrBrand template={template} primaryColor={primaryColor} />
      </div>

      {/* Card */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden max-w-md mx-auto">
          {/* Card image */}
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt=""
              className="w-full h-40 object-cover"
            />
          )}

          <div className="p-5">
            {/* Title */}
            <h2 className="text-lg font-bold mb-2" style={{ color: "#1f2937" }}>
              {form.subject || "Subject line"}
            </h2>

            <BodyContent content={form.content} viewMode={viewMode} />

            {/* CTA */}
            {primaryCta && (
              <div className="mt-5">
                <CtaButton att={primaryCta} primaryColor={primaryColor} size="normal" />
              </div>
            )}
          </div>
        </div>

        {/* Extra links below card */}
        {secondaryLinks.length > 0 && (
          <div className="mt-4 space-y-2 max-w-md mx-auto">
            {secondaryLinks.map((att, idx) => (
              <SecondaryLink key={idx} att={att} />
            ))}
          </div>
        )}

        {/* File attachments below card */}
        <div className="max-w-md mx-auto">
          <FileAttachments
            attachments={form.attachments || []}
            attachmentUrls={attachmentUrls}
          />
        </div>
      </div>

      <FooterArea footerText={footerText} primaryColor={primaryColor} />
    </div>
  );
}

/* ─── Layout Thumbnails (inline SVG illustrations) ─── */

export function ClassicThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="120" height="12" rx="2" fill={accent} />
      <rect x="10" y="18" width="60" height="5" rx="1" fill="#374151" />
      <rect x="10" y="27" width="100" height="3" rx="1" fill="#d1d5db" />
      <rect x="10" y="33" width="90" height="3" rx="1" fill="#d1d5db" />
      <rect x="10" y="39" width="95" height="3" rx="1" fill="#d1d5db" />
      <rect x="10" y="48" width="100" height="18" rx="3" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="0" y="72" width="120" height="8" rx="1" fill="#f9fafb" />
      <rect x="40" y="74.5" width="40" height="3" rx="1" fill="#e5e7eb" />
    </svg>
  );
}

export function HeroThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="120" height="8" rx="2" fill={accent} />
      <rect x="0" y="8" width="120" height="28" fill={`${accent}40`} />
      <rect x="25" y="16" width="70" height="5" rx="1" fill="white" fillOpacity="0.9" />
      <rect x="35" y="24" width="50" height="3" rx="1" fill="white" fillOpacity="0.6" />
      <rect x="10" y="42" width="100" height="3" rx="1" fill="#d1d5db" />
      <rect x="10" y="48" width="85" height="3" rx="1" fill="#d1d5db" />
      <rect x="30" y="56" width="60" height="10" rx="5" fill={accent} />
      <rect x="48" y="59" width="24" height="4" rx="1" fill="white" />
      <rect x="0" y="72" width="120" height="8" rx="1" fill="#f9fafb" />
      <rect x="40" y="74.5" width="40" height="3" rx="1" fill="#e5e7eb" />
    </svg>
  );
}

export function AnnouncementThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="120" height="12" rx="2" fill={accent} />
      <rect x="0" y="12" width="120" height="60" fill="#f3f4f6" />
      <rect x="15" y="17" width="90" height="48" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="15" y="17" width="90" height="16" rx="4" fill="#e5e7eb" />
      <rect x="25" y="37" width="50" height="4" rx="1" fill="#374151" />
      <rect x="25" y="44" width="70" height="3" rx="1" fill="#d1d5db" />
      <rect x="25" y="50" width="60" height="3" rx="1" fill="#d1d5db" />
      <rect x="25" y="57" width="40" height="6" rx="3" fill={accent} />
      <rect x="0" y="72" width="120" height="8" rx="1" fill="#f9fafb" />
      <rect x="40" y="74.5" width="40" height="3" rx="1" fill="#e5e7eb" />
    </svg>
  );
}

export const LAYOUT_COMPONENTS = {
  classic: ClassicLayout,
  hero: HeroLayout,
  announcement: AnnouncementLayout,
};

export const LAYOUT_THUMBNAILS = {
  classic: ClassicThumbnail,
  hero: HeroThumbnail,
  announcement: AnnouncementThumbnail,
};
