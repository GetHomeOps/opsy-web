/** Must match homeops-backend/constants/documentUpload.js */
export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_DOCUMENT_UPLOAD_LABEL = "20 MB";

export function documentFileTooLargeMessage() {
  return `File is too large. The maximum upload size is ${MAX_DOCUMENT_UPLOAD_LABEL} per file.`;
}
