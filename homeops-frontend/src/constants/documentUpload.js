/** Must match homeops-backend/constants/documentUpload.js */
export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_DOCUMENT_UPLOAD_LABEL = "20 MB";

export function documentFileTooLargeMessage() {
  return `File is too large. The maximum upload size is ${MAX_DOCUMENT_UPLOAD_LABEL} per file.`;
}

/** Default document title from a staged file: trimmed basename without extension. */
export function defaultDocumentLabelFromFile(file) {
  const name = file?.name;
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return trimmed;
  const base = trimmed.slice(0, dot).trim();
  return base || trimmed;
}
