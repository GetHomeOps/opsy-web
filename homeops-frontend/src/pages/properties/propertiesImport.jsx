import React, { useState, useCallback, useMemo, useRef, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  PROPERTY_IMPORT_KEYS,
  PROPERTY_IMPORT_FIELDS,
  normalizeHeader,
  getTemplateRow,
} from "../../data/propertyImportSchema";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import propertyContext from "../../context/PropertyContext";
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Loader2,
  FileCheck,
  Home,
  ArrowLeft,
  Clock,
  Search,
} from "lucide-react";

const PREVIEW_PAGE_SIZE = 50;

/** ATTOM job statuses that represent a terminal result (no further polling). */
const ATTOM_TERMINAL_STATUSES = new Set(["completed", "failed", "skipped"]);

/** How often we re-poll ATTOM status for still-pending imported properties.
 *  The backend queue throttles calls to ~1/sec, so polling faster than this
 *  just wastes requests. */
const ATTOM_POLL_INTERVAL_MS = 4000;

/** Table column layout: address & city get more horizontal space; state/zip stay compact. */
const IMPORT_COLUMN_TH_CLASS = {
  property_name: "min-w-[12rem] lg:min-w-[14rem] max-w-[20rem]",
  address: "min-w-[20rem] sm:min-w-[24rem] lg:min-w-[28rem]",
  city: "min-w-[11rem] sm:min-w-[13rem] lg:min-w-[16rem] max-w-[20rem]",
  state: "min-w-20 w-24",
  zip: "min-w-24 w-32",
};

const IMPORT_COLUMN_TD_CLASS = {
  property_name: "align-top break-words min-w-0",
  address: "align-top break-words min-w-0",
  city: "align-top break-words min-w-0",
  state: "align-top whitespace-nowrap",
  zip: "align-top whitespace-nowrap",
};

function rowToPropertyPayload(row, accountId) {
  const payload = {
    address: (row.address || "").trim(),
    city: (row.city || "").trim(),
    state: (row.state || "").trim(),
    zip: (row.zip || "").trim(),
    // Ask the backend to enqueue an ATTOM public-records lookup for this new
    // property. The queue throttles ATTOM calls so bulk imports of any size
    // stay within rate limits; status is surfaced per-property on IdentityTab.
    enqueueAttomLookup: true,
  };
  const propertyName = (row.property_name || "").trim();
  if (propertyName) payload.property_name = propertyName;
  if (accountId) payload.account_id = accountId;
  return payload;
}

function isEmptyRow(cellValues) {
  return Object.values(cellValues).every(
    (v) => v == null || String(v).trim() === ""
  );
}

function normalizeRow(rawRow, headerMap) {
  const row = {};
  for (const [rawHeader, value] of Object.entries(rawRow)) {
    const key = headerMap.get(rawHeader);
    if (key) {
      const v = value == null ? "" : String(value).trim();
      row[key] = v;
    }
  }
  return PROPERTY_IMPORT_KEYS.reduce((acc, k) => {
    acc[k] = row[k] ?? "";
    return acc;
  }, {});
}

function validateRow(row) {
  const errors = [];
  const requiredKeys = PROPERTY_IMPORT_FIELDS.filter((f) => f.required).map(
    (f) => f.key
  );
  for (const key of requiredKeys) {
    const val = (row[key] ?? "").trim();
    if (!val) errors.push(`${key} is required`);
  }
  return errors;
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, {
          type: isCsv ? "string" : "binary",
          raw: false,
        });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
        if (!json.length) {
          resolve({ rows: [], headerMap: new Map() });
          return;
        }
        const rawHeaders = Object.keys(json[0]);
        const headerMap = new Map();
        rawHeaders.forEach((h) => {
          const key = normalizeHeader(h);
          if (key) headerMap.set(h, key);
        });
        const rows = json
          .map((raw) => normalizeRow(raw, headerMap))
          .filter((r) => !isEmptyRow(r));
        resolve({ rows, headerMap });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    if (isCsv) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

