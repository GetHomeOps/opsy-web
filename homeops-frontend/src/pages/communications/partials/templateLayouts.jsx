import React from "react";
import {
  FileUp,
  Video,
  Link,
  ExternalLink,
  Play,
  ArrowRight,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import { getVideoThumbnailSync } from "../../../utils/videoThumbnail";
import {
  EditableInline,
  EditableSocialLinks,
} from "./templateEditables";

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
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Multi-section newsletter with feature rows",
  },
  {
    id: "promotional",
    name: "Promotional",
    description: "Bold gradient header with featured offer & CTA",
  },
  {
    id: "digest",
    name: "Digest",
    description: "Numbered article list with thumbnails",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Editorial whitespace-driven layout",
  },
];

/* ─── Shared building blocks ─── */

function LogoOrBrand({
  template,
  primaryColor,
  light = true,
  editable = false,
  onUpdateTemplate,
}) {
  const brandName = template?.brandName || "Opsy";

  if (template?.logoKey) {
    return (
      <div
        className={`w-24 h-8 mx-auto ${
          light ? "bg-white/20 text-white" : "bg-black/10 text-gray-700"
        } rounded flex items-center justify-center text-xs font-medium`}
      >
        Logo
      </div>
    );
  }
  return (
    <EditableInline
      value={brandName}
      placeholder="Brand"
      editable={editable}
      hintLabel="Brand name"
      onSave={(v) => onUpdateTemplate?.({ brandName: v || "Opsy" })}
      className={`text-sm font-semibold tracking-wide ${
        light ? "text-white opacity-90" : "text-gray-900"
      }`}
    />
  );
}

function BodyContent({ content, viewMode, color = "#374151" }) {
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
      className="prose prose-sm max-w-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:mt-3 [&_h3]:mb-2 [&_img]:rounded-lg [&_img]:max-w-full [&_a]:underline"
      style={{
        color,
        fontSize: viewMode === "mobile" ? "13px" : "14px",
        lineHeight: 1.65,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CtaButton({ att, primaryColor, size = "normal", fullWidth = false }) {
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
      className={`inline-flex items-center justify-center gap-2 ${px} ${py} rounded-lg text-white font-semibold ${text} transition-opacity hover:opacity-90 ${
        fullWidth ? "w-full" : ""
      }`}
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
        <img
          src={thumb}
          alt=""
          className="w-14 h-10 rounded object-cover shrink-0"
        />
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
  const files = attachments.filter(
    (a) => a.type === "image" || a.type === "pdf",
  );
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
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <div
              key={idx}
              className="w-full h-24 rounded-lg bg-gray-100 flex items-center justify-center"
            >
              <ImageIcon className="w-5 h-5 text-gray-400" />
            </div>
          );
        }
        return (
          <div
            key={idx}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-gray-200"
          >
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

function FooterArea({
  footerText,
  primaryColor,
  editable = false,
  onUpdateTemplate,
}) {
  if (!footerText && !editable) return null;
  return (
    <div
      className="px-5 py-3 text-center border-t"
      style={{
        borderTopColor: `${primaryColor}20`,
        color: "#9ca3af",
        fontSize: "11px",
      }}
    >
      <EditableInline
        value={footerText}
        placeholder="Footer text"
        editable={editable}
        hintLabel="Footer text"
        multiline
        onSave={(v) => onUpdateTemplate?.({ footerText: v })}
      />
    </div>
  );
}

function RichFooter({
  footerText,
  primaryColor,
  template,
  editable = false,
  onUpdateTemplate,
}) {
  const brandName = template?.brandName || "Opsy";
  return (
    <div
      className="px-5 py-5 text-center"
      style={{ backgroundColor: `${primaryColor}0d` }}
    >
      <div className="mb-3">
        <LogoOrBrand
          template={template}
          primaryColor={primaryColor}
          light={false}
          editable={editable}
          onUpdateTemplate={onUpdateTemplate}
        />
      </div>
      <div className="mb-3">
        <EditableSocialLinks
          socialLinks={template?.socialLinks || []}
          primaryColor={primaryColor}
          editable={editable}
          onChange={(next) => onUpdateTemplate?.({ socialLinks: next })}
        />
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        <EditableInline
          value={footerText}
          placeholder={`You're receiving this because you're part of the ${brandName} community.`}
          editable={editable}
          hintLabel="Footer text"
          multiline
          onSave={(v) => onUpdateTemplate?.({ footerText: v })}
        />
      </p>
      <p className="text-[10px] text-gray-400 mt-2">
        <span className="underline">Unsubscribe</span> ·{" "}
        <span className="underline">Preferences</span>
      </p>
    </div>
  );
}

function SectionDivider({ primaryColor, label }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: `${primaryColor}33` }}
      />
      {label ? (
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.15em]"
          style={{ color: primaryColor }}
        >
          {label}
        </span>
      ) : (
        <Sparkles className="w-3 h-3" style={{ color: primaryColor }} />
      )}
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: `${primaryColor}33` }}
      />
    </div>
  );
}

