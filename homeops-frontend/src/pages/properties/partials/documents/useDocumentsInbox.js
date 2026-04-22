import { useCallback, useEffect, useReducer, useRef } from "react";
import AppApi, { buildApiUrl } from "../../../../api/api";
import { S3_UPLOAD_FOLDER } from "../../../../constants/s3UploadFolders";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  documentFileTooLargeMessage,
} from "../../../../constants/documentUpload";
import { guessFromFilename } from "./filenameHeuristics";

/**
 * useDocumentsInbox — staged-document state machine for the Documents tab.
 *
 * Owns the per-file upload pipeline (parallel XHR uploads with progress),
 * persists every uploaded file to the server (`stagedDocuments`), reloads
 * on mount, and exposes high-level actions for the UI:
 *
 *   addFiles(files[])      → push File objects through upload+stage
 *   updateProposed(id, p)  → debounced metadata edits
 *   removeStaged(id)       → DELETE
 *   fileOne(id, payload)   → POST /:id/file
 *   fileBulk(items)        → POST /file-bulk
 *
 * Cards live in two coordinate systems while uploading:
 *   - clientId: stable per render across status transitions
 *   - id: server staged_documents row id (set after upload completes)
 *
 * Allowed MIME / extensions and 25MB cap match the backend exactly.
 */

