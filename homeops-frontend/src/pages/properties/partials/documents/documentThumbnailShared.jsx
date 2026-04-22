import React, {useEffect, useRef, useState} from "react";
import {FileText, Image as ImageIcon, Loader2} from "lucide-react";
import AppApi from "../../../../api/api";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"];
const PDF_EXTS = [".pdf"];

function detectKind(name = "", mimeType = "", documentKey = "") {
  const m = String(mimeType || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  // Filed documents often have a friendly `name` without an extension; in
  // that case fall back to the S3 `document_key`, which keeps the original
  // filename (e.g. `accounts/.../documents/abc-Invoice.pdf`).
  const candidates = [name, documentKey].map((s) => String(s || "").toLowerCase());
  for (const candidate of candidates) {
    if (IMAGE_EXTS.some((ext) => candidate.endsWith(ext))) return "image";
    if (PDF_EXTS.some((ext) => candidate.endsWith(ext))) return "pdf";
  }
  return "other";
}

function FallbackIcon({kind, compact, label}) {
  const Icon = kind === "image" ? ImageIcon : FileText;
  const accent =
    kind === "pdf"
      ? "text-red-400 dark:text-red-300/80"
      : kind === "image"
        ? "text-sky-400 dark:text-sky-300/80"
        : "text-gray-400 dark:text-gray-500";
  return (
    <div className={`flex flex-col items-center justify-center gap-1 ${accent}`}>
      <Icon className={compact ? "w-6 h-6" : "w-10 h-10"} />
      {!compact && label && (
        <span className="text-[9px] font-semibold tracking-wider uppercase">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Shared thumbnail body for document cards/rows. Renders:
 *  - the local preview URL (if provided, e.g. while a file is still uploading),
 *  - else a presigned image preview fetched from `documentKey`,
 *  - else a kind-aware fallback icon (image / PDF / generic).
 *
 * Always fills its parent (`w-full h-full`); the parent is responsible for
 * sizing and clipping (e.g. the `h-44` zone in an InboxFileCard).
 */
export function DocumentThumbContent({
  name,
  mimeType,
  documentKey,
  localPreviewUrl,
  fetchEnabled = true,
  compact = false,
}) {
  const kind = detectKind(name, mimeType, documentKey);

  // If we have a local URL (e.g. URL.createObjectURL) prefer it. Only images
  // can be previewed locally without a presigned URL anyway.
  const [resolvedUrl, setResolvedUrl] = useState(localPreviewUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const lastKeyRef = useRef(null);

  useEffect(() => {
    if (localPreviewUrl) {
      setResolvedUrl(localPreviewUrl);
      setError(false);
      return undefined;
    }

    // No previewable content possible
    if (!fetchEnabled || !documentKey || kind === "other") {
      setResolvedUrl(null);
      return undefined;
    }

    // Avoid refetching the same key
    if (lastKeyRef.current === documentKey && resolvedUrl) {
      return undefined;
    }

    let cancelled = false;
    lastKeyRef.current = documentKey;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const url = await AppApi.getPresignedPreviewUrl(documentKey);
        if (cancelled) return;
        setResolvedUrl(url);
      } catch (_err) {
        if (cancelled) return;
        setError(true);
        setResolvedUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey, localPreviewUrl, fetchEnabled, kind]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full text-gray-400 dark:text-gray-500">
        <Loader2 className={`animate-spin ${compact ? "w-4 h-4" : "w-6 h-6"}`} />
      </div>
    );
  }

  if (kind === "image" && resolvedUrl && !error) {
    return (
      <img
        src={resolvedUrl}
        alt={name || "Preview"}
        className="w-full h-full object-cover"
        draggable={false}
        onError={() => setError(true)}
      />
    );
  }

  if (kind === "pdf" && resolvedUrl && !error && !compact) {
    // Inline PDF render. We disable pointer events so dnd-kit / clicks pass
    // through to the parent card.
    return (
      <object
        data={`${resolvedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        type="application/pdf"
        className="w-full h-full pointer-events-none bg-white"
        aria-label={name || "PDF preview"}
      >
        <FallbackIcon kind="pdf" compact={compact} label="PDF" />
      </object>
    );
  }

  return (
    <FallbackIcon
      kind={kind}
      compact={compact}
      label={kind === "pdf" ? "PDF" : kind === "image" ? "IMG" : null}
    />
  );
}

export default DocumentThumbContent;
