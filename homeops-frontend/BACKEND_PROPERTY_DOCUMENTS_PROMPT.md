# Backend: Property Documents S3 Storage

Implement backend changes so property documents store the S3 object key (path) in the database, similar to how contact and user photos work. The frontend now sends `document_key` instead of `document_url` when creating property documents.

## Current Frontend Behavior

1. **Upload**: User selects file → `POST /documents/upload` (multipart/form-data with `file` field) → backend returns `{ document: { key, url } }`.
2. **Create**: Frontend sends `POST /propertyDocuments` with `document_key` (the S3 key):  
   ```json
   {
     "property_id": 1,
     "document_name": "AC Maintenance Receipt 2024",
     "document_date": "2024-06-15",
     "document_key": "documents/abc123/file.pdf",
     "document_type": "receipt",
     "system_key": "ac"
   }
   ```
3. **Display**: Frontend fetches presigned URL via `GET /documents/presigned-preview?key=<document_key>` for preview and "Open in new tab".

## Backend Changes Required

### 1. Database Schema

Add a `document_key` column to the `property_documents` table (or equivalent):

- `document_key` (string, nullable): S3 object key/path (e.g. `documents/abc123/file.pdf`)
- Keep `document_url` for backward compatibility if needed, or migrate/remove it

### 2. Create Property Document (POST /propertyDocuments)

- **Accept** `document_key` (required when creating) instead of or in addition to `document_url`
- Store `document_key` in the database
- Optionally: when returning the document, include a `document_url` by generating a presigned URL from the stored key (like contacts do with `image_url`)

### 3. List/Get Property Documents (GET endpoints)

- Return `document_key` in the response so the frontend can call `/documents/presigned-preview?key=<document_key>` for preview
- Optionally: return `document_url` as a presigned URL generated from `document_key` (for backward compatibility or convenience)

### 4. Existing Documents

- If you have existing rows with `document_url` but no `document_key`, you may need a migration or fallback logic:
  - Extract the key from the URL if it follows a known S3 URL pattern
  - Or leave `document_url` for legacy records and support both in responses

### 5. Alignment with Contacts/Users

Follow the same pattern used for contact `image` and user photos:
- Store the S3 key in the database
- Use the existing `/documents/upload` endpoint (already uploads to S3)
- Use the existing `/documents/presigned-preview?key=...` endpoint for secure access

## Summary

| Action | Before | After |
|--------|--------|-------|
| Create body | `document_url` (full URL) | `document_key` (S3 path) |
| Stored in DB | `document_url` | `document_key` |
| Display | Use `document_url` | Frontend calls `presigned-preview` with `document_key` |

Implement these changes in the property documents backend so the frontend can upload files to S3 and store only the path in `property_documents`.