function FeatureCard({ att, primaryColor, attachmentUrls, index }) {
  const isVideo = att.type === "video_link";
  const isWebLink = att.type === "web_link";
  const isImage = att.type === "image";

  const thumb = isVideo
    ? getVideoThumbnailSync(att.url)
    : isImage && att.fileKey
      ? attachmentUrls[att.fileKey]
      : null;

  const reverse = index % 2 === 1;

  return (
    <div
      className={`flex gap-4 items-center bg-white rounded-xl border border-gray-200/80 overflow-hidden ${
        reverse ? "flex-row-reverse" : ""
      }`}
    >
      <div className="w-24 h-24 shrink-0 bg-gray-100 flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : isVideo ? (
          <Video className="w-6 h-6 text-purple-400" />
        ) : isWebLink ? (
          <Link className="w-6 h-6 text-emerald-400" />
        ) : (
          <ImageIcon className="w-6 h-6 text-gray-400" />
        )}
      </div>
      <div className="flex-1 py-3 pr-4 min-w-0">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: primaryColor }}
        >
          {isVideo ? "Watch" : isWebLink ? "Read more" : "Featured"}
        </p>
        <p className="text-sm font-semibold text-gray-800 leading-snug truncate">
          {att.filename ||
            (isVideo ? "Featured video" : isWebLink ? "Featured link" : "Featured image")}
        </p>
        {att.url && (
          <a
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1.5"
            style={{ color: primaryColor }}
          >
            {isVideo ? "Watch now" : "Open"}
            <ArrowRight className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function StatsRow({ primaryColor, viewMode }) {
  const stats = [
    { label: "Updates", value: "12" },
    { label: "Featured", value: "3" },
    { label: "New", value: "5" },
  ];
  return (
    <div
      className={`grid gap-2 mt-5 ${
        viewMode === "mobile" ? "grid-cols-3" : "grid-cols-3"
      }`}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="text-center p-3 rounded-xl"
          style={{ backgroundColor: `${primaryColor}10` }}
        >
          <div
            className="text-lg font-bold leading-none"
            style={{ color: primaryColor }}
          >
            {s.value}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function BadgePill({ primaryColor, children }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: `${primaryColor}15`,
        color: primaryColor,
      }}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {children}
    </span>
  );
}

/* ─── Layout A: Classic ─── */
export function ClassicLayout({
  form,
  template,
  primaryColor,
  bgColor,
  footerText,
  previewImageUrl,
  attachmentUrls,
  viewMode,
  editable,
  onUpdateTemplate,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );

  return (
    <div style={{ backgroundColor: bgColor }}>
      {/* Header */}
      <div
        className="px-5 py-4 text-center"
        style={{ backgroundColor: primaryColor }}
      >
        <LogoOrBrand
          template={template}
          primaryColor={primaryColor}
          editable={editable}
          onUpdateTemplate={onUpdateTemplate}
        />
      </div>

      <div className="px-5 py-5">
        {/* Subject */}
        <h2 className="text-lg font-bold mb-3" style={{ color: "#1f2937" }}>
          {form.subject || "Subject line"}
        </h2>

        {/* Preview image */}
        {previewImageUrl && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img
              src={previewImageUrl}
              alt=""
              className="w-full h-auto max-h-56 object-cover"
            />
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

      <FooterArea
        footerText={footerText}
        primaryColor={primaryColor}
        editable={editable}
        onUpdateTemplate={onUpdateTemplate}
      />
    </div>
  );
}

/* ─── Layout B: Hero / Banner ─── */
export function HeroLayout({
  form,
  template,
  primaryColor,
  bgColor,
  footerText,
  previewImageUrl,
  attachmentUrls,
  viewMode,
  editable,
  onUpdateTemplate,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );
  const primaryCta = linkAtts[0] || null;
  const secondaryLinks = linkAtts.slice(1);

  return (
    <div style={{ backgroundColor: bgColor }}>
      {/* Narrow branded bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-center"
        style={{ backgroundColor: primaryColor }}
      >
        <LogoOrBrand
          template={template}
          primaryColor={primaryColor}
          editable={editable}
          onUpdateTemplate={onUpdateTemplate}
        />
      </div>

      {/* Hero area */}
      {previewImageUrl ? (
        <div className="relative">
          <img
            src={previewImageUrl}
            alt=""
            className="w-full h-56 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="text-xl font-bold text-white drop-shadow">
              {form.subject || "Your headline here"}
            </h2>
          </div>
        </div>
      ) : (
        <div
          className="h-44 flex items-end justify-center pb-5 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 50%, ${primaryColor}99 100%)`,
          }}
        >
          {/* Decorative shapes */}
          <div
            className="absolute -top-6 -right-6 w-24 h-24 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          />
          <div
            className="absolute -bottom-10 -left-8 w-32 h-32 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          />
          <h2 className="text-xl font-bold text-white text-center px-5 drop-shadow-sm max-w-[90%] relative">
            {form.subject || "Your headline here"}
          </h2>
        </div>
      )}

      <div className="px-5 py-5">
        <BodyContent content={form.content} viewMode={viewMode} />

        {/* Primary CTA */}
        {primaryCta && (
          <div className="mt-5 text-center">
            <CtaButton
              att={primaryCta}
              primaryColor={primaryColor}
              size="large"
            />
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

      <FooterArea
        footerText={footerText}
        primaryColor={primaryColor}
        editable={editable}
        onUpdateTemplate={onUpdateTemplate}
      />
    </div>
  );
}

/* ─── Layout C: Announcement / Card ─── */
export function AnnouncementLayout({
  form,
  template,
  primaryColor,
  bgColor,
  footerText,
  previewImageUrl,
  attachmentUrls,
  viewMode,
  editable,
  onUpdateTemplate,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );
  const primaryCta = linkAtts[0] || null;
  const secondaryLinks = linkAtts.slice(1);

  const cardBg =
    bgColor === "#f9fafb" || bgColor === "#ffffff" ? "#f3f4f6" : bgColor;

  return (
    <div style={{ backgroundColor: cardBg }}>
      {/* Header */}
      <div
        className="px-5 py-4 text-center"
        style={{ backgroundColor: primaryColor }}
      >
        <LogoOrBrand
          template={template}
          primaryColor={primaryColor}
          editable={editable}
          onUpdateTemplate={onUpdateTemplate}
        />
      </div>

      {/* Card */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden max-w-md mx-auto">
          {/* Card image */}
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt=""
              className="w-full h-44 object-cover"
            />
          )}

          <div className="p-5">
            <div className="mb-3">
              <BadgePill primaryColor={primaryColor}>Announcement</BadgePill>
            </div>
            {/* Title */}
            <h2
              className="text-lg font-bold mb-2"
              style={{ color: "#1f2937" }}
            >
              {form.subject || "Subject line"}
            </h2>

            <BodyContent content={form.content} viewMode={viewMode} />

            {/* CTA */}
            {primaryCta && (
              <div className="mt-5">
                <CtaButton
                  att={primaryCta}
                  primaryColor={primaryColor}
                  size="normal"
                  fullWidth
                />
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

      <FooterArea
        footerText={footerText}
        primaryColor={primaryColor}
        editable={editable}
        onUpdateTemplate={onUpdateTemplate}
      />
    </div>
  );
}

/* ─── Layout D: Newsletter ─── */
export function NewsletterLayout({
  form,
  template,
  primaryColor,
  bgColor,
  footerText,
  previewImageUrl,
  attachmentUrls,
  viewMode,
  editable,
  onUpdateTemplate,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );
  const featuredItems = linkAtts.slice(0, 3);

  return (
    <div style={{ backgroundColor: bgColor }}>
      {/* Editorial header */}
      <div
        className="px-5 pt-5 pb-4 border-b-4"
        style={{ borderBottomColor: primaryColor }}
      >
        <div className="flex items-center justify-between mb-2">
          <LogoOrBrand
            template={template}
            primaryColor={primaryColor}
            light={false}
            editable={editable}
            onUpdateTemplate={onUpdateTemplate}
          />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Issue · {new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </span>
        </div>
        <h1
          className="text-2xl font-bold leading-tight"
          style={{ color: "#111827" }}
        >
          {form.subject || "This week at Opsy"}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Curated updates, news, and resources for you
        </p>
      </div>

      {/* Hero image */}
      {previewImageUrl && (
        <img
          src={previewImageUrl}
          alt=""
          className="w-full h-48 object-cover"
        />
      )}

      <div className="px-5 py-5">
        <SectionDivider primaryColor={primaryColor} label="In this issue" />

        <BodyContent content={form.content} viewMode={viewMode} />

        {/* Featured items as alternating cards */}
        {featuredItems.length > 0 && (
          <>
            <SectionDivider
              primaryColor={primaryColor}
              label="Featured"
            />
            <div className="space-y-3">
              {featuredItems.map((att, idx) => (
                <FeatureCard
                  key={idx}
                  att={att}
                  primaryColor={primaryColor}
                  attachmentUrls={attachmentUrls}
                  index={idx}
                />
              ))}
            </div>
          </>
        )}

        <FileAttachments
          attachments={form.attachments || []}
          attachmentUrls={attachmentUrls}
        />
      </div>

      <RichFooter
        footerText={footerText}
        primaryColor={primaryColor}
        template={template}
        editable={editable}
        onUpdateTemplate={onUpdateTemplate}
      />
    </div>
  );
}

/* ─── Layout E: Promotional ─── */
export function PromotionalLayout({
  form,
  template,
  primaryColor,
  bgColor,
  footerText,
  previewImageUrl,
  attachmentUrls,
  viewMode,
  editable,
  onUpdateTemplate,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );
  const primaryCta = linkAtts[0] || null;
  const secondaryLinks = linkAtts.slice(1);

  return (
    <div style={{ backgroundColor: bgColor }}>
      {/* Bold gradient header with decorative shapes */}
      <div
        className="relative overflow-hidden px-5 pt-8 pb-12 text-center"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 40%, ${primaryColor}aa 100%)`,
        }}
      >
        <div
          className="absolute -top-12 -right-10 w-40 h-40 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
        />
        <div
          className="absolute -bottom-14 -left-10 w-44 h-44 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        />
        <div className="relative">
          <div className="mb-3">
            <LogoOrBrand
              template={template}
              primaryColor={primaryColor}
              editable={editable}
              onUpdateTemplate={onUpdateTemplate}
            />
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-semibold uppercase tracking-widest mb-3">
            Special offer
          </span>
          <h1 className="text-2xl font-bold text-white leading-tight max-w-[85%] mx-auto">
            {form.subject || "Your big offer headline"}
          </h1>
        </div>
      </div>

      {/* Floating image card */}
      {previewImageUrl && (
        <div className="px-5 -mt-8 relative z-10">
          <div className="rounded-xl overflow-hidden shadow-lg border-4 border-white">
            <img
              src={previewImageUrl}
              alt=""
              className="w-full h-44 object-cover"
            />
          </div>
        </div>
      )}

      <div className="px-5 py-6">
        <BodyContent content={form.content} viewMode={viewMode} />

        <StatsRow primaryColor={primaryColor} viewMode={viewMode} />

        {/* Big CTA */}
        {primaryCta && (
          <div className="mt-6">
            <CtaButton
              att={primaryCta}
              primaryColor={primaryColor}
              size="large"
              fullWidth
            />
            <p className="text-center text-[10px] text-gray-400 mt-2">
              Limited time. Don't miss out.
            </p>
          </div>
        )}

        {secondaryLinks.length > 0 && (
          <div className="mt-5 space-y-2">
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

      <RichFooter
        footerText={footerText}
        primaryColor={primaryColor}
        template={template}
        editable={editable}
        onUpdateTemplate={onUpdateTemplate}
      />
    </div>
  );
}

/* ─── Layout F: Digest ─── */
export function DigestLayout({
  form,
  template,
  primaryColor,
  bgColor,
  footerText,
  previewImageUrl,
  attachmentUrls,
  viewMode,
  editable,
  onUpdateTemplate,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );

  return (
    <div style={{ backgroundColor: bgColor }}>
      {/* Compact header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <LogoOrBrand
          template={template}
          primaryColor={primaryColor}
          editable={editable}
          onUpdateTemplate={onUpdateTemplate}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
          Digest
        </span>
      </div>

      {/* Title section */}
      <div className="px-5 pt-5 pb-3">
        <h1
          className="text-xl font-bold leading-tight"
          style={{ color: "#111827" }}
        >
          {form.subject || "Your weekly digest"}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Everything worth knowing, in one place
        </p>
      </div>

      {previewImageUrl && (
        <div className="px-5 mb-4">
          <img
            src={previewImageUrl}
            alt=""
            className="w-full h-40 rounded-lg object-cover"
          />
        </div>
      )}

      <div className="px-5">
        <BodyContent content={form.content} viewMode={viewMode} />
      </div>

      {/* Numbered article list */}
      {linkAtts.length > 0 && (
        <div className="px-5 mt-5 space-y-3">
          {linkAtts.map((att, idx) => {
            const isVideo = att.type === "video_link";
            const thumb = isVideo ? getVideoThumbnailSync(att.url) : null;
            return (
              <a
                key={idx}
                href={att.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor,
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">
                    {att.filename ||
                      (isVideo ? "Video update" : "Featured link")}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {att.url}
                  </p>
                </div>
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="w-14 h-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <ArrowRight
                    className="w-4 h-4 shrink-0 self-center"
                    style={{ color: primaryColor }}
                  />
                )}
              </a>
            );
          })}
        </div>
      )}

      <div className="px-5 pb-5">
        <FileAttachments
          attachments={form.attachments || []}
          attachmentUrls={attachmentUrls}
        />
      </div>

      <RichFooter
        footerText={footerText}
        primaryColor={primaryColor}
        template={template}
        editable={editable}
        onUpdateTemplate={onUpdateTemplate}
      />
    </div>
  );
}

/* ─── Layout G: Minimal ─── */
export function MinimalLayout({
  form,
  template,
  primaryColor,
  bgColor,
  footerText,
  previewImageUrl,
  attachmentUrls,
  viewMode,
  editable,
  onUpdateTemplate,
}) {
  const linkAtts = (form.attachments || []).filter(
    (a) => a.type === "video_link" || a.type === "web_link",
  );
  const primaryCta = linkAtts[0] || null;
  const secondaryLinks = linkAtts.slice(1);

  const brandName = template?.brandName || "Opsy";
  return (
    <div style={{ backgroundColor: "#ffffff" }}>
      {/* Tiny brand mark */}
      <div className="px-8 pt-8 pb-2 text-center">
        <EditableInline
          value={brandName}
          placeholder="Brand"
          editable={editable}
          hintLabel="Brand name"
          onSave={(v) => onUpdateTemplate?.({ brandName: v || "Opsy" })}
          className="inline-block text-[10px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: primaryColor }}
        />
      </div>

      {/* Editorial title block */}
      <div className="px-8 pt-6 pb-6 text-center">
        <div
          className="w-10 h-px mx-auto mb-5"
          style={{ backgroundColor: primaryColor }}
        />
        <h1
          className="text-2xl leading-tight font-semibold"
          style={{ color: "#111827", fontFamily: "Georgia, serif" }}
        >
          {form.subject || "An editorial headline"}
        </h1>
        <div
          className="w-10 h-px mx-auto mt-5"
          style={{ backgroundColor: primaryColor }}
        />
      </div>

      {previewImageUrl && (
        <div className="px-0 mb-6">
          <img
            src={previewImageUrl}
            alt=""
            className="w-full h-52 object-cover"
          />
        </div>
      )}

      <div className="px-8 pb-2">
        <BodyContent content={form.content} viewMode={viewMode} />
      </div>

      {primaryCta && (
        <div className="px-8 py-6 text-center">
          <a
            href={primaryCta.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold border-b-2 pb-1 hover:opacity-80 transition-opacity"
            style={{
              color: primaryColor,
              borderBottomColor: primaryColor,
            }}
          >
            {primaryCta.type === "video_link" ? "Watch the video" : "Read more"}
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {secondaryLinks.length > 0 && (
        <div className="px-8 pb-4 space-y-2">
          {secondaryLinks.map((att, idx) => (
            <SecondaryLink key={idx} att={att} />
          ))}
        </div>
      )}

      <div className="px-8 pb-6">
        <FileAttachments
          attachments={form.attachments || []}
          attachmentUrls={attachmentUrls}
        />
      </div>

      <div className="px-8 py-5 border-t border-gray-100 text-center space-y-3">
        <EditableSocialLinks
          socialLinks={template?.socialLinks || []}
          primaryColor={primaryColor}
          editable={editable}
          onChange={(next) => onUpdateTemplate?.({ socialLinks: next })}
        />
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400">
          <EditableInline
            value={footerText}
            placeholder={`${brandName} · Crafted with care`}
            editable={editable}
            hintLabel="Footer text"
            multiline
            onSave={(v) => onUpdateTemplate?.({ footerText: v })}
          />
        </p>
      </div>
    </div>
  );
}

/* ─── Layout Thumbnails (inline SVG illustrations) ─── */

export function ClassicThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="120" height="12" rx="2" fill={accent} />
      <rect x="10" y="18" width="60" height="5" rx="1" fill="#374151" />
      <rect x="10" y="27" width="100" height="3" rx="1" fill="#d1d5db" />
      <rect x="10" y="33" width="90" height="3" rx="1" fill="#d1d5db" />
      <rect x="10" y="39" width="95" height="3" rx="1" fill="#d1d5db" />
      <rect
        x="10"
        y="48"
        width="100"
        height="18"
        rx="3"
        fill="#f3f4f6"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
      <rect x="0" y="72" width="120" height="8" rx="1" fill="#f9fafb" />
      <rect x="40" y="74.5" width="40" height="3" rx="1" fill="#e5e7eb" />
    </svg>
  );
}

export function HeroThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="120" height="8" rx="2" fill={accent} />
      <rect x="0" y="8" width="120" height="28" fill={`${accent}40`} />
      <rect
        x="25"
        y="16"
        width="70"
        height="5"
        rx="1"
        fill="white"
        fillOpacity="0.9"
      />
      <rect
        x="35"
        y="24"
        width="50"
        height="3"
        rx="1"
        fill="white"
        fillOpacity="0.6"
      />
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
    <svg
      viewBox="0 0 120 80"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="120" height="12" rx="2" fill={accent} />
      <rect x="0" y="12" width="120" height="60" fill="#f3f4f6" />
      <rect
        x="15"
        y="17"
        width="90"
        height="48"
        rx="4"
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
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

export function NewsletterThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="120" height="14" fill="white" />
      <rect x="10" y="4" width="22" height="3" rx="1" fill="#374151" />
      <rect x="80" y="4" width="30" height="2" rx="1" fill="#9ca3af" />
      <rect x="10" y="9" width="60" height="3.5" rx="1" fill="#1f2937" />
      <rect x="0" y="14" width="120" height="2" fill={accent} />
      <rect x="0" y="16" width="120" height="14" fill={`${accent}30`} />
      <rect x="10" y="34" width="100" height="2" rx="1" fill="#d1d5db" />
      <rect x="10" y="38" width="80" height="2" rx="1" fill="#d1d5db" />
      {/* Feature row 1 */}
      <rect
        x="10"
        y="44"
        width="100"
        height="11"
        rx="2"
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
      <rect x="10" y="44" width="14" height="11" rx="2" fill={`${accent}50`} />
      <rect x="28" y="47" width="40" height="2" rx="1" fill="#374151" />
      <rect x="28" y="51" width="55" height="2" rx="1" fill="#d1d5db" />
      {/* Feature row 2 (reversed) */}
      <rect
        x="10"
        y="58"
        width="100"
        height="11"
        rx="2"
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
      <rect x="96" y="58" width="14" height="11" rx="2" fill={`${accent}50`} />
      <rect x="14" y="61" width="40" height="2" rx="1" fill="#374151" />
      <rect x="14" y="65" width="55" height="2" rx="1" fill="#d1d5db" />
      <rect x="0" y="72" width="120" height="8" rx="1" fill={`${accent}10`} />
      <rect x="50" y="74.5" width="20" height="3" rx="1" fill={`${accent}80`} />
    </svg>
  );
}

export function PromotionalThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="promoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={`${accent}99`} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="120" height="32" fill="url(#promoGrad)" />
      <circle cx="105" cy="6" r="10" fill="white" fillOpacity="0.15" />
      <circle cx="10" cy="30" r="13" fill="white" fillOpacity="0.1" />
      <rect
        x="35"
        y="8"
        width="50"
        height="3"
        rx="1.5"
        fill="white"
        fillOpacity="0.7"
      />
      <rect
        x="20"
        y="15"
        width="80"
        height="6"
        rx="1"
        fill="white"
      />
      <rect
        x="14"
        y="26"
        width="92"
        height="14"
        rx="2"
        fill={`${accent}40`}
        stroke="white"
        strokeWidth="1.5"
      />
      <rect x="10" y="44" width="100" height="2" rx="1" fill="#d1d5db" />
      <rect x="10" y="48" width="85" height="2" rx="1" fill="#d1d5db" />
      {/* Stats row */}
      <rect x="10" y="54" width="29" height="9" rx="2" fill={`${accent}15`} />
      <rect x="45" y="54" width="29" height="9" rx="2" fill={`${accent}15`} />
      <rect x="80" y="54" width="29" height="9" rx="2" fill={`${accent}15`} />
      <rect x="10" y="66" width="100" height="6" rx="3" fill={accent} />
      <rect x="0" y="72" width="120" height="8" rx="1" fill={`${accent}10`} />
    </svg>
  );
}

export function DigestThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="120" height="9" fill={accent} />
      <rect x="10" y="13" width="55" height="4" rx="1" fill="#1f2937" />
      <rect x="10" y="20" width="80" height="2" rx="1" fill="#9ca3af" />
      {/* Numbered items */}
      {[26, 38, 50, 62].map((y, i) => (
        <g key={i}>
          <rect
            x="8"
            y={y}
            width="104"
            height="10"
            rx="2"
            fill="white"
            stroke="#e5e7eb"
            strokeWidth="0.5"
          />
          <circle cx="14" cy={y + 5} r="3.5" fill={`${accent}25`} />
          <rect x="22" y={y + 3} width="60" height="2" rx="1" fill="#374151" />
          <rect x="22" y={y + 7} width="40" height="1.5" rx="1" fill="#d1d5db" />
          <rect
            x="92"
            y={y + 2}
            width="14"
            height="6"
            rx="1"
            fill={`${accent}40`}
          />
        </g>
      ))}
      <rect x="0" y="74" width="120" height="6" rx="1" fill={`${accent}10`} />
    </svg>
  );
}

export function MinimalThumbnail({ selected }) {
  const accent = selected ? "#456564" : "#94a3b8";
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="120" height="80" fill="white" />
      <rect x="55" y="10" width="10" height="2" rx="1" fill={accent} />
      <rect x="50" y="18" width="20" height="0.5" fill={accent} />
      <rect x="35" y="24" width="50" height="5" rx="1" fill="#1f2937" />
      <rect x="40" y="32" width="40" height="3" rx="1" fill="#374151" />
      <rect x="50" y="40" width="20" height="0.5" fill={accent} />
      <rect x="10" y="46" width="100" height="14" fill={`${accent}25`} />
      <rect x="15" y="64" width="90" height="2" rx="1" fill="#d1d5db" />
      <rect x="15" y="68" width="80" height="2" rx="1" fill="#d1d5db" />
      <rect x="50" y="74" width="20" height="2" rx="1" fill={accent} />
    </svg>
  );
}

export const LAYOUT_COMPONENTS = {
  classic: ClassicLayout,
  hero: HeroLayout,
  announcement: AnnouncementLayout,
  newsletter: NewsletterLayout,
  promotional: PromotionalLayout,
  digest: DigestLayout,
  minimal: MinimalLayout,
};

export const LAYOUT_THUMBNAILS = {
  classic: ClassicThumbnail,
  hero: HeroThumbnail,
  announcement: AnnouncementThumbnail,
  newsletter: NewsletterThumbnail,
  promotional: PromotionalThumbnail,
  digest: DigestThumbnail,
  minimal: MinimalThumbnail,
};
