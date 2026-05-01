import React, {useState, useCallback, useMemo, useRef, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import * as XLSX from "xlsx";
import {
  CATEGORY_IMPORT_FIELDS,
  CATEGORY_IMPORT_KEYS,
  normalizeCategoryHeader,
  getCategoryTemplateRow,
} from "../../../data/categoryImportSchema";
import Sidebar from "../../../partials/Sidebar";
import Header from "../../../partials/Header";
import useCurrentAccount from "../../../hooks/useCurrentAccount";
import AppApi from "../../../api/api";
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
  ArrowLeft,
  FileJson,
  FolderTree,
} from "lucide-react";

const PREVIEW_PAGE_SIZE = 50;
const MERGE_DEFAULT = true;

const STEPS = [
  {id: 1, label: "Get template", short: "Template"},
  {id: 2, label: "Upload & import", short: "Upload"},
  {id: 3, label: "Review & confirm", short: "Review"},
];

function normalizeRowType(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (["parent", "p", "category"].includes(s)) return "parent";
  if (["child", "c", "sub", "subcategory", "sub-category"].includes(s)) return "child";
  return null;
}

function cellStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function intOr(v, d) {
  if (v === undefined || v === null || v === "") return d;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : d;
}

function boolCell(v) {
  if (v === undefined || v === null || v === "") return true;
  const s = String(v).trim().toLowerCase();
  if (["false", "0", "no"].includes(s)) return false;
  if (["true", "1", "yes"].includes(s)) return true;
  return true;
}

function isEmptyRow(cellValues) {
  return CATEGORY_IMPORT_KEYS.every((k) => {
    const v = cellValues[k];
    return v == null || String(v).trim() === "";
  });
}

function normalizeRow(rawRow, headerMap) {
  const row = {};
  for (const [rawHeader, value] of Object.entries(rawRow)) {
    const key = headerMap.get(rawHeader);
    if (key) {
      row[key] = value == null ? "" : String(value).trim();
    }
  }
  return CATEGORY_IMPORT_KEYS.reduce((acc, k) => {
    acc[k] = row[k] ?? "";
    return acc;
  }, {});
}

function parentNamesInFile(rows) {
  const set = new Set();
  for (const r of rows) {
    if (normalizeRowType(r.type) === "parent") {
      const n = (r.category_name || "").trim();
      if (n) set.add(n.toLowerCase());
    }
  }
  return set;
}

function validateRow(row, parentSet) {
  const errors = [];
  const name = (row.category_name || "").trim();
  if (!name) errors.push("Category Name is required");
  const ty = normalizeRowType(row.type);
  if (!ty) errors.push("Type must be parent or child");
  if (ty === "parent" && (row.parent_name || "").trim()) {
    errors.push("Parent Name must be empty for parent rows");
  }
  if (ty === "child") {
    const pn = (row.parent_name || "").trim();
    if (!pn) errors.push("Parent Name is required for child rows");
    else if (!parentSet.has(pn.toLowerCase())) {
      errors.push("Parent Name must match a Category Name from a parent row");
    }
  }
  return errors;
}

