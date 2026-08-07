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
  AGENCIES: "agencies",
  /** Customer.io template icons (super admin, Email Delivery) */
  EMAIL_ASSETS: "email_assets",
  /** Account white-label logos / sidebar icons (platform admin Customization) */
  ACCOUNT_BRANDING: "account_branding",
  /** Agency white-label assets (same S3 prefix / admin gate as account branding) */
  AGENCY_BRANDING: "account_branding",
  /** Team white-label assets (same S3 prefix / admin gate as account branding) */
  TEAM_BRANDING: "account_branding",
  /** Pre-purchase analysis document uploads */
  PRE_PURCHASE: "pre_purchase",
};
