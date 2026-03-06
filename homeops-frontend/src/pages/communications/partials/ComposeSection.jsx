import React, { useState, useRef, useCallback } from "react";
import PostRichEditor from "../../../components/PostRichEditor";
import useImageUpload from "../../../hooks/useImageUpload";
import AppApi from "../../../api/api";
import {
  FileText,
  ImagePlus,
  FileUp,
  Video,
  Link,
  Trash2,
  Loader2,
  Palette,
  GripVertical,
  Image,
} from "lucide-react";

function ComposeSection({ form, updateForm, disabled, template, setTemplate, accountId }) {
  const [pdfUploading, setPdfUploading] = useState(false);
  const [inlineImageUploading, setInlineImageUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [addingLinkType, setAddingLinkType] = useState(null);
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const inlineImageInputRef = useRef(null);
  const inlineImageResolveRef = useRef(null);
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const previewImageInputRef = useRef(null);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

  const {
    uploadImage,
    imagePreviewUrl,
    imageUploading,
    clearPreview,
    accept: imageAccept,
  } = useImageUpload({
    onSuccess: (key) => {
      const current = form.attachments || [];
      updateForm({
        attachments: [...current, { type: "image", fileKey: key, filename: "Image" }],
      });
    },
  });

  const {
    uploadImage: uploadPreviewImage,
    imageUploading: previewImageUploading,
    imagePreviewUrl: previewImagePreviewUrl,
  } = useImageUpload({
    onSuccess: (key) => updateForm({ imageKey: key }),
  });

  React.useEffect(() => {
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

  const handleInlineImageSelect = useCallback(() => {
    return new Promise((resolve) => {
      inlineImageResolveRef.current = resolve;
      inlineImageInputRef.current?.click();
    });
  }, []);

  const handleInlineImageFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file?.type?.startsWith("image/")) {
      inlineImageResolveRef.current?.(null);
      inlineImageResolveRef.current = null;
      return;
    }
    setInlineImageUploading(true);
    try {
      const doc = await AppApi.uploadDocument(file);
      const key = doc?.key ?? doc?.s3Key ?? doc?.fileKey ?? doc?.objectKey;
      const finalUrl = key ? await AppApi.getInlineImageUrl(key) : null;
      inlineImageResolveRef.current?.(finalUrl || null);
    } catch {
      inlineImageResolveRef.current?.(null);
    } finally {
      inlineImageResolveRef.current = null;
      setInlineImageUploading(false);
    }
  }, []);

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || file.type !== "application/pdf") return;
    setPdfUploading(true);
    try {
      const doc = await AppApi.uploadDocument(file);
      const key = doc?.key ?? doc?.s3Key ?? doc?.fileKey ?? doc?.objectKey;
      if (key) {
        const current = form.attachments || [];
        updateForm({
          attachments: [...current, { type: "pdf", fileKey: key, filename: file.name }],
        });
      }
    } catch (err) {
      console.error("PDF upload failed:", err);
    } finally {
      setPdfUploading(false);
    }
  };

  const submitLink = () => {
    const url = linkUrlDraft?.trim();
    if (!url || !addingLinkType) return;
    const type = addingLinkType === "video" ? "video_link" : "web_link";
    const current = form.attachments || [];
    updateForm({
      attachments: [...current, { type, url, filename: addingLinkType === "video" ? "Video" : "Link" }],
    });
    setAddingLinkType(null);
    setLinkUrlDraft("");
  };

  const cancelLink = () => {
    setAddingLinkType(null);
    setLinkUrlDraft("");
  };

  const removeAttachment = (index) => {
    const next = [...(form.attachments || [])];
    next.splice(index, 1);
    updateForm({ attachments: next });
  };

  const handleTemplateUpdate = async (field, value) => {
    if (!template?.id) return;
    try {
      const updated = await AppApi.updateCommTemplate(template.id, { [field]: value });
      setTemplate(updated);
    } catch (err) {
      console.error("Template update failed:", err);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Section header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#456564]" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Compose
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowTemplateSettings((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showTemplateSettings
                ? "bg-[#456564]/10 text-[#456564] dark:text-[#5a7a78]"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Template
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Template settings (collapsible) */}
        {showTemplateSettings && template && (
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Template Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Primary color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={template.primaryColor || "#456564"}
                    onChange={(e) => handleTemplateUpdate("primaryColor", e.target.value)}
                    className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    disabled={disabled}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {template.primaryColor || "#456564"}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Background color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={template.secondaryColor || "#f9fafb"}
                    onChange={(e) => handleTemplateUpdate("secondaryColor", e.target.value)}
                    className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    disabled={disabled}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {template.secondaryColor || "#f9fafb"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Footer text
              </label>
              <input
                type="text"
                value={template.footerText || ""}
                onChange={(e) => handleTemplateUpdate("footerText", e.target.value)}
                placeholder="e.g. © 2026 Your Company"
                className="form-input w-full text-sm"
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div>
          <label htmlFor="comm-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            id="comm-subject"
            type="text"
            value={form.subject}
            onChange={(e) => updateForm({ subject: e.target.value })}
            disabled={disabled}
            className="form-input w-full text-base disabled:opacity-60"
            placeholder="e.g. Winter maintenance tips"
          />
        </div>

        {/* Preview image (card/header image for Discover) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Preview image
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Shown on the Discover card. Optional.
          </p>
          <div className="flex items-center gap-4">
            <input
              ref={previewImageInputRef}
              type="file"
              accept={imageAccept}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPreviewImage(file);
                e.target.value = "";
              }}
              className="hidden"
            />
            {form.imageKey ? (
              <div className="relative group/preview">
                <img
                  src={previewImageUrl || previewImagePreviewUrl || ""}
                  alt="Preview"
                  className="w-24 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                />
                <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                  {!disabled && (
                    <>
                      <button
                        type="button"
                        onClick={() => previewImageInputRef.current?.click()}
                        disabled={previewImageUploading}
                        className="px-2 py-1 rounded bg-white/90 text-gray-900 text-xs font-medium"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm({ imageKey: null })}
                        className="px-2 py-1 rounded bg-white/90 text-red-600 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
            {!disabled && (
              <button
                type="button"
                onClick={() => previewImageInputRef.current?.click()}
                disabled={previewImageUploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564] text-sm transition-colors disabled:opacity-50"
              >
                {previewImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                {previewImageUploading ? "Uploading…" : (form.imageKey ? "Change" : "Add preview image")}
              </button>
            )}
          </div>
        </div>

        {/* Video link, Doc link, Optional message */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add links
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAddingLinkType((t) => (t === "video" ? null : "video"))}
                disabled={disabled}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed text-sm transition-colors disabled:opacity-50 ${
                  addingLinkType === "video"
                    ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:bg-[#456564]/20 dark:text-[#5a7a78]"
                    : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564]"
                }`}
              >
                <Video className="w-4 h-4" />
                Video link
              </button>
              <button
                type="button"
                onClick={() => setAddingLinkType((t) => (t === "doc" ? null : "doc"))}
                disabled={disabled}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed text-sm transition-colors ${
                  addingLinkType === "doc"
                    ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:bg-[#456564]/20 dark:text-[#5a7a78]"
                    : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564]"
                }`}
              >
                <Link className="w-4 h-4" />
                Doc / page link
              </button>
            </div>
            {addingLinkType && (
              <div className="mt-3 flex gap-2">
                <input
                  type="url"
                  value={linkUrlDraft}
                  onChange={(e) => setLinkUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitLink();
                    if (e.key === "Escape") cancelLink();
                  }}
                  placeholder={
                    addingLinkType === "video"
                      ? "https://youtube.com/watch?v=… or https://vimeo.com/…"
                      : "https://…"
                  }
                  className="form-input flex-1 text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={submitLink}
                  disabled={!linkUrlDraft?.trim()}
                  className="px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={cancelLink}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Optional message
            </label>
            <input
            ref={inlineImageInputRef}
            type="file"
            accept={imageAccept}
            onChange={handleInlineImageFileChange}
            className="hidden"
            tabIndex={-1}
            aria-hidden
          />
          <PostRichEditor
            key={form.status || "editor"}
            value={form.content?.body || ""}
            onChange={(html) => updateForm({ content: { ...form.content, body: html } })}
            placeholder="Write your message…"
            disabled={disabled || inlineImageUploading}
            onImageSelect={handleInlineImageSelect}
            minHeight="220px"
          />
          </div>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Attachments
          </label>

          {/* Existing attachments */}
          {(form.attachments || []).length > 0 && (
            <div className="space-y-2 mb-3">
              {form.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    {att.type === "image" && <ImagePlus className="w-4 h-4 text-blue-500" />}
                    {att.type === "pdf" && <FileUp className="w-4 h-4 text-red-500" />}
                    {att.type === "video_link" && <Video className="w-4 h-4 text-purple-500" />}
                    {att.type === "web_link" && <Link className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {att.filename || att.url || att.type}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{att.type?.replace("_", " ")}</p>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add attachment buttons */}
          {!disabled && (
            <div className="flex flex-wrap gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept={imageAccept}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564] text-sm transition-colors disabled:opacity-50"
              >
                {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {imageUploading ? "Uploading…" : "Image"}
              </button>

              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={pdfUploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564] text-sm transition-colors disabled:opacity-50"
              >
                {pdfUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                {pdfUploading ? "Uploading…" : "PDF"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ComposeSection;
