import React, {useState, useCallback, useRef} from "react";
import {useNavigate} from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AGENCY_IMPORT_KEYS,
  AGENCY_IMPORT_FIELDS,
  AGENCY_IMPORT_STATE_VALUES,
  normalizeHeader,
  normalizeImportState,
  getTemplateHeaders,
  rowToAgencyImportPayload,
} from "../../data/agencyImportSchema";
import UsStateSelect from "../../components/UsStateSelect";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import {dynamicImportWithRetry} from "../../utils/lazyWithRetry";
import {
  Download,
  Upload,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building2,
} from "lucide-react";

function isEmptyRow(cellValues) {
  return Object.values(cellValues).every(
    (v) => v == null || String(v).trim() === "",
  );
}

function normalizeRow(rawRow, headerMap) {
  const row = {};
  for (const [rawHeader, value] of Object.entries(rawRow)) {
    const key = headerMap.get(rawHeader);
    if (!key) continue;
    const trimmed = value == null ? "" : String(value).trim();
    if (!trimmed && row[key]) continue;
    row[key] = trimmed;
  }
  const normalized = AGENCY_IMPORT_KEYS.reduce((acc, k) => {
    acc[k] = row[k] ?? "";
    return acc;
  }, {});
  normalized.state = normalizeImportState(normalized.state);
  return normalized;
}

function validateRow(row) {
  const errors = [];
  if (!(row.name || "").trim()) errors.push("Agency name is required");
  return errors;
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, {type: isCsv ? "string" : "binary", raw: false});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, {defval: "", raw: false});
        if (!json.length) {
          resolve({rows: [], headerMap: new Map()});
          return;
        }
        const headerMap = new Map();
        Object.keys(json[0]).forEach((h) => {
          const key = normalizeHeader(h);
          if (key) headerMap.set(h, key);
        });
        const rows = json
          .map((r) => normalizeRow(r, headerMap))
          .filter((r) => !isEmptyRow(r));
        resolve({rows, headerMap});
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    if (isCsv) reader.readAsText(file);
    else reader.readAsBinaryString(file);
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

function AgenciesImport() {
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const fileRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [parseError, setParseError] = useState("");
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);

  const validRows = rows.filter((_, i) => !(rowErrors[i]?.length));

  const handleDownloadTemplate = useCallback(async () => {
    setTemplateError("");
    setIsTemplateDownloading(true);
    try {
      const ExcelJS = (await dynamicImportWithRetry(() => import("exceljs"))).default;
      const stateColIndex =
        AGENCY_IMPORT_FIELDS.findIndex((f) => f.key === "state") + 1;
      const stateLetter = excelColumnLetterFromIndex1Based(stateColIndex);
      const stateListFormula = `"${AGENCY_IMPORT_STATE_VALUES.join(",")}"`;

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Agencies");
      ws.addRow(getTemplateHeaders());

      ws.views = [{state: "frozen", ySplit: 1, activeCell: "A2"}];

      AGENCY_IMPORT_FIELDS.forEach((f, i) => {
        const col = ws.getColumn(i + 1);
        if (f.key === "name") col.width = 32;
        else if (f.key === "website") col.width = 28;
        else if (f.key === "city") col.width = 18;
        else if (f.key === "state") col.width = 10;
        else if (f.key === "phone") col.width = 16;
      });

      ws.dataValidations.add(`${stateLetter}2:${stateLetter}10000`, {
        type: "list",
        allowBlank: true,
        formulae: [stateListFormula],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Invalid state",
        error: "Select a US state code from the list (e.g. WA, CA).",
        showInputMessage: true,
        promptTitle: "State",
        prompt: "Choose a two-letter state code, or leave blank.",
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "agency_import_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setTemplateError(err?.message || "Could not build the template file.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }, []);

  const handleRowChange = useCallback((rowIndex, key, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        const next = {...row, [key]: value};
        if (key === "state") next.state = normalizeImportState(value);
        return next;
      }),
    );
  }, []);

  const handleFile = useCallback(async (file) => {
    setParseError("");
    setImportError("");
    setImportResult(null);
    try {
      const {rows: parsed} = await parseFile(file);
      if (!parsed.length) {
        setParseError("No data rows found in the file.");
        setRows([]);
        setRowErrors({});
        return;
      }
      const errors = {};
      parsed.forEach((row, i) => {
        const errs = validateRow(row);
        if (errs.length) errors[i] = errs;
      });
      setRows(parsed);
      setRowErrors(errors);
    } catch (err) {
      setParseError(err.message || "Could not parse file");
      setRows([]);
      setRowErrors({});
    }
  }, []);

  const handleImport = async () => {
    if (!validRows.length || isSubmitting) return;
    setIsSubmitting(true);
    setImportError("");
    try {
      const result = await AppApi.importAdminAgencies(
        validRows.map(rowToAgencyImportPayload),
      );
      setImportResult(result);
    } catch (err) {
      setImportError(Array.isArray(err) ? err.join(" ") : err.message || "Import failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const backPath = accountUrl ? `/${accountUrl}/agencies/manage` : "/agencies/manage";

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className="px-3 sm:px-6 lg:px-8 py-6 w-full max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Agencies
            </button>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-[#456564]" />
              Import Agencies
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Upload a spreadsheet to create approved agencies. A default main office is created automatically for each row.
            </p>

            <div className="space-y-6">
              <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  1. Download template
                </h2>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isTemplateDownloading}
                  className="btn border-gray-200 dark:border-gray-700 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {isTemplateDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  agency_import_template.xlsx
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Required column: Agency Name. Optional: Website, City, State (dropdown), Phone.
                </p>
                {templateError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    {templateError}
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  2. Upload file
                </h2>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Choose file
                </button>
                {parseError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">{parseError}</p>
                )}
              </section>

              {rows.length > 0 && !importResult && (
                <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Preview ({validRows.length} valid / {rows.length} total)
                    </span>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={!validRows.length || isSubmitting}
                      className="btn bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Import {validRows.length} agencies
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="table-auto w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
                        <tr>
                          {AGENCY_IMPORT_FIELDS.map((f) => (
                            <th key={f.key} className="px-3 py-2 text-left">
                              {f.label}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {rows.map((row, i) => (
                          <tr key={i}>
                            {AGENCY_IMPORT_FIELDS.map((field) => (
                              <td key={field.key} className="px-3 py-2">
                                {field.key === "state" ? (
                                  <UsStateSelect
                                    value={row.state}
                                    onChange={(state) =>
                                      handleRowChange(i, "state", state)
                                    }
                                  />
                                ) : (
                                  row[field.key] || "—"
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              {rowErrors[i]?.length ? (
                                <span className="text-red-600 text-xs">{rowErrors[i].join(", ")}</span>
                              ) : (
                                <span className="text-emerald-600 text-xs">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importError && (
                    <p className="px-4 py-2 text-sm text-red-600">{importError}</p>
                  )}
                </section>
              )}

              {importResult && (
                <section className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 p-4">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Import finished</span>
                  </div>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    <li>Created: {importResult.summary?.created ?? 0}</li>
                    <li>Skipped (duplicate): {importResult.summary?.skipped ?? 0}</li>
                    <li>Errors: {importResult.summary?.errors ?? 0}</li>
                  </ul>
                  {(importResult.errors?.length > 0) && (
                    <div className="mt-3 flex items-start gap-2 text-amber-800 dark:text-amber-300 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Some rows failed — check the API response details in server logs.</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(backPath)}
                    className="btn bg-[#456564] text-white mt-4"
                  >
                    Back to agencies
                  </button>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgenciesImport;
