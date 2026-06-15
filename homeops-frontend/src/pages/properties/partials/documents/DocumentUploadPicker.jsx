import React, {forwardRef} from "react";
import {CheckCircle2, FileText, Upload} from "lucide-react";
import {MAX_DOCUMENT_UPLOAD_LABEL} from "../../../../constants/documentUpload";

function formatFileSize(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return null;
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const DocumentUploadPicker = forwardRef(function DocumentUploadPicker(
  {files = [], onFilesChange, multiple = true, disabled = false},
  ref,
) {
  const openPicker = () => {
    if (!disabled) ref?.current?.click();
  };

  const handleInputChange = (e) => {
    const nextFiles = Array.from(e.target.files || []);
    onFilesChange?.(nextFiles);
    e.target.value = "";
  };

  return (
    <div>
      <input
        ref={ref}
        type="file"
        multiple={multiple}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        disabled={disabled}
        onChange={handleInputChange}
      />

      {files.length === 0 ? (
        <div
          onClick={openPicker}
          className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-5 text-center transition-colors group ${
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:border-emerald-400 dark:hover:border-emerald-500 cursor-pointer"
          }`}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-gray-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            PDF, JPG, PNG, GIF, WebP — up to {MAX_DOCUMENT_UPLOAD_LABEL} each
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
              {files.length === 1 ? (
                <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {files.length === 1
                  ? "File ready to upload"
                  : `${files.length} files ready to upload`}
              </p>
              {files.length === 1 ? (
                <>
                  <p
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1 truncate"
                    title={files[0].name}
                  >
                    {files[0].name}
                  </p>
                  {formatFileSize(files[0].size) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatFileSize(files[0].size)}
                    </p>
                  )}
                </>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 min-w-0 text-sm text-gray-800 dark:text-gray-200"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate" title={file.name}>
                        {file.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="mt-3 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline-offset-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {multiple ? "Choose different files" : "Replace file"}
          </button>
        </div>
      )}
    </div>
  );
});

export default DocumentUploadPicker;
