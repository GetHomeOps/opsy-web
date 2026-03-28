"use strict";

/** Single source of truth for authenticated document uploads (S3 via multer). */
const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_UPLOAD_LABEL = "10 MB";

function documentFileTooLargeMessage() {
  return `File is too large. The maximum upload size is ${MAX_DOCUMENT_UPLOAD_LABEL} per file.`;
}

module.exports = {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_DOCUMENT_UPLOAD_LABEL,
  documentFileTooLargeMessage,
};
