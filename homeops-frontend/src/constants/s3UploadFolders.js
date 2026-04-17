/**
 * Values for multipart field `upload_folder` on POST /documents/upload.
 * Must match homeops-backend/constants/s3Upload.js (VALID_UPLOAD_FOLDERS).
 */
export const S3_UPLOAD_FOLDER = {
  DOCUMENTS: "documents",
  PROPERTY_DOCUMENTS: "property_documents",
  PROPERTY_PHOTOS: "property_photos",
  PROFESSIONALS: "professionals",
  USER_PHOTOS: "user_photos",
};
