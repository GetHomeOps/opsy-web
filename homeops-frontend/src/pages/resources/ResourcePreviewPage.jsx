import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import { ArrowLeft, ExternalLink, Loader2, FileText } from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import { getResourceThumbnailUrl, RESOURCE_THUMBNAIL_PLACEHOLDER, DEFAULT_HEADER_IMAGE } from "../../utils/resourceThumbnail";
import { PAGE_LAYOUT } from "../../constants/layout";

/**
 * Read-only preview showing the final communication as recipients will see it.
 * Opsy-branded layout with header, footer, and presentable styling.
 */
function ResourcePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const fetchResource = useCallback(async () => {
    if (!id || id === "new") return;
    try {
      setLoading(true);
      const data = await AppApi.getResource(id);
      setResource(data);
    } catch {
      setResource(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchResource();
  }, [fetchResource]);

  useEffect(() => {
    if (!resource?.imageKey) {
      setImageUrl(null);
      return;
    }
    if (resource.imageKey.startsWith("http")) {
      setImageUrl(resource.imageKey);
      return;
    }
    AppApi.getPresignedPreviewUrl(resource.imageKey)
      .then(setImageUrl)
      .catch(() => setImageUrl(null));
  }, [resource?.imageKey]);

  useEffect(() => {
    if (!resource?.pdfKey) {
      setPdfUrl(null);
      return;
    }
    AppApi.getPresignedPreviewUrl(resource.pdfKey)
      .then(setPdfUrl)
      .catch(() => setPdfUrl(null));
  }, [resource?.pdfKey]);

  const handleBack = () => navigate(`/${accountUrl}/resources/${id}`);

  if (loading || !resource) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 overflow-y-auto flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-10 h-10 animate-spin text-[#456564]" />
              <span>Loading preview…</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const title = resource.subject || "Untitled";
  const type = resource.type || "post";
  const bodyText = resource.bodyText || "";
  const url = resource.url || "";
  const resolvedImageUrl = resource.imageUrl || imageUrl;
  const thumbnailUrl = getResourceThumbnailUrl(resource) || resolvedImageUrl || DEFAULT_HEADER_IMAGE;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto">
          <div className={PAGE_LAYOUT.list}>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-lg">Back to edit</span>
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">Preview — read-only</span>
            </div>

            {/* Final communication preview — Opsy branded, presentable */}
            <div className="flex justify-center py-8 bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-900/80 dark:to-gray-900/50 min-h-[calc(100vh-12rem)]">
              <div className="w-full max-w-[680px] bg-white dark:bg-gray-800 shadow-2xl rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                {/* Opsy header */}
                <div className="px-8 py-6 bg-[#456564] text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">O</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">Opsy</h2>
                      <p className="text-xs text-white/80">Your home, simplified</p>
                    </div>
                  </div>
                </div>

                {/* Decorative border accent */}
                <div className="h-1 bg-gradient-to-r from-[#456564] via-[#5a7a78] to-[#456564]" />

                {/* Subject */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700/50">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {title}
                  </h1>
                </div>

                {/* Hero image / thumbnail — always show (uses Opsy-body.jpg default when none provided) */}
                <div className="aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={resolvedImageUrl || thumbnailUrl || DEFAULT_HEADER_IMAGE}
                    alt={title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      if (e.target.src !== RESOURCE_THUMBNAIL_PLACEHOLDER) {
                        e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER;
                      }
                    }}
                  />
                </div>

                {/* Body content — read-only */}
                <div className="px-8 py-8">
                  {["video_link", "web_link", "article_link", "pdf"].includes(type) && url && (
                    <div className="mb-6 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                      {type === "video_link" && thumbnailUrl && (
                        <div className="mb-4">
                          <img
                            src={thumbnailUrl}
                            alt=""
                            className="w-full rounded-lg"
                            onError={(e) => { e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER; }}
                          />
                        </div>
                      )}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#456564] dark:text-emerald-400 hover:underline break-all font-medium"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        {url}
                      </a>
                    </div>
                  )}

                  <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-[#456564] dark:prose-a:text-emerald-400">
                    {resource?.contentFormat === "html" ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: bodyText || "" }}
                        className="text-gray-700 dark:text-gray-300 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{bodyText || "(No message)"}</p>
                    )}
                  </div>

                  {/* PDF attachment (Post type) */}
                  {resource.pdfKey && pdfUrl && (
                    <div className="mt-6 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#456564] dark:text-emerald-400 hover:underline font-medium"
                      >
                        <FileText className="w-5 h-5 flex-shrink-0" />
                        View PDF attachment
                      </a>
                    </div>
                  )}
                </div>

                {/* Opsy footer */}
                <div className="px-8 py-6 bg-gray-50 dark:bg-gray-800/80 border-t-2 border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#456564]/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-[#456564]">O</span>
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Opsy</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Delivered via {resource.deliveryChannel === "email" ? "Email" : resource.deliveryChannel === "in_app" ? "Opsy app" : "Email + Opsy app"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ResourcePreviewPage;
