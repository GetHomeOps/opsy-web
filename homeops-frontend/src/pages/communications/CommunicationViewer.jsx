import React, {useState, useEffect, useCallback} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {ArrowLeft, Loader2} from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import {LAYOUT_COMPONENTS} from "./partials/templateLayouts";
import {getEffectiveTemplateTheme} from "./partials/commTemplateContent";

/**
 * CommunicationViewer — Renders a communication for viewing by recipients.
 * Uses the same LAYOUT_COMPONENTS as the composer's live preview so the
 * recipient sees the communication with the author's chosen template
 * styling (colors, brand, footer) and layout.
 */
function CommunicationViewer() {
  const {id} = useParams();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [communication, setCommunication] = useState(null);
  const [template, setTemplate] = useState(null);
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
      setTemplate(res.template || null);
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
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  useEffect(() => {
    if (!previewImageKey) {
      setPreviewImageUrl(null);
      return;
    }
    AppApi.getInlineImageUrl(previewImageKey)
      .then(setPreviewImageUrl)
      .catch(() => setPreviewImageUrl(null));
  }, [previewImageKey]);

  const handleBack = () => navigate(`/${accountUrl}/home`);

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

  // Build the form-shaped object consumed by the layout components.
  const form = communication
    ? {
        subject: communication.subject || "",
        content: communication.content || {body: ""},
        imageKey: communication.imageKey || null,
        attachments: attachments || [],
      }
    : null;

  const layoutId = form?.content?.layout || "classic";
  const LayoutComponent = LAYOUT_COMPONENTS[layoutId] || LAYOUT_COMPONENTS.classic;
  const theme = getEffectiveTemplateTheme(form?.content, template, {
    preferContentSnapshot: true,
  });
  const {primaryColor, secondaryColor: bgColor, footerText} = theme;
  const layoutTemplate = template
    ? {
        ...template,
        brandName: theme.brandName,
        footerText: theme.footerText,
        primaryColor,
        secondaryColor: bgColor,
      }
    : {
        brandName: theme.brandName,
        footerText: theme.footerText,
        primaryColor,
        secondaryColor: bgColor,
        socialLinks: [],
      };

  return (
    <div className="max-w-3xl mx-auto">
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

      {form && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <LayoutComponent
            form={form}
            template={layoutTemplate}
            primaryColor={primaryColor}
            bgColor={bgColor}
            footerText={footerText}
            previewImageUrl={previewImageUrl}
            attachmentUrls={attachmentUrls}
            viewMode="desktop"
            editable={false}
          />
        </div>
      )}
    </div>
  );
}

export default CommunicationViewer;
