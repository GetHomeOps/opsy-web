import React, {useState, useEffect, useCallback} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  FileUp,
  Video,
  Link,
  ExternalLink,
} from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import {getVideoThumbnailSync} from "../../utils/videoThumbnail";

/** Ensure HTML renders correctly (handles escaped entities and content shape). */
function getBodyHtml(content) {
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

/**
 * CommunicationViewer — Renders a communication for viewing by recipients.
 * Used when a recipient clicks a communication from the Discover feed on the Home page.
 */
function CommunicationViewer() {
  const {id} = useParams();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [communication, setCommunication] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachmentUrls, setAttachmentUrls] = useState({});
  const [communicationsList, setCommunicationsList] = useState([]);
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
    AppApi.getCommunicationsForRecipient()
      .then((list) => setCommunicationsList(list || []))
      .catch(() => setCommunicationsList([]));
  }, []);

  useEffect(() => {
    const imageAtts = attachments.filter(
      (a) => a.type === "image" && a.fileKey,
    );
    imageAtts.forEach((att) => {
      if (!attachmentUrls[att.fileKey]) {
        AppApi.getInlineImageUrl(att.fileKey)
          .then((url) =>
            setAttachmentUrls((prev) => ({...prev, [att.fileKey]: url})),
          )
          .catch(() => {});
      }
    });
    const pdfAtts = attachments.filter((a) => a.type === "pdf" && a.fileKey);
    pdfAtts.forEach((att) => {
      if (!attachmentUrls[att.fileKey]) {
        AppApi.getPresignedPreviewUrl(att.fileKey)
          .then((url) =>
            setAttachmentUrls((prev) => ({...prev, [att.fileKey]: url})),
          )
          .catch(() => {});
      }
    });
  }, [attachments]);

  const previewImageKey = communication?.imageKey;
  useEffect(() => {
    if (!previewImageKey) return;
    AppApi.getInlineImageUrl(previewImageKey)
      .then((url) =>
        setAttachmentUrls((prev) => ({...prev, [previewImageKey]: url})),
      )
      .catch(() => {});
  }, [previewImageKey]);

  const handleBack = () => navigate(`/${accountUrl}/home`);

  // Prev/next navigation
  const currentId = id ? parseInt(id, 10) : null;
  const sortedComms = [...communicationsList].sort((a, b) => {
    const aAt = a.sentAt || a.sent_at || a.createdAt || 0;
    const bAt = b.sentAt || b.sent_at || b.createdAt || 0;
    return new Date(bAt) - new Date(aAt);
  });
  const currentIndex = sortedComms.findIndex(
    (c) => (c.id ?? c.communication_id) === currentId,
  );
  const totalItems = sortedComms.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < totalItems - 1;

  const goPrev = () => {
    if (!hasPrev) return;
    const prev = sortedComms[currentIndex - 1];
    const prevId = prev.id ?? prev.communication_id;
    navigate(`/${accountUrl}/communications/${prevId}/view`);
  };
  const goNext = () => {
    if (!hasNext) return;
    const next = sortedComms[currentIndex + 1];
    const nextId = next.id ?? next.communication_id;
    navigate(`/${accountUrl}/communications/${nextId}/view`);
  };

  const bodyHtml = communication ? getBodyHtml(communication.content) : "";
  const firstImageAtt = attachments.find(
    (a) => a.type === "image" && a.fileKey,
  );
  const thumbnailUrl = previewImageKey
    ? attachmentUrls[previewImageKey] || null
    : firstImageAtt
      ? attachmentUrls[firstImageAtt.fileKey]
      : null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar: back + prev/next */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-lg">Back to Home</span>
        </button>

        {totalItems > 1 && currentIndex >= 0 && (
          <div className="flex items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
              {currentIndex + 1} / {totalItems}
            </span>
            <button
              className="btn shadow-none p-1"
              title="Previous"
              onClick={goPrev}
              disabled={!hasPrev}
            >
              <svg
                className={`fill-current shrink-0 ${
                  hasPrev
                    ? "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                    : "text-gray-200 dark:text-gray-700"
                }`}
                width="24"
                height="24"
                viewBox="0 0 18 18"
              >
                <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
              </svg>
            </button>
            <button
              className="btn shadow-none p-1"
              title="Next"
              onClick={goNext}
              disabled={!hasNext}
            >
              <svg
                className={`fill-current shrink-0 ${
                  hasNext
                    ? "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                    : "text-gray-200 dark:text-gray-700"
                }`}
                width="24"
                height="24"
                viewBox="0 0 18 18"
              >
                <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] py-16">
          <Loader2 className="w-10 h-10 text-[#456564] animate-spin mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] py-16">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || "Communication not found"}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-[#456564] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      )}

      {communication && !loading && (
        <article className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          {thumbnailUrl && (
            <div className="px-4 pt-4 sm:px-6 sm:pt-6">
              <div className="max-w-md mx-auto rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                <img
                  src={thumbnailUrl}
                  alt={communication.subject || ""}
                  className="w-full h-auto max-h-40 sm:max-h-44 object-cover"
                />
              </div>
            </div>
          )}

          <div className="p-6">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {communication.subject || "Untitled"}
            </h1>

            {bodyHtml && (
              <div
                className="prose prose-sm dark:prose-invert max-w-none mb-6 text-gray-700 dark:text-gray-300 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg"
                dangerouslySetInnerHTML={{__html: bodyHtml}}
              />
            )}

            {attachments.length > 0 && (
              <div className="space-y-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                {attachments.map((att, idx) => {
                  if (att.type === "image") {
                    const url = att.fileKey
                      ? attachmentUrls[att.fileKey]
                      : null;
                    return url ? (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full rounded-lg object-cover max-h-60 hover:opacity-90 transition-opacity cursor-pointer"
                        />
                      </a>
                    ) : null;
                  }
                  if (att.type === "pdf") {
                    const url = att.fileKey
                      ? attachmentUrls[att.fileKey]
                      : null;
                    return (
                      <a
                        key={idx}
                        href={url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors ${
                          url
                            ? "bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer"
                            : "bg-gray-50 dark:bg-gray-900/50 opacity-75 cursor-not-allowed pointer-events-none"
                        }`}
                        onClick={(e) => !url && e.preventDefault()}
                      >
                        <FileUp className="w-5 h-5 text-red-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {att.filename || "Document.pdf"}
                        </span>
                        {url && (
                          <ExternalLink className="w-4 h-4 shrink-0 text-gray-400" />
                        )}
                      </a>
                    );
                  }
                  if (att.type === "video_link" && att.url) {
                    const thumb = getVideoThumbnailSync(att.url);
                    return (
                      <div
                        key={idx}
                        className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50"
                      >
                        {thumb && (
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-40 object-cover"
                          />
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
                        <span className="text-sm truncate flex-1">
                          {att.url}
                        </span>
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
      )}
    </div>
  );
}

export default CommunicationViewer;