function buildWorkbookForDownload() {
  const row = getTemplateRow();
  const ws = XLSX.utils.json_to_sheet([
    Object.fromEntries(
      PROPERTY_IMPORT_FIELDS.map((f) => [f.label, row[f.key]])
    ),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Properties");
  return wb;
}

function downloadXlsxTemplate() {
  const wb = buildWorkbookForDownload();
  XLSX.writeFile(wb, "property_import_template.xlsx");
}

const STEPS = [
  { id: 1, label: "Get template", short: "Template" },
  { id: 2, label: "Upload & import", short: "Upload" },
  { id: 3, label: "Review & confirm", short: "Review" },
];

/** Compute the row-level visual theme for a preview-table row.
 *
 *  Returns Tailwind classes for the row background, a left stripe on the first
 *  cell, and a small leading marker next to the row number (dot or check).
 *  Rows that finished with public-records data use a green check only — no
 *  full-row green tint — so success reads clearly without fighting zebra rows. */
function getRowTheme({ valid, postImport, entry, zebra }) {
  const zebraBg = zebra
    ? "bg-gray-50/80 dark:bg-gray-800/50"
    : "bg-white dark:bg-gray-800/30";
  const zebraHover = "hover:bg-gray-50 dark:hover:bg-gray-800/50";

  if (!postImport) {
    if (valid) {
      return {
        rowClass: `${zebraBg} ${zebraHover}`,
        stripeClass: "border-l-4 border-transparent",
        leading: null,
      };
    }
    return {
      rowClass:
        "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20",
      stripeClass: "border-l-4 border-amber-400 dark:border-amber-500/70",
      leading: { kind: "dot", className: "bg-amber-500", pulse: false },
    };
  }

  // Post-import. Invalid rows were not imported at all.
  if (!valid) {
    return {
      rowClass: "bg-gray-50/40 dark:bg-gray-800/30 text-gray-400",
      stripeClass: "border-l-4 border-gray-300 dark:border-gray-600",
      leading: { kind: "dot", className: "bg-gray-300 dark:bg-gray-600", pulse: false },
    };
  }

  const status = entry?.status ?? null;

  if (status === "create_failed") {
    return {
      rowClass: "bg-red-50/70 dark:bg-red-900/15",
      stripeClass: "border-l-4 border-red-500",
      leading: { kind: "dot", className: "bg-red-500", pulse: false },
    };
  }

  if (status === "failed") {
    return {
      rowClass: "bg-amber-50/60 dark:bg-amber-900/15",
      stripeClass: "border-l-4 border-amber-500",
      leading: { kind: "dot", className: "bg-amber-500", pulse: false },
    };
  }

  if (status === "completed") {
    const filled = (entry?.populatedKeys?.length ?? 0) > 0;
    if (filled) {
      return {
        rowClass: `${zebraBg} ${zebraHover}`,
        stripeClass: "border-l-4 border-transparent",
        leading: { kind: "check" },
      };
    }
    return {
      rowClass: zebraBg,
      stripeClass: "border-l-4 border-gray-300 dark:border-gray-600",
      leading: { kind: "dot", className: "bg-gray-400 dark:bg-gray-500", pulse: false },
    };
  }

  if (status === "skipped") {
    return {
      rowClass: zebraBg,
      stripeClass: "border-l-4 border-gray-300 dark:border-gray-600",
      leading: { kind: "dot", className: "bg-gray-400 dark:bg-gray-500", pulse: false },
    };
  }

  // "queued", "processing", or null (no job row yet): loading state.
  return {
    rowClass: "bg-blue-50/50 dark:bg-blue-900/15",
    stripeClass: "border-l-4 border-blue-500 dark:border-blue-400",
    leading: {
      kind: "dot",
      className: "bg-blue-500 dark:bg-blue-400",
      pulse: true,
    },
  };
}

/** Status cell rendered per-row in the review table after the user clicks
 *  "Confirm import". Shows live ATTOM enrichment progress (queued → looking
 *  up → filled / not found / failed) for a single imported property, so the
 *  user sees exactly which rows got data and which didn't. */
function AttomRowStatus({ entry }) {
  if (!entry) return null;

  if (entry.status === "create_failed") {
    const detail = (entry.errorMessage || "").trim();
    return (
      <span
        className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 text-sm font-medium"
        title={detail || "Couldn't create this property"}
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Couldn&apos;t create
      </span>
    );
  }

  if (entry.status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium">
        <Search className="w-3.5 h-3.5 animate-pulse shrink-0" />
        Looking up…
      </span>
    );
  }

  if (entry.status === "completed") {
    const count = entry.populatedKeys?.length ?? 0;
    if (count > 0) {
      return (
        <span
          className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-sm font-medium"
          title={`Filled ${count} field${count !== 1 ? "s" : ""} from public records`}
        >
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          Details filled
          <span className="text-xs font-normal text-green-600/80 dark:text-green-300/70">
            ({count})
          </span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm"
        title="No new public-records data was available for this address"
      >
        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
        No new details
      </span>
    );
  }

  if (entry.status === "failed") {
    const detail = (entry.errorMessage || "").trim();
    const message = detail || "Property could not be found. Please verify the address and try again.";
    return (
      <span
        className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 text-sm font-medium"
        title={message}
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        No data was found for this property
      </span>
    );
  }

  if (entry.status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm">
        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
        Skipped
      </span>
    );
  }

  /* "queued" or null (no job row yet — first poll hasn't landed). */
  return (
    <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      Queued…
    </span>
  );
}

function PropertiesImport() {
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";
  const { refreshProperties } = useContext(propertyContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccessCount, setImportSuccessCount] = useState(null);
  const [previewFilter, setPreviewFilter] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const previewSectionRef = useRef(null);

  /* After the user clicks "Confirm import", we track per-row outcome here.
   * Keyed by the row's index in `allRows` so the preview table can swap its
   * validation status cell for a live ATTOM progress chip on the exact same
   * row the user already sees.
   *
   * Shape: { [rowIndex]: {
   *   propertyId: number | null,  // null => create failed
   *   status: "queued" | "processing" | "completed" | "failed" | "skipped" | "create_failed" | null,
   *   errorMessage: string | null,
   *   populatedKeys: string[],
   *   updatedAt: string | null,
   * } } */
  const [importedStatuses, setImportedStatuses] = useState({});
  const importedStatusesRef = useRef(importedStatuses);
  useEffect(() => {
    importedStatusesRef.current = importedStatuses;
  }, [importedStatuses]);

  const currentStep = allRows.length > 0 ? 3 : pendingFile ? 2 : 1;

  const displayRows = useMemo(() => {
    return allRows.map((row, i) => {
      const valid = validRows.some((r) => r === row);
      const errors = rowErrors[i] || [];
      return { row, index: i, valid, errors };
    });
  }, [allRows, validRows, rowErrors]);

  const filteredDisplayRows = useMemo(() => {
    if (previewFilter === "valid")
      return displayRows.filter((d) => d.valid);
    if (previewFilter === "invalid")
      return displayRows.filter((d) => !d.valid);
    return displayRows;
  }, [displayRows, previewFilter]);

  const visibleRows = useMemo(() => {
    if (showAllRows) return filteredDisplayRows;
    return filteredDisplayRows.slice(0, PREVIEW_PAGE_SIZE);
  }, [filteredDisplayRows, showAllRows]);

  const totalRows = allRows.length;
  const validCount = validRows.length;
  const invalidCount = invalidRows.length;
  const hasMore = filteredDisplayRows.length > PREVIEW_PAGE_SIZE;

  const runImport = useCallback(() => {
    if (!pendingFile) return;
    const name = (pendingFile.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      setParseError("Please upload a .xlsx or .csv file.");
      return;
    }
    setParseError("");
    setImportError(null);
    setImportSuccessCount(null);
    setImportedStatuses({});
    setIsParsing(true);
    const fileToParse = pendingFile;
    parseFile(fileToParse)
      .then(({ rows }) => {
        if (rows.length === 0) {
          setParseError(
            "No data rows found. Your file needs a header row (Property Name, Address, City, State, Zip) and at least one data row."
          );
          setIsParsing(false);
          return;
        }
        const valid = [];
        const invalid = [];
        const errorsByIndex = {};
        rows.forEach((row, i) => {
          const errs = validateRow(row);
          if (errs.length) {
            invalid.push(row);
            errorsByIndex[i] = errs;
          } else {
            valid.push(row);
          }
        });
        setAllRows(rows);
        setValidRows(valid);
        setInvalidRows(invalid);
        setRowErrors(errorsByIndex);
        setPendingFile(null);
        setIsParsing(false);
        requestAnimationFrame(() => {
          previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      })
      .catch((err) => {
        setParseError(err?.message || "Failed to parse file.");
        setAllRows([]);
        setValidRows([]);
        setInvalidRows([]);
        setRowErrors({});
        setIsParsing(false);
      });
  }, [pendingFile]);

  const handleFileSelect = useCallback((fileObj) => {
    if (!fileObj) return;
    const name = (fileObj.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      setParseError("Please choose a .xlsx or .csv file.");
      return;
    }
    setParseError("");
    setImportError(null);
    setImportSuccessCount(null);
    setImportedStatuses({});
    setPendingFile(fileObj);
    setAllRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setRowErrors({});
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e) => {
      const f = e.target?.files?.[0];
      if (f) handleFileSelect(f);
      e.target.value = "";
    },
    [handleFileSelect]
  );

  const handleChangeFile = useCallback(() => {
    setPendingFile(null);
    setParseError("");
    setImportError(null);
    setImportSuccessCount(null);
    setImportedStatuses({});
    setAllRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setRowErrors({});
  }, []);

  const handleRemoveRow = useCallback((index) => {
    const nextRows = allRows.filter((_, i) => i !== index);
    setAllRows(nextRows);
    if (nextRows.length === 0) {
      setValidRows([]);
      setInvalidRows([]);
      setRowErrors({});
      return;
    }
    const valid = [];
    const invalid = [];
    const errorsByIndex = {};
    nextRows.forEach((row, i) => {
      const errs = validateRow(row);
      if (errs.length) {
        invalid.push(row);
        errorsByIndex[i] = errs;
      } else {
        valid.push(row);
      }
    });
    setValidRows(valid);
    setInvalidRows(invalid);
    setRowErrors(errorsByIndex);
  }, [allRows]);

  const handleConfirmImport = useCallback(async () => {
    if (validRows.length < 1 || isSubmitting || importSuccessCount != null) return;
    setImportError(null);
    setIsSubmitting(true);
    const accountId = currentAccount?.id ?? null;
    if (!accountId) {
      setImportError("No account selected.");
      setIsSubmitting(false);
      return;
    }

    /* Map each valid row back to its index in allRows so the preview table
     * can swap its status cell in place once results come back. We freeze the
     * list here — later removals would break row-index alignment with the
     * results we're about to receive. */
    const items = validRows.map((row) => ({
      row,
      rowIndex: allRows.indexOf(row),
      payload: rowToPropertyPayload(row, accountId),
    }));

    /* allSettled so one bad row doesn't abort the whole batch. The UI marks
     * failed creates per-row ("Couldn't create") while still showing ATTOM
     * progress for the successful ones. */
    const results = await Promise.allSettled(
      items.map((item) => AppApi.createProperty(item.payload))
    );

    const nextStatuses = {};
    let successCount = 0;
    const firstError = [];
    results.forEach((result, i) => {
      const { rowIndex } = items[i];
      if (result.status === "fulfilled") {
        successCount += 1;
        nextStatuses[rowIndex] = {
          propertyId: result.value?.id ?? null,
          status: "queued",
          errorMessage: null,
          populatedKeys: [],
          updatedAt: null,
        };
      } else {
        const err = result.reason;
        const message = Array.isArray(err)
          ? err.join(" ")
          : err?.message || "Couldn't create this property.";
        if (firstError.length === 0) firstError.push(message);
        nextStatuses[rowIndex] = {
          propertyId: null,
          status: "create_failed",
          errorMessage: message,
          populatedKeys: [],
          updatedAt: null,
        };
      }
    });

    setImportedStatuses(nextStatuses);
    setImportSuccessCount(successCount);
    setPreviewFilter("all");
    setIsSubmitting(false);

    if (successCount < items.length && firstError.length > 0) {
      const failed = items.length - successCount;
      setImportError(
        `${failed} of ${items.length} propert${failed !== 1 ? "ies" : "y"} couldn't be created. First error: ${firstError[0]}`
      );
    }

    if (successCount > 0) {
      try {
        await refreshProperties?.();
      } catch (_) {
        /* non-fatal — the property list page will reload on next visit. */
      }
    }
  }, [validRows, allRows, currentAccount?.id, isSubmitting, importSuccessCount, refreshProperties]);

  /* Poll ATTOM status for imported properties until every one reaches a
   * terminal state. We batch all pending ids into a single request so a
   * 50-property import makes one HTTP call per tick instead of 50. The
   * effect re-arms itself based on `importSuccessCount` and
   * `currentAccount?.id` only — the interval reads fresh statuses from the
   * ref on every tick, so state updates don't restart polling. */
  useEffect(() => {
    if (importSuccessCount == null) return undefined;
    const accountId = currentAccount?.id ?? null;
    if (!accountId) return undefined;

    let cancelled = false;

    const pendingPropertyIds = () => {
      const out = [];
      for (const entry of Object.values(importedStatusesRef.current)) {
        if (!entry?.propertyId) continue;
        if (ATTOM_TERMINAL_STATUSES.has(entry.status)) continue;
        out.push(entry.propertyId);
      }
      return out;
    };

    const tick = async () => {
      const ids = pendingPropertyIds();
      if (ids.length === 0) return;
      try {
        const { statuses } = await AppApi.getAttomLookupStatuses({
          accountId,
          propertyIds: ids,
        });
        if (cancelled || !statuses) return;
        setImportedStatuses((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const [rowIndex, entry] of Object.entries(prev)) {
            if (!entry?.propertyId) continue;
            const job = statuses[entry.propertyId];
            if (!job) continue;
            const nextStatus = job.status || entry.status;
            if (
              nextStatus === entry.status &&
              job.updatedAt === entry.updatedAt &&
              (job.populatedKeys?.length ?? 0) === entry.populatedKeys.length
            ) {
              continue;
            }
            next[rowIndex] = {
              ...entry,
              status: nextStatus,
              errorMessage: job.errorMessage ?? entry.errorMessage,
              populatedKeys: Array.isArray(job.populatedKeys)
                ? job.populatedKeys
                : entry.populatedKeys,
              updatedAt: job.updatedAt ?? entry.updatedAt,
            };
            changed = true;
          }
          return changed ? next : prev;
        });
      } catch (_) {
        /* transient network/server errors: retry on the next tick. */
      }
    };

    tick();
    const intervalId = setInterval(() => {
      if (pendingPropertyIds().length === 0) return;
      tick();
    }, ATTOM_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [importSuccessCount, currentAccount?.id]);

  /* Live progress stats for the summary banner and row-count chips. */
  const attomProgress = useMemo(() => {
    const entries = Object.values(importedStatuses);
    let total = 0;
    let complete = 0;
    let filled = 0;
    let failed = 0;
    let createFailed = 0;
    for (const e of entries) {
      total += 1;
      if (e.status === "create_failed") {
        createFailed += 1;
        continue;
      }
      if (ATTOM_TERMINAL_STATUSES.has(e.status)) {
        complete += 1;
        if (e.status === "completed" && e.populatedKeys.length > 0) filled += 1;
        if (e.status === "failed") failed += 1;
      }
    }
    const importedTotal = total - createFailed;
    const allDone = importSuccessCount != null && complete === importedTotal;
    return { total, complete, filled, failed, createFailed, importedTotal, allDone };
  }, [importedStatuses, importSuccessCount]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-6 lg:px-8 xxl:px-16 py-6 w-full max-w-7xl mx-auto">
            <nav className="mb-6">
              <button
                type="button"
                onClick={() => navigate(`/${accountUrl}/properties`)}
                className="flex items-center gap-2 text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors py-1"
              >
                <ArrowLeft className="w-5 h-5 shrink-0" />
                Properties
              </button>
            </nav>

            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-1">
                Bulk Property Import
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Download a template, add properties (address required), then upload and review.
                Photos are not part of the import file—add them on each property after import.
              </p>
            </div>

            <div className="mb-6 flex items-center gap-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-1 shadow-sm">
              {STEPS.map((step, i) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentStep === step.id
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : currentStep > step.id
                          ? "text-gray-600 dark:text-gray-400"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        currentStep === step.id
                          ? "bg-white/20 dark:bg-gray-900/20"
                          : currentStep > step.id
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        step.id
                      )}
                    </span>
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.short}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mx-0.5" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <section className="mb-6">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    1. Get the template
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Required columns: Address, City, State, Zip. Property Name is optional.
                  </p>
                </div>
                <div className="p-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={downloadXlsxTemplate}
                    className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    Download .xlsx
                  </button>
                </div>
              </div>
            </section>

            <section className="mb-6">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    2. Upload your file
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    .xlsx or .csv. After selecting a file, click Import to preview rows.
                  </p>
                </div>
                <div className="p-4">
                  {!pendingFile && allRows.length === 0 && (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-8 text-center bg-gray-50 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                    >
                      <input
                        type="file"
                        accept=".xlsx,.csv"
                        onChange={handleFileInput}
                        className="hidden"
                        id="property-import-file"
                      />
                      <label
                        htmlFor="property-import-file"
                        className="cursor-pointer flex flex-col items-center gap-3"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                          <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          Drag and drop your file here, or{" "}
                          <span className="text-gray-900 dark:text-gray-100 underline">
                            browse
                          </span>
                        </span>
                        <span className="text-sm text-gray-500">
                          .xlsx or .csv, max 10MB
                        </span>
                      </label>
                    </div>
                  )}

                  {(pendingFile || (allRows.length > 0 && !pendingFile)) && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {pendingFile && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex-1">
                          <FileSpreadsheet className="w-8 h-8 text-gray-500 dark:text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                              {pendingFile.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {(pendingFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      )}
                      {allRows.length > 0 && !pendingFile && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex-1">
                          <FileCheck className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-800 dark:text-gray-100">
                              Preview ready
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {totalRows} row{totalRows !== 1 ? "s" : ""} below
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 shrink-0">
                        {pendingFile && (
                          <>
                            <button
                              type="button"
                              onClick={runImport}
                              disabled={isParsing}
                              className="btn bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            >
                              {isParsing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                  Importing…
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 shrink-0" />
                                  Import
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleChangeFile}
                              disabled={isParsing}
                              className="btn border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 disabled:opacity-50"
                            >
                              Change file
                            </button>
                          </>
                        )}
                        {allRows.length > 0 && !pendingFile && (
                          <button
                            type="button"
                            onClick={handleChangeFile}
                            className="btn border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
                          >
                            Import different file
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {parseError && (
                    <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {parseError}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {allRows.length > 0 && (
              <section ref={previewSectionRef} className="mb-6">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {importSuccessCount != null
                          ? attomProgress.allDone
                            ? "Import complete"
                            : "Importing…"
                          : "3. Review and confirm"}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {importSuccessCount != null
                          ? attomProgress.allDone
                            ? "Each row below shows whether public-records data was filled."
                            : "Each row below updates live as public-records data arrives."
                          : "Fix or remove invalid rows. Only valid rows will be imported."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {importSuccessCount != null ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                            <Home className="w-3.5 h-3.5" />
                            {importSuccessCount} imported
                          </span>
                          {attomProgress.filled > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {attomProgress.filled} details filled
                            </span>
                          )}
                          {!attomProgress.allDone && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              {Math.max(attomProgress.importedTotal - attomProgress.complete, 0)} pending
                            </span>
                          )}
                          {attomProgress.failed > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {attomProgress.failed} failed
                            </span>
                          )}
                          {attomProgress.createFailed > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {attomProgress.createFailed} not created
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                            <Home className="w-3.5 h-3.5" />
                            {totalRows} total
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {validCount} valid
                          </span>
                          {invalidCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {invalidCount} invalid
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {importSuccessCount == null && (
                    <div className="px-4 pt-3 flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-700/50">
                      {[
                        { id: "all", label: "All rows", count: totalRows },
                        { id: "valid", label: "Valid", count: validCount },
                        { id: "invalid", label: "Invalid", count: invalidCount },
                      ].map(({ id, label, count }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPreviewFilter(id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            previewFilter === id
                              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {label} ({count})
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="overflow-x-auto [scrollbar-gutter:stable]">
                      <div className="inline-block min-w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden align-top">
                        <table className="w-max min-w-full text-sm table-auto">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/80">
                            <th className="text-left py-2.5 pl-3 pr-2 font-semibold text-gray-700 dark:text-gray-300 w-12 text-xs">
                              #
                            </th>
                            {PROPERTY_IMPORT_FIELDS.map((f) => (
                              <th
                                key={f.key}
                                className={`text-left py-2.5 px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs ${IMPORT_COLUMN_TH_CLASS[f.key] ?? ""}`}
                              >
                                {f.label}
                              </th>
                            ))}
                            <th className="text-left py-2.5 px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs min-w-[10rem] sm:min-w-[12rem]">
                              {importSuccessCount != null ? "Public records" : "Status"}
                            </th>
                            <th className="w-10 shrink-0" />
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map(({ row, index, valid, errors }, i) => {
                            const postImport = importSuccessCount != null;
                            const theme = getRowTheme({
                              valid,
                              postImport,
                              entry: importedStatuses[index],
                              zebra: i % 2 !== 0,
                            });
                            return (
                              <tr
                                key={index}
                                className={`border-t border-gray-100 dark:border-gray-700/50 transition-colors duration-500 ${theme.rowClass}`}
                              >
                                <td className={`py-2.5 pl-2 pr-2 text-gray-500 font-medium text-xs tabular-nums align-top ${theme.stripeClass}`}>
                                  <div className="flex items-start gap-2">
                                    {theme.leading?.kind === "check" && (
                                      <CheckCircle
                                        className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600 dark:text-green-400"
                                        aria-hidden
                                      />
                                    )}
                                    {theme.leading?.kind === "dot" && (
                                      <span
                                        className={`relative inline-flex h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${theme.leading.className}`}
                                        aria-hidden="true"
                                      >
                                        {theme.leading.pulse && (
                                          <span
                                            className={`absolute inset-0 rounded-full ${theme.leading.className} opacity-75 animate-ping`}
                                          />
                                        )}
                                      </span>
                                    )}
                                    <span>{index + 1}</span>
                                  </div>
                                </td>
                                {PROPERTY_IMPORT_FIELDS.map((f) => (
                                  <td
                                    key={f.key}
                                    className={`py-2.5 px-4 text-gray-800 dark:text-gray-200 text-sm ${IMPORT_COLUMN_TD_CLASS[f.key] ?? ""}`}
                                    title={String(row[f.key] || "")}
                                  >
                                    {row[f.key] || "—"}
                                  </td>
                                ))}
                                <td className="py-2.5 px-4 min-w-[10rem] sm:min-w-[12rem] max-w-md align-top">
                                  {importSuccessCount != null ? (
                                    valid ? (
                                      <AttomRowStatus entry={importedStatuses[index]} />
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500 text-sm"
                                        title="This row was invalid and wasn't imported"
                                      >
                                        <X className="w-3.5 h-3.5 shrink-0" />
                                        Not imported
                                      </span>
                                    )
                                  ) : valid ? (
                                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
                                      <CheckCircle className="w-3.5 h-3.5" /> OK
                                    </span>
                                  ) : (
                                    <span
                                      className="text-amber-600 dark:text-amber-400 text-sm break-words"
                                      title={errors.join(", ")}
                                    >
                                      {errors[0] || "Invalid"}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2">
                                  {importSuccessCount == null && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(index)}
                                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                      title="Remove row"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        </table>
                      </div>
                    </div>

                    {hasMore && (
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          onClick={() => setShowAllRows(!showAllRows)}
                          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium"
                        >
                          {showAllRows
                            ? `Show first ${PREVIEW_PAGE_SIZE} rows`
                            : `Showing first ${PREVIEW_PAGE_SIZE} of ${filteredDisplayRows.length} rows — Show all`}
                        </button>
                      </div>
                    )}

                    {importSuccessCount != null && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        {attomProgress.allDone ? (
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <CheckCircle className="w-5 h-5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                                All done.{" "}
                                {importSuccessCount} propert{importSuccessCount !== 1 ? "ies" : "y"} created
                                {attomProgress.filled > 0 && (
                                  <>
                                    {" "}— public-records data filled for {attomProgress.filled} of {attomProgress.importedTotal}.
                                  </>
                                )}
                                {attomProgress.filled === 0 && attomProgress.importedTotal > 0 && (
                                  <> — no additional public-records data was available.</>
                                )}
                              </p>
                              {(attomProgress.failed > 0 || attomProgress.createFailed > 0) && (
                                <p className="mt-1 text-xs text-green-700/80 dark:text-green-300/80">
                                  {attomProgress.createFailed > 0 && (
                                    <>
                                      {attomProgress.createFailed} couldn't be created.
                                      {" "}
                                    </>
                                  )}
                                  {attomProgress.failed > 0 && (
                                    <>
                                      {attomProgress.failed} public-records lookup
                                      {attomProgress.failed !== 1 ? "s" : ""} failed — you can retry
                                      from the property's actions menu.
                                    </>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <Loader2 className="w-5 h-5 mt-0.5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                Filling public-records data… {attomProgress.complete} of {attomProgress.importedTotal} complete.
                              </p>
                              <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
                                Watch each row's status update below. You can leave this page —
                                data will keep loading in the background and you can also refresh
                                any property manually from its actions menu.
                              </p>
                              {attomProgress.importedTotal > 0 && (
                                <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
                                    style={{
                                      width: `${Math.round(
                                        (attomProgress.complete / attomProgress.importedTotal) * 100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
                      {importSuccessCount != null ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/${accountUrl}/properties`)}
                          className="btn bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white inline-flex items-center gap-2"
                        >
                          {attomProgress.allDone ? "Finish" : "Finish (keep loading in background)"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleConfirmImport}
                          disabled={validCount < 1 || isSubmitting}
                          className="btn bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white inline-flex items-center gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              Creating {validCount} propert{validCount !== 1 ? "ies" : "y"}…
                            </>
                          ) : (
                            <>
                              Confirm import
                              {validCount > 0 && ` (${validCount} propert${validCount !== 1 ? "ies" : "y"})`}
                            </>
                          )}
                        </button>
                      )}
                      {validCount < 1 && totalRows > 0 && importSuccessCount == null && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Fix or remove invalid rows to enable import.
                        </span>
                      )}
                      {importError && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {importError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default PropertiesImport;
