import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, BookOpen } from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import { getResourceThumbnailUrl, RESOURCE_THUMBNAIL_PLACEHOLDER, DEFAULT_HEADER_IMAGE } from "../../utils/resourceThumbnail";

/**
 * ResourceViewer — Renders a resource (post, video, article link, image) for viewing.
 * Used when Agent or Homeowner clicks a resource from the Home page.
 * Can also be used in preview mode with a resource prop (no fetch).
 */
function ResourceViewer({ resource: resourceProp, previewMode = false, previewAs = "homeowner" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [resource, setResource] = useState(resourceProp ?? null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(!resourceProp && !!id);
  const [error, setError] = useState(null);

  const fetchResource = useCallback(async () => {
    if (!id || previewMode) return;
    try {
      setLoading(true);
      setError(null);
      const data = await AppApi.getResourceView(id);
      setResource(data?.resource ?? data);
    } catch (err) {
      setError(err?.message ?? "Failed to load resource");
    } finally {
      setLoading(false);
    }
  }, [id, previewMode]);

  useEffect(() => {
    if (previewMode && resourceProp) {
      setResource(resourceProp);
      return;
    }
    if (!previewMode) {
      fetchResource();
    }
  }, [previewMode, resourceProp, fetchResource]);

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

  const handleBack = () => {
    if (previewMode) return;
    navigate(`/${accountUrl}/home`);
  };

  const title = resource?.subject || resource?.title || "Resource";
  const type = resource?.type || "post";
  const bodyText = resource?.bodyText || resource?.body_text || "";
  const url = resource?.url || resource?.linkUrl || "";
  const isExternal = url.startsWith("http");
  const resolvedImageUrl = resource?.imageUrl || imageUrl;
  const thumbnailUrl = getResourceThumbnailUrl(resource) || resolvedImageUrl || DEFAULT_HEADER_IMAGE;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] py-16">
        <Loader2 className="w-10 h-10 text-[#456564] animate-spin mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading resource…</p>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] py-16">
        <p className="text-red-600 dark:text-red-400 mb-4">{error || "Resource not found"}</p>
        {!previewMode && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-[#456564] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {previewMode && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Preview as: <span className="font-semibold">{previewAs === "agent" ? "Agent" : "Homeowner"}</span>
          </p>
        </div>
      )}

      {!previewMode && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-lg">Back to Home</span>
        </button>
      )}

      <article className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {/* Header / thumbnail — always show (uses Opsy-body.jpg default when none provided) */}
        <div className="relative">
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
          {/* Type badge */}
          <div className="absolute top-3 left-3">
            <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-[#456564] dark:text-emerald-400">
              {type === "article_link" ? "Web link" : (type?.replace("_", " ") || "Post")}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {title}
          </h1>

          {/* Post / Web link / PDF body */}
          {bodyText && (
            <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
              {resource?.contentFormat === "html" ? (
                <div dangerouslySetInnerHTML={{ __html: bodyText }} className="text-gray-700 dark:text-gray-300" />
              ) : (
                <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{bodyText}</p>
              )}
            </div>
          )}

          {/* Video / Web link / PDF */}
          {["video_link", "web_link", "article_link", "pdf"].includes(type) && url && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-900/50">
                {type === "video_link" && (
                  <VideoEmbed url={url} thumbnailUrl={thumbnailUrl} />
                )}
                {(type === "web_link" || type === "article_link" || type === "pdf") && (
                  <div className="p-4 flex gap-4">
                    {thumbnailUrl && type !== "pdf" && (
                      <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                        <img
                          src={thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER;
                          }}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#456564] dark:text-emerald-400 hover:underline break-all font-medium"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        {type === "pdf" ? "Open PDF" : "Open link"}
                      </a>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Opens in new tab
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video embed for video_link */}
          {type === "video_link" && (
            <div className="mt-4">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#456564] dark:text-emerald-400 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Watch on original site
              </a>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

/** Embeds YouTube or Vimeo when possible; otherwise shows thumbnail + link */
function VideoEmbed({ url, thumbnailUrl }) {
  const [embedUrl, setEmbedUrl] = useState(null);

  useEffect(() => {
    if (!url?.trim()) return;
    const trimmed = url.trim();

    // YouTube
    const ytMatch =
      trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/) ||
      trimmed.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      setEmbedUrl(`https://www.youtube.com/embed/${ytMatch[1]}`);
      return;
    }

    // Vimeo
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      setEmbedUrl(`https://player.vimeo.com/video/${vimeoMatch[1]}`);
      return;
    }

    setEmbedUrl(null);
  }, [url]);

  if (embedUrl) {
    return (
      <div className="aspect-video">
        <iframe
          src={embedUrl}
          title="Video"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-4 items-center group"
      >
        {thumbnailUrl && (
          <div className="flex-shrink-0 w-40 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
            <img
              src={thumbnailUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              onError={(e) => {
                e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER;
              }}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 text-[#456564] dark:text-emerald-400 font-medium group-hover:underline">
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            Watch video
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Opens in new tab
          </p>
        </div>
      </a>
    </div>
  );
}

export default ResourceViewer;
