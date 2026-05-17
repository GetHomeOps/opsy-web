"use strict";

/** Single source of truth for document uploads (S3 via multer; property docs + contractor report attachments). */
const MAX_DOCUMENT_UPLOAD_BYTES = 80 * 1024 * 1024;
const MAX_DOCUMENT_UPLOAD_LABEL = "80 MB";

function documentFileTooLargeMessage() {
  return `File is too large. The maximum upload size is ${MAX_DOCUMENT_UPLOAD_LABEL} per file.`;
}

module.exports = {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_DOCUMENT_UPLOAD_LABEL,
  documentFileTooLargeMessage,
};
