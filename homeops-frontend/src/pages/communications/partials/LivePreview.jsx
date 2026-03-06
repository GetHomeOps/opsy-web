import React, { useState, useEffect } from "react";
import AppApi from "../../../api/api";
import { Monitor, Smartphone, FileUp, Video, Link, ExternalLink } from "lucide-react";

function getVideoThumbnail(url) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  return null;
}

/** Ensure HTML renders correctly (handles escaped entities and content shape). */
function getBodyHtml(content) {
  const raw = typeof content?.body === "string" ? content.body : typeof content === "string" ? content : "";
  if (!raw) return "";
  // Decode HTML entities if content was stored escaped (e.g. &lt; → <)
  if (raw.includes("&lt;") || raw.includes("&gt;") || raw.includes("&amp;")) {
    const el = document.createElement("div");
    el.innerHTML = raw;
    return el.innerHTML;
  }
  return raw;
}

function LivePreview({ form, template }) {
  const [view, setView] = useState("desktop");
  const primary = template?.primaryColor || "#456564";
  const bgColor = template?.secondaryColor || "#f9fafb";
  const footer = template?.footerText || "";

  const [attachmentUrls, setAttachmentUrls] = useState({});

  useEffect(() => {
    const imageAtts = (form.attachments || []).filter((a) => a.type === "image" && a.fileKey);
    imageAtts.forEach((att) => {
      if (!attachmentUrls[att.fileKey]) {
        AppApi.getPresignedPreviewUrl(att.fileKey)
          .then((url) => setAttachmentUrls((prev) => ({ ...prev, [att.fileKey]: url })))
          .catch(() => {});
      }
    });
  }, [form.attachments]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Live Preview
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setView("desktop")}
            className={`p-1.5 rounded ${view === "desktop" ? "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-600"}`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("mobile")}
            className={`p-1.5 rounded ${view === "mobile" ? "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-600"}`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview frame */}
      <div className="p-4">
        <div
          className={`mx-auto rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 shadow-inner transition-all ${
            view === "mobile" ? "max-w-[320px]" : "max-w-full"
          }`}
          style={{ backgroundColor: bgColor }}
        >
          {/* Template header */}
          <div
            className="px-5 py-4 text-center"
            style={{ backgroundColor: primary }}
          >
            {template?.logoKey ? (
              <div className="w-24 h-8 mx-auto bg-white/20 rounded flex items-center justify-center text-white text-xs font-medium">
                Logo
              </div>
            ) : (
              <div className="text-white text-sm font-semibold tracking-wide opacity-90">
                HomeOps
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="px-5 py-5">
            {/* Subject */}
            <h2
              className="text-lg font-bold mb-3"
              style={{ color: "#1f2937" }}
            >
              {form.subject || "Subject line"}
            </h2>

            {/* Body */}
            {getBodyHtml(form.content) ? (
              <div
                className="prose prose-sm max-w-none text-gray-700 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:mt-3 [&_h3]:mb-2"
                style={{ fontSize: view === "mobile" ? "13px" : "14px", lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: getBodyHtml(form.content) }}
              />
            ) : (
              <p className="text-sm text-gray-400 italic">Your message content will appear here…</p>
            )}

            {/* Attachments preview */}
            {(form.attachments || []).length > 0 && (
              <div className="mt-4 space-y-2">
                {form.attachments.map((att, idx) => {
                  if (att.type === "image") {
                    const url = att.fileKey ? attachmentUrls[att.fileKey] : null;
                    return url ? (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className="w-full rounded-lg object-cover max-h-40"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div key={idx} className="w-full h-24 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-xs text-gray-500">Image</span>
                      </div>
                    );
                  }
                  if (att.type === "pdf") {
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <FileUp className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{att.filename || "Document.pdf"}</span>
                      </div>
                    );
                  }
                  if (att.type === "video_link") {
                    const thumb = getVideoThumbnail(att.url);
                    return (
                      <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
                        {thumb && (
                          <img src={thumb} alt="" className="w-full h-32 object-cover" />
                        )}
                        <div className="flex items-center gap-2 p-2.5">
                          <Video className="w-4 h-4 text-purple-500 shrink-0" />
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{att.url || "Video"}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                        </div>
                      </div>
                    );
                  }
                  if (att.type === "web_link") {
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <Link className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{att.url || "Link"}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>

          {/* Template footer */}
          {footer && (
            <div
              className="px-5 py-3 text-center border-t"
              style={{
                borderTopColor: `${primary}20`,
                color: "#9ca3af",
                fontSize: "11px",
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LivePreview;