const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"];
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function isAcceptedFile(file) {
  if (!file) return false;
  if (ACCEPTED_MIME.has(file.type)) return true;
  const name = (file.name || "").toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function inferMimeFromName(name) {
  const lower = (name || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/* ------------------------- reducer ------------------------- */

const initialState = {
  byId: new Map(), // clientId -> card
  order: [],       // clientId[] (newest first)
  loading: true,
};

function nextClientId() {
  return `staged_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE": {
      const byId = new Map();
      const order = [];
      for (const row of action.rows) {
        const clientId = `srv_${row.id}`;
        byId.set(clientId, {
          clientId,
          id: row.id,
          status: row.upload_status === "error" ? "error" : "uploaded",
          progress: 100,
          file: null,
          previewUrl: null,
          name: row.original_name,
          sizeBytes: Number(row.file_size_bytes) || 0,
          mimeType: row.mime_type || inferMimeFromName(row.original_name),
          documentKey: row.document_key,
          proposed: {
            system_key: row.proposed_system_key || null,
            document_type: row.proposed_document_type || null,
            document_name:
              row.proposed_document_name ||
              row.original_name.replace(/\.[^.]+$/, ""),
            document_date:
              row.proposed_document_date ||
              new Date().toISOString().slice(0, 10),
          },
          error: row.error_message || null,
          createdAt: row.created_at,
        });
        order.push(clientId);
      }
      return { byId, order, loading: false };
    }
    case "ADD_QUEUED": {
      const byId = new Map(state.byId);
      const order = [...state.order];
      for (const card of action.cards) {
        byId.set(card.clientId, card);
        order.unshift(card.clientId);
      }
      return { ...state, byId, order };
    }
    case "PATCH": {
      const existing = state.byId.get(action.clientId);
      if (!existing) return state;
      const byId = new Map(state.byId);
      byId.set(action.clientId, { ...existing, ...action.patch });
      return { ...state, byId };
    }
    case "PATCH_PROPOSED": {
      const existing = state.byId.get(action.clientId);
      if (!existing) return state;
      const byId = new Map(state.byId);
      byId.set(action.clientId, {
        ...existing,
        proposed: { ...existing.proposed, ...action.patch },
      });
      return { ...state, byId };
    }
    case "REMOVE": {
      if (!state.byId.has(action.clientId)) return state;
      const byId = new Map(state.byId);
      byId.delete(action.clientId);
      const order = state.order.filter((id) => id !== action.clientId);
      return { ...state, byId, order };
    }
    case "REMOVE_MANY": {
      if (!action.clientIds?.length) return state;
      const set = new Set(action.clientIds);
      const byId = new Map(state.byId);
      for (const id of set) byId.delete(id);
      const order = state.order.filter((id) => !set.has(id));
      return { ...state, byId, order };
    }
    case "RESET":
      return { ...initialState, loading: false };
    default:
      return state;
  }
}

/* ------------------------- hook ------------------------- */

export default function useDocumentsInbox(propertyId, { allowedSystemKeys } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const propertyIdRef = useRef(propertyId);
  propertyIdRef.current = propertyId;

  const allowedRef = useRef(allowedSystemKeys);
  allowedRef.current = allowedSystemKeys;

  /* hydrate on mount + when property changes */
  useEffect(() => {
    let cancelled = false;
    if (!propertyId) {
      dispatch({ type: "RESET" });
      return;
    }
    (async () => {
      try {
        const rows = await AppApi.listStagedDocuments(propertyId);
        if (!cancelled) dispatch({ type: "HYDRATE", rows });
      } catch (err) {
        if (!cancelled) dispatch({ type: "HYDRATE", rows: [] });
        console.warn("[inbox] hydrate failed:", err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  /* ----- file upload pipeline ----- */

  const uploadOne = useCallback(
    (clientId, file) =>
      new Promise((resolve) => {
        const token = AppApi.getToken();
        if (!token) {
          dispatch({
            type: "PATCH",
            clientId,
            patch: { status: "error", error: "Authentication required" },
          });
          return resolve(null);
        }

        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_folder", S3_UPLOAD_FOLDER.PROPERTY_DOCUMENTS);

        xhr.upload.addEventListener("progress", (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          dispatch({
            type: "PATCH",
            clientId,
            patch: { progress: pct, status: "uploading" },
          });
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              const doc = res?.document ?? res;
              const key = doc?.key ?? doc?.s3Key;
              if (!key) {
                dispatch({
                  type: "PATCH",
                  clientId,
                  patch: { status: "error", error: "Upload returned no key" },
                });
                return resolve(null);
              }
              return resolve({ key });
            } catch (err) {
              dispatch({
                type: "PATCH",
                clientId,
                patch: { status: "error", error: err.message || "Bad upload response" },
              });
              return resolve(null);
            }
          }
          let msg = xhr.statusText || "Upload failed";
          try {
            const err = JSON.parse(xhr.responseText);
            msg = err?.error?.message || msg;
          } catch (_) {}
          dispatch({
            type: "PATCH",
            clientId,
            patch: { status: "error", error: msg },
          });
          resolve(null);
        });

        xhr.addEventListener("error", () => {
          dispatch({
            type: "PATCH",
            clientId,
            patch: { status: "error", error: "Network error during upload" },
          });
          resolve(null);
        });

        xhr.open("POST", buildApiUrl("documents/upload").toString());
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      }),
    [],
  );

  const stageOnServer = useCallback(async (clientId, card, key) => {
    const propId = propertyIdRef.current;
    if (!propId) return;
    try {
      const stagedRow = await AppApi.createStagedDocument({
        property_id: propId,
        document_key: key,
        original_name: card.name,
        file_size_bytes: card.sizeBytes,
        mime_type: card.mimeType,
        proposed_system_key: card.proposed.system_key,
        proposed_document_type: card.proposed.document_type,
        proposed_document_name: card.proposed.document_name,
        proposed_document_date: card.proposed.document_date,
      });
      dispatch({
        type: "PATCH",
        clientId,
        patch: {
          id: stagedRow.id,
          documentKey: stagedRow.document_key,
          status: "uploaded",
          progress: 100,
        },
      });
    } catch (err) {
      dispatch({
        type: "PATCH",
        clientId,
        patch: {
          status: "error",
          error: err?.message || "Failed to save staged document",
        },
      });
    }
  }, []);

  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;

      const allowed = allowedRef.current
        ? new Set(allowedRef.current)
        : null;

      const cards = [];
      for (const file of files) {
        const tooBig =
          typeof file.size === "number" && file.size > MAX_DOCUMENT_UPLOAD_BYTES;
        const unsupported = !isAcceptedFile(file);
        const guess = guessFromFilename(file.name, { allowedSystemKeys: allowed });

        const card = {
          clientId: nextClientId(),
          id: null,
          status: tooBig ? "error" : unsupported ? "error" : "queued",
          progress: 0,
          file,
          previewUrl:
            file.type?.startsWith?.("image/") ? URL.createObjectURL(file) : null,
          name: file.name,
          sizeBytes: file.size || 0,
          mimeType: file.type || inferMimeFromName(file.name),
          documentKey: null,
          proposed: {
            system_key: guess.system_key,
            document_type: guess.document_type,
            document_name: guess.document_name,
            document_date:
              guess.document_date || new Date().toISOString().slice(0, 10),
          },
          error: tooBig
            ? documentFileTooLargeMessage()
            : unsupported
              ? "Unsupported file type. Use PDF, JPG, PNG, GIF, or WebP."
              : null,
          createdAt: new Date().toISOString(),
        };
        cards.push(card);
      }

      dispatch({ type: "ADD_QUEUED", cards });

      // Kick off uploads in parallel for the valid ones
      await Promise.all(
        cards
          .filter((c) => c.status === "queued")
          .map(async (c) => {
            dispatch({
              type: "PATCH",
              clientId: c.clientId,
              patch: { status: "uploading", progress: 0 },
            });
            const result = await uploadOne(c.clientId, c.file);
            if (!result) return;
            await stageOnServer(c.clientId, c, result.key);
          }),
      );
    },
    [stageOnServer, uploadOne],
  );

  /* ----- metadata edits (debounced PATCH) ----- */

  const patchTimers = useRef(new Map());

  const updateProposed = useCallback((clientId, patch) => {
    dispatch({ type: "PATCH_PROPOSED", clientId, patch });
    const card = stateRef.current.byId.get(clientId);
    const id = card?.id;
    if (!id) return;
    const existing = patchTimers.current.get(clientId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      patchTimers.current.delete(clientId);
      const fresh = stateRef.current.byId.get(clientId);
      if (!fresh?.id) return;
      try {
        await AppApi.updateStagedDocument(fresh.id, {
          proposed_system_key: fresh.proposed.system_key,
          proposed_document_type: fresh.proposed.document_type,
          proposed_document_name: fresh.proposed.document_name,
          proposed_document_date: fresh.proposed.document_date,
        });
      } catch (err) {
        console.warn("[inbox] PATCH failed:", err.message);
      }
    }, 600);
    patchTimers.current.set(clientId, timer);
  }, []);

  // Stable ref to read state inside async/debounced callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ----- server actions ----- */

  const removeStaged = useCallback(async (clientId) => {
    const card = stateRef.current.byId.get(clientId);
    if (!card) return;
    if (card.previewUrl) URL.revokeObjectURL(card.previewUrl);
    if (card.id) {
      try {
        await AppApi.deleteStagedDocument(card.id);
      } catch (err) {
        console.warn("[inbox] DELETE failed:", err.message);
      }
    }
    dispatch({ type: "REMOVE", clientId });
  }, []);

  const removeMany = useCallback(async (clientIds) => {
    const cards = clientIds
      .map((id) => stateRef.current.byId.get(id))
      .filter(Boolean);
    cards.forEach((c) => c.previewUrl && URL.revokeObjectURL(c.previewUrl));
    dispatch({ type: "REMOVE_MANY", clientIds });
    await Promise.all(
      cards
        .filter((c) => c.id)
        .map((c) =>
          AppApi.deleteStagedDocument(c.id).catch((err) =>
            console.warn("[inbox] DELETE failed:", err.message),
          ),
        ),
    );
  }, []);

  /**
   * File one staged card into a system folder.
   * Returns the created property document or throws.
   */
  const fileOne = useCallback(async (clientId, payload) => {
    const card = stateRef.current.byId.get(clientId);
    if (!card?.id) throw new Error("Card has not finished uploading yet.");
    const document = await AppApi.fileStagedDocument(card.id, payload);
    if (card.previewUrl) URL.revokeObjectURL(card.previewUrl);
    dispatch({ type: "REMOVE", clientId });
    return document;
  }, []);

  /**
   * Bulk-file all cards in `items`. Each item is { clientId, system_key,
   * document_type, document_name, document_date }. On success removes them
   * from the inbox.
   */
  const fileBulk = useCallback(async (items) => {
    if (!items?.length) return { filed: [], errors: [] };
    const cards = items
      .map((it) => ({ ...it, card: stateRef.current.byId.get(it.clientId) }))
      .filter((it) => it.card?.id);

    if (!cards.length) throw new Error("No staged cards ready to file yet.");

    const apiItems = cards.map((it) => ({
      id: it.card.id,
      system_key: it.system_key,
      document_type: it.document_type,
      document_name: it.document_name,
      document_date: it.document_date,
    }));

    const res = await AppApi.fileStagedDocumentsBulk(apiItems);

    const filedClientIds = cards.map((c) => c.clientId);
    filedClientIds.forEach((cid) => {
      const c = stateRef.current.byId.get(cid);
      if (c?.previewUrl) URL.revokeObjectURL(c.previewUrl);
    });
    dispatch({ type: "REMOVE_MANY", clientIds: filedClientIds });
    return res;
  }, []);

  /* ----- cleanup object URLs on unmount ----- */
  useEffect(() => {
    return () => {
      patchTimers.current.forEach((t) => clearTimeout(t));
      patchTimers.current.clear();
      stateRef.current.byId.forEach((card) => {
        if (card.previewUrl) URL.revokeObjectURL(card.previewUrl);
      });
    };
  }, []);

  const cards = state.order.map((id) => state.byId.get(id)).filter(Boolean);

  return {
    cards,
    loading: state.loading,
    addFiles,
    updateProposed,
    removeStaged,
    removeMany,
    fileOne,
    fileBulk,
    isFileAccepted: isAcceptedFile,
  };
}
