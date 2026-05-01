import React, {useState, useCallback, useMemo, useRef, useContext} from "react";
import {useNavigate} from "react-router-dom";
import * as XLSX from "xlsx";
import {
  USER_IMPORT_KEYS,
  USER_IMPORT_FIELDS,
  USER_IMPORT_ROLE_VALUES,
  USER_IMPORT_ROLE_SET,
  USER_IMPORT_ROLE_COLUMN_1_BASED,
  normalizeHeader,
  normalizeUserImportRole,
  toApiUserImportRole,
  getTemplateRow,
  getTemplateHeaders,
} from "../../data/userImportSchema";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import UserContext from "../../context/UserContext";
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
  Users,
  Mail,
} from "lucide-react";

const PREVIEW_PAGE_SIZE = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Generate a random password (min 5 chars for backend schema). */
function randomPassword() {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

function isEmptyRow(cellValues) {
  return Object.values(cellValues).every(
    (v) => v == null || String(v).trim() === "",
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
  return USER_IMPORT_KEYS.reduce((acc, k) => {
    acc[k] = row[k] ?? "";
    return acc;
  }, {});
}

function validateRow(row, rowIndex, emailSet) {
  const errors = [];
  const requiredKeys = USER_IMPORT_FIELDS.filter((f) => f.required).map(
    (f) => f.key,
  );
  for (const key of requiredKeys) {
    const val = (row[key] ?? "").trim();
    if (!val) errors.push(`${key} is required`);
  }
  const email = (row.email ?? "").trim();
  if (email && !EMAIL_REGEX.test(email)) {
    errors.push("Invalid email format");
  }
  if (email && emailSet.has(email.toLowerCase())) {
    errors.push("Duplicate email in file");
  }
  if (email) emailSet.add(email.toLowerCase());
  const rolePart = (row.role ?? "").trim();
  if (rolePart) {
    const n = normalizeUserImportRole(rolePart);
    if (!USER_IMPORT_ROLE_SET.has(n)) {
      errors.push(
        `Invalid role. Use one of: ${USER_IMPORT_ROLE_VALUES.join(", ")}`,
      );
    }
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
        const json = XLSX.utils.sheet_to_json(ws, {defval: "", raw: false});
        if (!json.length) {
          resolve({rows: [], headerMap: new Map()});
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

/** Excel column letter from 1-based index (1 → A, 4 → D). */
function excelColumnLetterFromIndex1Based(n) {
  let s = "";
  let k = n;
  while (k > 0) {
    k -= 1;
    s = String.fromCharCode(65 + (k % 26)) + s;
    k = Math.floor(k / 26);
  }
  return s || "A";
}

const STEPS = [
  {id: 1, label: "Get template", short: "Template"},
  {id: 2, label: "Upload & import", short: "Upload"},
  {id: 3, label: "Review & confirm", short: "Review"},
];

function UsersImport() {
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const {createUser} = useContext(UserContext);
  const accountUrl = currentAccount?.url || "";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccessCount, setImportSuccessCount] = useState(null);
  const [previewFilter, setPreviewFilter] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [sendInviteOnImport, setSendInviteOnImport] = useState(true);
  const previewSectionRef = useRef(null);

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
      setParseError("Please upload a .xlsx or .csv file.");
      return;
    }
    setParseError("");
    setConfirmed(false);
    setImportError(null);
    setImportSuccessCount(null);
    setIsParsing(true);
    const fileToParse = pendingFile;
    parseFile(fileToParse)
      .then(({rows}) => {
        if (rows.length === 0) {
          setParseError(
            "No data rows found. Your file needs a header row (Name, Email) and at least one data row.",
          );
          setIsParsing(false);
          return;
        }
        const emailSet = new Set();
        const valid = [];
        const invalid = [];
        const errorsByIndex = {};
        rows.forEach((row, i) => {
          const errs = validateRow(row, i, emailSet);
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
          previewSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
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
    setPendingFile(fileObj);
    setAllRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setRowErrors({});
    setConfirmed(false);
  }, []);

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

  const handleDownloadTemplate = useCallback(async () => {
    setTemplateError("");
    setIsTemplateDownloading(true);
    try {
      // Use bare "exceljs" so Vite's resolve.alias (→ dist/exceljs.min.js) applies;
      // "exceljs/dist/..." is not a valid pnpm/exports subpath and fails to resolve in dev.
      const ExcelJS = (await import("exceljs")).default;
      const roleLetter = excelColumnLetterFromIndex1Based(
        USER_IMPORT_ROLE_COLUMN_1_BASED,
      );
      const listFormula = `"${USER_IMPORT_ROLE_VALUES.join(",")}"`;

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Users");
      ws.addRow(getTemplateHeaders());
      const example = {...getTemplateRow(), role: "homeowner"};
      ws.addRow(USER_IMPORT_FIELDS.map((f) => example[f.key]));

      ws.views = [{state: "frozen", ySplit: 1, activeCell: "A2"}];

      USER_IMPORT_FIELDS.forEach((f, i) => {
        const col = ws.getColumn(i + 1);
        if (f.key === "name") col.width = 28;
        else if (f.key === "email") col.width = 36;
        else if (f.key === "phone") col.width = 16;
        else if (f.key === "role") col.width = 16;
      });

      ws.dataValidations.add(`${roleLetter}2:${roleLetter}10000`, {
        type: "list",
        allowBlank: true,
        formulae: [listFormula],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Invalid role",
        error: "Select a value from the list. Roles must use the exact spelling shown.",
        showInputMessage: true,
        promptTitle: "Role",
        prompt:
          "Choose a role, or clear the cell to use the default (homeowner) on import.",
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "user_import_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setTemplateError(e?.message || "Could not build the template file.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }, []);

  const handleChangeFile = useCallback(() => {
    setPendingFile(null);
    setParseError("");
    setImportError(null);
    setImportSuccessCount(null);
    setAllRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setRowErrors({});
    setConfirmed(false);
  }, []);

  const handleRemoveRow = useCallback(
    (index) => {
      const nextRows = allRows.filter((_, i) => i !== index);
      setAllRows(nextRows);
      if (nextRows.length === 0) {
        setValidRows([]);
        setInvalidRows([]);
        setRowErrors({});
        return;
      }
      const emailSet = new Set();
      const valid = [];
      const invalid = [];
      const errorsByIndex = {};
      nextRows.forEach((row, i) => {
        const errs = validateRow(row, i, emailSet);
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
    },
    [allRows],
  );

  const handleConfirmImport = useCallback(async () => {
    if (
      validRows.length < 1 ||
      isSubmitting ||
      !createUser ||
      importSuccessCount != null
    )
      return;
    setImportError(null);
    setIsSubmitting(true);
    let successCount = 0;
    try {
      for (const row of validRows) {
        const userData = {
          name: (row.name || "").trim(),
          email: (row.email || "").trim(),
          phone: (row.phone || "").trim() || undefined,
          role: toApiUserImportRole(row.role),
          password: randomPassword(),
          is_active: false,
          sendInvite: sendInviteOnImport,
        };
        await createUser(userData);
        successCount += 1;
      }
      setImportSuccessCount(successCount);
      setConfirmed(true);
    } catch (err) {
      const message = Array.isArray(err)
        ? err.join(" ")
        : err?.message || "Import failed.";
      setImportError(message);
      setImportSuccessCount(successCount > 0 ? successCount : null);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validRows,
    isSubmitting,
    createUser,
    importSuccessCount,
    sendInviteOnImport,
  ]);

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
                onClick={() =>
                  navigate(accountUrl ? `/${accountUrl}/users` : "/users")
                }
                className="flex items-center gap-2 text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors py-1"
              >
                <ArrowLeft className="w-5 h-5 shrink-0" />
                Users
              </button>
            </nav>

            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-1">
                Bulk User Import
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Download a template, fill in name and email (required). A
                temporary password is generated; users can set their own after
                accepting the invitation.
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
                    Required: Name, Email. The Role column uses a dropdown in the
                    .xlsx file so values match the system exactly.
                  </p>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      disabled={isTemplateDownloading}
                      className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isTemplateDownloading ? (
                        <>
                          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                          Preparing…
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 shrink-0" />
                          Download .xlsx
                        </>
                      )}
                    </button>
                  </div>
                  {templateError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {templateError}
                    </div>
                  )}
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
                    .xlsx or .csv. After selecting a file, click Import to
                    preview rows.
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
                        id="user-import-file"
                      />
                      <label
                        htmlFor="user-import-file"
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
                        3. Review and confirm
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Fix or remove invalid rows. Only valid rows will be
                        imported.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        <Users className="w-3.5 h-3.5" />
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
                            {USER_IMPORT_FIELDS.map((f) => (
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
                              <td className="py-2 px-3 text-gray-500 font-medium text-xs">
                                {index + 1}
                              </td>
                              {USER_IMPORT_FIELDS.map((f) => (
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

                    {importSuccessCount == null && (
                      <div className="mt-4 flex items-start justify-between gap-4 py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="flex items-start gap-2 min-w-0">
                          <Mail className="w-4 h-4 mt-0.5 text-[#456564] dark:text-[#7aa3a2] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              Send invitation email to each new user
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {sendInviteOnImport
                                ? "Each user will get an invitation email to set a password and finish onboarding."
                                : "Users will be created without emails. You can send invitations later from each user page."}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={sendInviteOnImport}
                          aria-label="Send invitation email to each new user"
                          onClick={() =>
                            setSendInviteOnImport(!sendInviteOnImport)
                          }
                          disabled={isSubmitting}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                            sendInviteOnImport
                              ? "bg-[#456564]"
                              : "bg-gray-300 dark:bg-gray-600"
                          } ${
                            isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              sendInviteOnImport ? "left-6" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
                      {importSuccessCount != null ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              accountUrl ? `/${accountUrl}/users` : "/users",
                            )
                          }
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
                              Creating {validCount} user
                              {validCount !== 1 ? "s" : ""}…
                            </>
                          ) : (
                            <>
                              Confirm import
                              {validCount > 0 &&
                                ` (${validCount} user${validCount !== 1 ? "s" : ""})`}
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
                      {importSuccessCount != null && (
                        <span className="inline-flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          {importSuccessCount} user
                          {importSuccessCount !== 1 ? "s" : ""} created.
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                accountUrl ? `/${accountUrl}/users` : "/users",
                              )
                            }
                            className="underline hover:no-underline"
                          >
                            View users
                          </button>
                        </span>
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

export default UsersImport;