function partitionRowsByValidation(rows) {
  const parentSet = parentNamesInFile(rows);
  const valid = [];
  const invalid = [];
  const errorsByIndex = {};
  rows.forEach((row, i) => {
    const errs = validateRow(row, parentSet);
    if (errs.length) {
      invalid.push(row);
      errorsByIndex[i] = errs;
    } else {
      valid.push(row);
    }
  });
  return {valid, invalid, errorsByIndex};
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
        const json = XLSX.utils.sheet_to_json(ws, {defval: "", raw: false});
        if (!json.length) {
          resolve({rows: [], headerMap: new Map()});
          return;
        }
        const rawHeaders = Object.keys(json[0]);
        const headerMap = new Map();
        rawHeaders.forEach((h) => {
          const key = normalizeCategoryHeader(h);
          if (key) headerMap.set(h, key);
        });
        const rows = json
          .map((raw) => normalizeRow(raw, headerMap))
          .filter((r) => !isEmptyRow(r));
        resolve({rows, headerMap});
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
  const parent = getCategoryTemplateRow();
  parent.category_name = "Example Parent";
  parent.type = "parent";
  const child = getCategoryTemplateRow();
  child.category_name = "Example Child";
  child.type = "child";
  child.parent_name = "Example Parent";
  child.sort_order = "1";
  const ws = XLSX.utils.json_to_sheet([
    Object.fromEntries(CATEGORY_IMPORT_FIELDS.map((f) => [f.label, parent[f.key]])),
    Object.fromEntries(CATEGORY_IMPORT_FIELDS.map((f) => [f.label, child[f.key]])),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Categories");
  return wb;
}

function downloadXlsxTemplate() {
  const wb = buildWorkbookForDownload();
  XLSX.writeFile(wb, "professional_categories_import_template.xlsx");
}

function spreadsheetRowsToCategories(validRows) {
  const parentOrder = [];
  const parentByKey = new Map();

  for (const row of validRows) {
    if (normalizeRowType(row.type) !== "parent") continue;
    const name = (row.category_name || "").trim();
    const key = name.toLowerCase();
    if (!parentByKey.has(key)) {
      parentByKey.set(key, {
        name,
        description: cellStr(row.description),
        icon: cellStr(row.icon),
        image_key: cellStr(row.image_key),
        sort_order: intOr(row.sort_order, 0),
        is_active: boolCell(row.is_active),
        children: [],
      });
      parentOrder.push(key);
    }
  }

  for (const row of validRows) {
    if (normalizeRowType(row.type) !== "child") continue;
    const name = (row.category_name || "").trim();
    const pName = (row.parent_name || "").trim();
    const pk = pName.toLowerCase();
    const parent = parentByKey.get(pk);
    if (!parent) continue;
    parent.children.push({
      name,
      description: cellStr(row.description),
      icon: cellStr(row.icon),
      image_key: cellStr(row.image_key),
      sort_order: intOr(row.sort_order, 0),
      is_active: boolCell(row.is_active),
    });
  }

  return parentOrder.map((k) => parentByKey.get(k));
}

function parseCategoryBundleJson(text) {
  const data = JSON.parse(text);
  if (data == null || typeof data !== "object") {
    throw new Error("Invalid file: expected a JSON object.");
  }
  const categories = data.categories ?? data.hierarchy ?? (Array.isArray(data) ? data : null);
  if (!categories || !Array.isArray(categories)) {
    throw new Error('Invalid file: expected "categories" or a top-level array.');
  }
  return {...data, categories};
}

function CategoriesImport() {
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const categoriesBase = accountUrl
    ? `/${accountUrl}/professionals/categories`
    : "/professionals/categories";

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
  const [importResult, setImportResult] = useState(null);
  const [previewFilter, setPreviewFilter] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const previewSectionRef = useRef(null);
  const [importMode, setImportMode] = useState("spreadsheet");
  const [jsonBundle, setJsonBundle] = useState(null);
  const [jsonError, setJsonError] = useState("");
  const [jsonSubmitting, setJsonSubmitting] = useState(false);
  const [jsonImportError, setJsonImportError] = useState(null);
  const [jsonImportResult, setJsonImportResult] = useState(null);

  const switchImportMode = useCallback((mode) => {
    setImportMode(mode);
    if (mode === "json") {
      setPendingFile(null);
      setParseError("");
      setAllRows([]);
      setValidRows([]);
      setInvalidRows([]);
      setRowErrors({});
      setImportError(null);
      setImportResult(null);
    } else {
      setJsonBundle(null);
      setJsonError("");
      setJsonImportError(null);
      setJsonImportResult(null);
    }
  }, []);

  useEffect(() => {
    const {valid, invalid, errorsByIndex} = partitionRowsByValidation(allRows);
    setValidRows(valid);
    setInvalidRows(invalid);
    setRowErrors(errorsByIndex);
  }, [allRows]);

  const currentStep = allRows.length > 0 ? 3 : pendingFile ? 2 : 1;

  const displayRows = useMemo(() => {
    return allRows.map((row, i) => {
      const valid = validRows.some((r) => r === row);
      const errors = rowErrors[i] || [];
      return {row, index: i, valid, errors};
    });
  }, [allRows, validRows, rowErrors]);

  const filteredDisplayRows = useMemo(() => {
    if (previewFilter === "valid") return displayRows.filter((d) => d.valid);
    if (previewFilter === "invalid") return displayRows.filter((d) => !d.valid);
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
      setParseError("Please upload a .xlsx or .csv file (use JSON backup for nested export files).");
      return;
    }
    setParseError("");
    setImportError(null);
    setImportResult(null);
    setIsParsing(true);
    parseFile(pendingFile)
      .then(({rows}) => {
        if (rows.length === 0) {
          setParseError(
            "No data rows found. Add a header row (Category Name, Type, …) and at least one data row.",
          );
          setIsParsing(false);
          return;
        }
        setAllRows(rows);
        setPendingFile(null);
        setIsParsing(false);
        requestAnimationFrame(() => {
          previewSectionRef.current?.scrollIntoView({behavior: "smooth", block: "start"});
        });
      })
      .catch((err) => {
        setParseError(err?.message || "Failed to parse file.");
        setAllRows([]);
        setIsParsing(false);
      });
  }, [pendingFile]);

  const handleFileSelect = useCallback(
    (fileObj) => {
      if (!fileObj) return;
      const name = (fileObj.name || "").toLowerCase();

      if (name.endsWith(".json")) {
        switchImportMode("json");
        setJsonImportError(null);
        setJsonImportResult(null);
        setJsonError("");
        setJsonBundle(null);
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = reader.result;
            if (typeof text !== "string") throw new Error("Could not read file as text.");
            const data = parseCategoryBundleJson(text);
            setJsonBundle(data);
            setJsonError("");
          } catch (err) {
            setJsonBundle(null);
            setJsonError(err?.message || "Invalid export file.");
          }
        };
        reader.onerror = () => {
          setJsonBundle(null);
          setJsonError("Failed to read file.");
        };
        reader.readAsText(fileObj, "UTF-8");
        return;
      }

      if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
        setParseError("Please choose a .xlsx, .csv, or .json file.");
        return;
      }
      setParseError("");
      setImportError(null);
      setImportResult(null);
      setPendingFile(fileObj);
      setAllRows([]);
      setValidRows([]);
      setInvalidRows([]);
      setRowErrors({});
    },
    [switchImportMode],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect],
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
    [handleFileSelect],
  );

  const handleChangeFile = useCallback(() => {
    setPendingFile(null);
    setParseError("");
    setImportError(null);
    setImportResult(null);
    setAllRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setRowErrors({});
  }, []);

  const handleRemoveRow = useCallback((index) => {
    setAllRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (validCount < 1 || isSubmitting || importResult != null) return;
    setImportError(null);
    setIsSubmitting(true);
    const categories = spreadsheetRowsToCategories(validRows);
    try {
      const res = await AppApi.importProfessionalCategories({
        categories,
        mergeMissingOnly: MERGE_DEFAULT,
      });
      setImportResult(res);
    } catch (err) {
      setImportError(err?.message || "Import failed.");
    } finally {
      setIsSubmitting(false);
    }
  }, [validCount, isSubmitting, importResult, validRows]);

  const handleJsonFileInput = useCallback((e) => {
    const f = e.target?.files?.[0];
    e.target.value = "";
    if (!f) return;
    setJsonError("");
    setJsonImportError(null);
    setJsonImportResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        if (typeof text !== "string") throw new Error("Could not read file as text.");
        const data = parseCategoryBundleJson(text);
        setJsonBundle(data);
      } catch (err) {
        setJsonBundle(null);
        setJsonError(err?.message || "Invalid export file.");
      }
    };
    reader.onerror = () => {
      setJsonBundle(null);
      setJsonError("Failed to read file.");
    };
    reader.readAsText(f, "UTF-8");
  }, []);

  const handleConfirmJsonImport = useCallback(async () => {
    if (!jsonBundle || jsonSubmitting || jsonImportResult != null) return;
    setJsonImportError(null);
    setJsonSubmitting(true);
    try {
      const payload = {
        mergeMissingOnly: MERGE_DEFAULT,
        categories: jsonBundle.categories,
      };
      if (jsonBundle.format != null) payload.format = jsonBundle.format;
      if (jsonBundle.version != null) payload.version = jsonBundle.version;
      if (jsonBundle.exportedAt != null) payload.exportedAt = jsonBundle.exportedAt;
      const res = await AppApi.importProfessionalCategories(payload);
      setJsonImportResult(res);
    } catch (err) {
      setJsonImportError(err?.message || "Import failed.");
    } finally {
      setJsonSubmitting(false);
    }
  }, [jsonBundle, jsonSubmitting, jsonImportResult]);

  const previewColumns = CATEGORY_IMPORT_FIELDS.slice(0, 6);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-3 sm:px-6 lg:px-8 xxl:px-16 py-6 w-full max-w-5xl mx-auto">
            <nav className="mb-6">
              <button
                type="button"
                onClick={() => navigate(categoriesBase)}
                className="flex items-center gap-2 text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors py-1"
              >
                <ArrowLeft className="w-5 h-5 shrink-0" />
                Professional Categories
              </button>
            </nav>

            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-1">
                Bulk category import
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Import from a spreadsheet, or restore from a JSON export (includes S3 image keys). Existing
                categories are matched by name; only empty description, icon, and image key fields on the server
                are filled from the file—values already stored are kept.
              </p>
            </div>

            <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => switchImportMode("spreadsheet")}
                className={`flex-1 min-w-[140px] rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  importMode === "spreadsheet"
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                Spreadsheet (.xlsx / .csv)
              </button>
              <button
                type="button"
                onClick={() => switchImportMode("json")}
                className={`flex-1 min-w-[140px] rounded-md px-3 py-2 text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
                  importMode === "json"
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                <FileJson className="w-4 h-4 shrink-0" />
                JSON export
              </button>
            </div>

            {importMode === "json" && (
              <section className="mb-6">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      Import JSON export
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Use a file from Categories → Actions → Export. Objects must exist in the target S3 bucket
                      for images to load. Existing rows only receive description, icon, and image key when those
                      fields are currently empty.
                    </p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleJsonFileInput}
                        className="hidden"
                        id="category-json-import"
                      />
                      <label
                        htmlFor="category-json-import"
                        className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 shrink-0" />
                        Choose JSON file
                      </label>
                      {jsonBundle && (
                        <span className="text-sm text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
                          <FolderTree className="w-4 h-4 shrink-0" />
                          <strong className="text-gray-800 dark:text-gray-200">
                            {jsonBundle.categories.length}
                          </strong>{" "}
                          parent categor{jsonBundle.categories.length !== 1 ? "ies" : "y"} in file
                        </span>
                      )}
                    </div>
                    {jsonError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {jsonError}
                      </div>
                    )}
                    {jsonBundle && jsonImportResult == null && (
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                        <button
                          type="button"
                          onClick={handleConfirmJsonImport}
                          disabled={jsonSubmitting}
                          className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                          {jsonSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              Importing…
                            </>
                          ) : (
                            <>
                              <FileCheck className="w-4 h-4 shrink-0" />
                              Run import
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setJsonBundle(null);
                            setJsonError("");
                            setJsonImportError(null);
                          }}
                          className="btn border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
                        >
                          Clear file
                        </button>
                      </div>
                    )}
                    {jsonImportError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {jsonImportError}
                      </div>
                    )}
                    {jsonImportResult != null && (
                      <div className="flex flex-col gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Done: {jsonImportResult.created} created, {jsonImportResult.updated} updated
                          {jsonImportResult.unchanged != null
                            ? `, ${jsonImportResult.unchanged} unchanged`
                            : ""}
                          .
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(categoriesBase)}
                          className="underline hover:no-underline font-normal self-start"
                        >
                          Back to categories
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {importMode === "spreadsheet" && (
              <>
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
                        Required: Category Name and Type (parent or child). Child rows need Parent Name matching a
                        parent row.
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
                        .xlsx or .csv. Choosing .json switches to the JSON export tab.
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
                            accept=".xlsx,.csv,.json,application/json"
                            onChange={handleFileInput}
                            className="hidden"
                            id="category-import-file"
                          />
                          <label
                            htmlFor="category-import-file"
                            className="cursor-pointer flex flex-col items-center gap-3"
                          >
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">
                              Drag and drop your file here, or{" "}
                              <span className="text-gray-900 dark:text-gray-100 underline">browse</span>
                            </span>
                            <span className="text-sm text-gray-500">.xlsx, .csv, or .json</span>
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
                                <p className="font-medium text-gray-800 dark:text-gray-100">Preview ready</p>
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
                                      Parsing…
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 shrink-0" />
                                      Parse file
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
                            3. Review and confirm
                          </h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Fix or remove invalid rows. Only valid rows are imported; existing categories get
                            empty fields filled when possible.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                            <FolderTree className="w-3.5 h-3.5" />
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
                        </div>
                      </div>

                      <div className="px-4 pt-3 flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-700/50">
                        {[
                          {id: "all", label: "All rows", count: totalRows},
                          {id: "valid", label: "Valid", count: validCount},
                          {id: "invalid", label: "Invalid", count: invalidCount},
                        ].map(({id, label, count}) => (
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

                      <div className="p-4 overflow-x-auto">
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-800/80">
                                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300 w-10 text-xs">
                                  #
                                </th>
                                {previewColumns.map((f) => (
                                  <th
                                    key={f.key}
                                    className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs"
                                  >
                                    {f.label}
                                  </th>
                                ))}
                                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300 text-xs">
                                  Status
                                </th>
                                <th className="w-10" />
                              </tr>
                            </thead>
                            <tbody>
                              {visibleRows.map(({row, index, valid, errors}, i) => (
                                <tr
                                  key={index}
                                  className={`border-t border-gray-100 dark:border-gray-700/50 ${
                                    valid
                                      ? (i % 2 === 0
                                          ? "bg-white dark:bg-gray-800/30"
                                          : "bg-gray-50/80 dark:bg-gray-800/50") +
                                        " hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                      : "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  }`}
                                >
                                  <td className="py-2 px-3 text-gray-500 font-medium text-xs">{index + 1}</td>
                                  {previewColumns.map((f) => (
                                    <td
                                      key={f.key}
                                      className="py-2 px-3 text-gray-800 dark:text-gray-200 max-w-[160px] truncate text-xs"
                                      title={row[f.key]}
                                    >
                                      {row[f.key] || "—"}
                                    </td>
                                  ))}
                                  <td className="py-2 px-3">
                                    {valid ? (
                                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                                        <CheckCircle className="w-3.5 h-3.5" /> OK
                                      </span>
                                    ) : (
                                      <span
                                        className="text-amber-600 dark:text-amber-400 text-xs max-w-[200px] truncate block"
                                        title={errors.join(", ")}
                                      >
                                        {errors[0] || "Invalid"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(index)}
                                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                      title="Remove row"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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

                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
                          {importResult != null ? (
                            <button
                              type="button"
                              onClick={() => navigate(categoriesBase)}
                              className="btn bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white inline-flex items-center gap-2"
                            >
                              Finish
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
                                  Importing…
                                </>
                              ) : (
                                <>
                                  Confirm import
                                  {validCount > 0 && ` (${validCount} row${validCount !== 1 ? "s" : ""})`}
                                </>
                              )}
                            </button>
                          )}
                          {validCount < 1 && totalRows > 0 && (
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
                          {importResult != null && (
                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-green-600 dark:text-green-400 font-medium">
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              {importResult.created} created, {importResult.updated} updated
                              {importResult.unchanged != null ? `, ${importResult.unchanged} unchanged` : ""}.
                              <button
                                type="button"
                                onClick={() => navigate(categoriesBase)}
                                className="underline hover:no-underline font-normal"
                              >
                                View categories
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default CategoriesImport;
