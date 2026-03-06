import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, FileUp, Video, Link, ExternalLink } from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import { DEFAULT_HEADER_IMAGE } from "../../utils/resourceThumbnail";

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
  if (raw.includes("&lt;") || raw.includes("&gt;") || raw.includes("&amp;")) {
    const el = document.createElement("div");
    el.innerHTML = raw;
    return el.innerHTML;
  }
  return raw;
}

/**
 * CommunicationViewer — Renders a communication for viewing by recipients.
 * Used when a recipient clicks a communication from the Discover feed on the Home page.
 */
function CommunicationViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [communication, setCommunication] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachmentUrls, setAttachmentUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCommunication = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await AppApi.getCommunicationView(id);
      setCommunication(res.communication);
      setAttachments(res.attachments || []);
    } catch (err) {
      setError(err?.message ?? "Failed to load communication");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCommunication();
  }, [fetchCommunication]);

  useEffect(() => {
    const imageAtts = attachments.filter((a) => a.type === "image" && a.fileKey);
    imageAtts.forEach((att) => {
      if (!attachmentUrls[att.fileKey]) {
        AppApi.getPresignedPreviewUrl(att.fileKey)
          .then((url) => setAttachmentUrls((prev) => ({ ...prev, [att.fileKey]: url })))
          .catch(() => {});
      }
    });
  }, [attachments]);

  const handleBack = () => navigate(`/${accountUrl}/home`);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] py-16">
        <Loader2 className="w-10 h-10 text-[#456564] animate-spin mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !communication) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] py-16">
        <p className="text-red-600 dark:text-red-400 mb-4">{error || "Communication not found"}</p>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-[#456564] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    );
  }

  const bodyHtml = getBodyHtml(communication.content);
  const previewImageKey = communication.imageKey;
  const firstImageAtt = attachments.find((a) => a.type === "image" && a.fileKey);
  const thumbnailUrl = previewImageKey
    ? (attachmentUrls[previewImageKey] || null)
    : (firstImageAtt ? attachmentUrls[firstImageAtt.fileKey] : null);

  useEffect(() => {
    if (!previewImageKey) return;
    AppApi.getPresignedPreviewUrl(previewImageKey)
      .then((url) => setAttachmentUrls((prev) => ({ ...prev, [previewImageKey]: url })))
      .catch(() => {});
  }, [previewImageKey]);

  return (
    <div className="max-w-2xl mx-auto">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-lg">Back to Home</span>
      </button>

      <article className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {/* Header / thumbnail - only show if we have an image */}
        {thumbnailUrl && (
          <div className="aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={thumbnailUrl}
              alt={communication.subject || ""}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {communication.subject || "Untitled"}
          </h1>

          {bodyHtml && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none mb-6 text-gray-700 dark:text-gray-300 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              {attachments.map((att, idx) => {
                if (att.type === "image") {
                  const url = att.fileKey ? attachmentUrls[att.fileKey] : null;
                  return url ? (
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      className="w-full rounded-lg object-cover max-h-60"
                    />
                  ) : null;
                }
                if (att.type === "pdf") {
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600"
                    >
                      <FileUp className="w-5 h-5 text-red-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {att.filename || "Document.pdf"}
                      </span>
                    </div>
                  );
                }
                if (att.type === "video_link" && att.url) {
                  const thumb = getVideoThumbnail(att.url);
                  return (
                    <div
                      key={idx}
                      className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50"
                    >
                      {thumb && (
                        <img src={thumb} alt="" className="w-full h-40 object-cover" />
                      )}
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 text-[#456564] dark:text-emerald-400 hover:underline"
                      >
                        <Video className="w-5 h-5 shrink-0" />
                        <span className="text-sm truncate">{att.url}</span>
                        <ExternalLink className="w-4 h-4 shrink-0" />
                      </a>
                    </div>
                  );
                }
                if (att.type === "web_link" && att.url) {
                  return (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <Link className="w-5 h-5 shrink-0 text-[#456564] dark:text-emerald-400" />
                      <span className="text-sm truncate flex-1">{att.url}</span>
                      <ExternalLink className="w-4 h-4 shrink-0 text-gray-400" />
                    </a>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

export default CommunicationViewer;
