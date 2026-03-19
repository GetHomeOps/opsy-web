/**
 * Persists inspection upload / save / analysis progress per property in sessionStorage
 * so Passport Opsymization can resume messaging after modals close.
 */

const storageKey = (propertyId) =>
  `opsy:inspection-flow:${String(propertyId)}`;

export const INSPECTION_FLOW_EVENT = "opsy:inspection-flow";

export function getInspectionFlowState(propertyId) {
  if (!propertyId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(propertyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setInspectionFlowState(propertyId, payload) {
  if (!propertyId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(propertyId), JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent(INSPECTION_FLOW_EVENT, {
        detail: { propertyId: String(propertyId) },
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearInspectionFlowState(propertyId) {
  if (!propertyId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(propertyId));
    window.dispatchEvent(
      new CustomEvent(INSPECTION_FLOW_EVENT, {
        detail: { propertyId: String(propertyId) },
      }),
    );
  } catch {
    /* ignore */
  }
}

/** Human-readable line for the Passport Opsymization modal. */
export function inspectionFlowProgressMessage(flow) {
  if (!flow?.phase) return null;
  switch (flow.phase) {
    case "uploading": {
      const pct =
        typeof flow.progress === "number" && !Number.isNaN(flow.progress)
          ? ` ${flow.progress}%`
          : "";
      const name = flow.fileName ? ` (${flow.fileName})` : "";
      return `Uploading inspection report${name}${pct}…`;
    }
    case "saving":
      return "Saving inspection report to your property…";
    case "starting_analysis":
      return "Starting AI analysis…";
    case "analyzing":
      return (
        (typeof flow.progress === "string" && flow.progress) ||
        flow.progressMessage ||
        "Analysis in progress…"
      );
    default:
      return null;
  }
}
