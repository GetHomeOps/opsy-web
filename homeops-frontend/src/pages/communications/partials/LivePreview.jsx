import React, { useState, useEffect } from "react";
import AppApi from "../../../api/api";
import { Monitor, Smartphone } from "lucide-react";
import { LAYOUT_COMPONENTS } from "./templateLayouts";

function LivePreview({ form, template, onUpdateTemplate, editable = true }) {
  const [viewMode, setViewMode] = useState("desktop");
  const primaryColor = template?.primaryColor || "#456564";
  const bgColor = template?.secondaryColor || "#f9fafb";
  const footerText = template?.footerText || "";
  const layout = form.content?.layout || "classic";

  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [attachmentUrls, setAttachmentUrls] = useState({});

  useEffect(() => {
    if (!form.imageKey) {
      setPreviewImageUrl(null);
      return;
    }
    if (form.imageKey.startsWith("http") || form.imageKey.startsWith("blob:")) {
      setPreviewImageUrl(form.imageKey);
      return;
    }
    AppApi.getPresignedPreviewUrl(form.imageKey)
      .then(setPreviewImageUrl)
      .catch(() => setPreviewImageUrl(null));
  }, [form.imageKey]);

  useEffect(() => {
    const imageAtts = (form.attachments || []).filter(
      (a) => a.type === "image" && a.fileKey,
    );
    imageAtts.forEach((att) => {
      if (!attachmentUrls[att.fileKey]) {
        AppApi.getPresignedPreviewUrl(att.fileKey)
          .then((url) =>
            setAttachmentUrls((prev) => ({ ...prev, [att.fileKey]: url })),
          )
          .catch(() => {});
      }
    });
  }, [form.attachments]);

  const LayoutComponent = LAYOUT_COMPONENTS[layout] || LAYOUT_COMPONENTS.classic;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Live Preview
        </span>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("desktop")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "desktop"
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("mobile")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "mobile"
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frame area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-100/50 dark:bg-gray-900/30">
        {viewMode === "desktop" ? (
          <DesktopFrame>
            <LayoutComponent
              form={form}
              template={template}
              primaryColor={primaryColor}
              bgColor={bgColor}
              footerText={footerText}
              previewImageUrl={previewImageUrl}
              attachmentUrls={attachmentUrls}
              viewMode={viewMode}
              editable={editable}
              onUpdateTemplate={onUpdateTemplate}
            />
          </DesktopFrame>
        ) : (
          <MobileFrame>
            <LayoutComponent
              form={form}
              template={template}
              primaryColor={primaryColor}
              bgColor={bgColor}
              footerText={footerText}
              previewImageUrl={previewImageUrl}
              attachmentUrls={attachmentUrls}
              viewMode={viewMode}
              editable={editable}
              onUpdateTemplate={onUpdateTemplate}
            />
          </MobileFrame>
        )}
      </div>
    </div>
  );
}

function DesktopFrame({ children }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 shadow-md bg-white flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    </div>
  );
}

function MobileFrame({ children }) {
  return (
    <div className="mx-auto h-full flex flex-col" style={{ maxWidth: 375 }}>
      <div className="rounded-[2rem] overflow-hidden border-[3px] border-gray-800 dark:border-gray-500 shadow-lg bg-white flex flex-col flex-1 min-h-0">
        {/* Notch / status bar */}
        <div className="flex items-center justify-center py-1.5 bg-gray-800 dark:bg-gray-500 shrink-0">
          <div className="w-20 h-4 rounded-b-xl bg-gray-900 dark:bg-gray-600" />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {/* Home indicator */}
        <div className="flex justify-center py-2 bg-gray-50 shrink-0">
          <div className="w-28 h-1 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  );
}

export default LivePreview;
