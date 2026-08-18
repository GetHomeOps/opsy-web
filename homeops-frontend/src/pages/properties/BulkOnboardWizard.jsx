import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Download,
  FileCheck,
  FileSpreadsheet,
  Home,
  Loader2,
  Mail,
  Search,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi, { getApiErrorMessage } from "../../api/api";
import propertyContext from "../../context/PropertyContext";
import useSuppressBrowserAddressAutofill from "../../hooks/useSuppressBrowserAddressAutofill";
import {
  BULK_ONBOARD_FIELDS,
  BULK_ONBOARD_KEYS,
  getTemplateRow,
  mergeRowsByAddress,
  normalizeHeader,
} from "../../data/bulkOnboardImportSchema";

const STEPS = [
  { id: 1, label: "Select agent", short: "Agent" },
  { id: 2, label: "Upload spreadsheet", short: "Upload" },
  { id: 3, label: "Review & match", short: "Review" },
  { id: 4, label: "Results", short: "Results" },
];

const MAX_DROPDOWN_ITEMS = 8;
const PREVIEW_PAGE_SIZE = 50;

function buildWorkbookForDownload() {
  const row = getTemplateRow();
  const ws = XLSX.utils.json_to_sheet([
    Object.fromEntries(
      BULK_ONBOARD_FIELDS.map((f) => [f.label, row[f.key]])
    ),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bulk Onboard");
  return wb;
}

function downloadXlsxTemplate() {
  const wb = buildWorkbookForDownload();
  XLSX.writeFile(wb, "bulk_onboard_template.xlsx");
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
      row[key] = value == null ? "" : String(value).trim();
    }
  }
  return BULK_ONBOARD_KEYS.reduce((acc, k) => {
    acc[k] = row[k] ?? "";
    return acc;
  }, {});
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const name = (file.name || "").toLowerCase();
    const isCsv = name.endsWith(".csv");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (data == null) {
          resolve({ rows: [], error: "Could not read file contents." });
          return;
        }
        const wb = XLSX.read(data, {
          type: isCsv ? "string" : "array",
          raw: false,
        });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) {
          resolve({ rows: [], error: "The workbook has no sheets." });
          return;
        }
        const ws = wb.Sheets[firstSheet];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
        if (!json.length) {
          resolve({
            rows: [],
            error:
              "The file has no data rows. Add at least one property under the header row.",
          });
          return;
        }
        const rawHeaders = Object.keys(json[0] || {});
        const headerMap = new Map();
        for (const h of rawHeaders) {
          const key = normalizeHeader(h);
          if (key) headerMap.set(h, key);
        }
        const mappedKeys = new Set(headerMap.values());
        const missingRequired = BULK_ONBOARD_FIELDS.filter(
          (f) => f.required && !mappedKeys.has(f.key)
        );
        if (missingRequired.length) {
          resolve({
            rows: [],
            error: `Missing required columns: ${missingRequired
              .map((f) => f.label)
              .join(", ")}. Download a fresh template and try again.`,
          });
          return;
        }
        const rows = json
          .map((raw) => normalizeRow(raw, headerMap))
          .filter((r) => !isEmptyRow(r));
        if (!rows.length) {
          resolve({
            rows: [],
            error:
              "No filled rows found. Enter Address, City, State, Zip, and Homeowner Email for at least one property.",
          });
          return;
        }
        resolve({ rows, error: null });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to parse spreadsheet"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    if (isCsv) reader.readAsText(file, "UTF-8");
    else reader.readAsArrayBuffer(file);
  });
}

function AgentPicker({ agents, selected, onSelect, disabled }) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const bindSearch = useSuppressBrowserAddressAutofill("bulk-onboard-agent");

  const filtered = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    const list = agents || [];
    if (!term) return list.slice(0, MAX_DROPDOWN_ITEMS);
    return list
      .filter((a) => {
        const name = (a.name || "").toLowerCase();
        const email = (a.email || "").toLowerCase();
        return name.includes(term) || email.includes(term);
      })
      .slice(0, MAX_DROPDOWN_ITEMS);
  }, [agents, inputValue]);

  useEffect(() => {
    if (selected) {
      setInputValue(selected.name || selected.email || "");
    }
  }, [selected]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) {
      setDropdownPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, filtered.length]);

  const handleSelectAgent = useCallback(
    (agent) => {
      onSelect(agent);
      setInputValue(agent.name || agent.email || "");
      setIsOpen(false);
    },
    [onSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        Agent for this batch
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
        <input
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            if (selected) onSelect(null);
          }}
          placeholder="Search agents by name or email…"
          className="form-input w-full pl-9"
          aria-label="Search agents by name or email"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          role="combobox"
          {...bindSearch({
            onFocus: () => {
              if (!disabled) setIsOpen(true);
            },
          })}
        />
      </div>
      {isOpen &&
        !disabled &&
        dropdownPosition &&
        createPortal(
          <ul
            ref={dropdownRef}
            className="fixed py-1 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-auto z-[250]"
            role="listbox"
            style={{
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                No agents found
              </li>
            ) : (
              filtered.map((a) => (
                <li key={a.id} role="option">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectAgent(a);
                    }}
                  >
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {a.name || "Unnamed"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {a.email}
                      {a.isActive === false ? " · inactive" : ""}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body
        )}
      {selected && (
        <div className="mt-3 flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 shrink-0">
            <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
              {selected.name || "Unnamed agent"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {selected.email}
            </p>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => {
              onSelect(null);
              setInputValue("");
            }}
            disabled={disabled}
            aria-label="Clear agent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    created: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    skipped: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    existing: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    none: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    new_invite: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    existing_user: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    invalid_email: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  const label = String(status || "").replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
        map[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {label}
    </span>
  );
}

function BulkOnboardWizard() {
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";
  const { refreshProperties } = useContext(propertyContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);

  const [pendingFile, setPendingFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [mergedGroups, setMergedGroups] = useState([]);
  const [orphanErrors, setOrphanErrors] = useState([]);

  const [previewRows, setPreviewRows] = useState([]);
  const [previewAccount, setPreviewAccount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [sendHomeownerInvites, setSendHomeownerInvites] = useState(false);
  const [enqueueAttomLookup, setEnqueueAttomLookup] = useState(true);
  const [showAllRows, setShowAllRows] = useState(false);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState("");
  const [results, setResults] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);
    AppApi.getAgents()
      .then((list) => {
        if (!cancelled) setAgents(list || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setAgentsError(getApiErrorMessage(err) || "Failed to load agents");
        }
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileSelect = useCallback((fileObj) => {
    if (!fileObj) return;
    setPendingFile(fileObj);
    setParseError("");
    setMergedGroups([]);
    setOrphanErrors([]);
    setPreviewRows([]);
    setResults(null);
  }, []);

  const handleFileInput = useCallback(
    (e) => {
      const f = e.target?.files?.[0];
      e.target.value = "";
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const parsePendingFile = useCallback(async () => {
    if (!pendingFile || isParsing) return;
    setIsParsing(true);
    setParseError("");
    try {
      const { rows, error } = await parseFile(pendingFile);
      if (error) {
        setParseError(error);
        setMergedGroups([]);
        setOrphanErrors([]);
        return;
      }
      const { groups, orphanErrors: orphans } = mergeRowsByAddress(rows);
      if (!groups.length) {
        const detail =
          orphans.length > 0
            ? `Found ${orphans.length} row${orphans.length === 1 ? "" : "s"} but none had a complete address (Address, City, State, Zip).`
            : "No properties could be read from the spreadsheet.";
        setParseError(detail);
        setMergedGroups([]);
        setOrphanErrors(orphans);
        return;
      }
      setMergedGroups(groups);
      setOrphanErrors(orphans);
      setPendingFile(null);
      setParseError("");
    } catch (err) {
      setParseError(err?.message || "Failed to parse file");
      setMergedGroups([]);
      setOrphanErrors([]);
    } finally {
      setIsParsing(false);
    }
  }, [pendingFile, isParsing]);

  const runPreview = useCallback(async () => {
    if (!selectedAgent?.id || mergedGroups.length === 0 || previewLoading) return;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const payloadRows = mergedGroups.map((g, i) => ({
        clientKey: g.key || `group-${i}`,
        property_name: g.property_name,
        address: g.address,
        city: g.city,
        state: g.state,
        zip: g.zip,
        homeowners: g.homeowners,
        selected: true,
        forceCreate: false,
      }));
      const res = await AppApi.previewBulkOnboard({
        agentUserId: selectedAgent.id,
        rows: payloadRows,
      });
      setPreviewAccount(res.account || null);
      setPreviewRows(
        (res.rows || []).map((r) => ({
          ...r,
          selected: r.selected !== false,
          forceCreate: r.forceCreate === true,
        }))
      );
      setStep(3);
    } catch (err) {
      setPreviewError(getApiErrorMessage(err) || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedAgent, mergedGroups, previewLoading]);

  const selectedPreviewCount = useMemo(
    () => previewRows.filter((r) => r.selected).length,
    [previewRows]
  );

  const creatableSelectedCount = useMemo(
    () =>
      previewRows.filter((r) => {
        if (!r.selected) return false;
        if ((r.errors || []).length > 0) return false;
        const canCreate =
          r.propertyMatch?.status === "none" || r.forceCreate === true;
        if (!canCreate) return false;
        if (!r.address || !r.city || !r.state || !r.zip) return false;
        const homeowners = r.homeowners || [];
        if (!homeowners.length) return false;
        // At least one homeowner that is not blocked as an agent platform user.
        return homeowners.some((h) => {
          const email = String(h.email || "").trim();
          if (!email) return false;
          const agentBlocked = (h.warnings || []).some((w) =>
            String(w).toLowerCase().includes("agent")
          );
          return !agentBlocked && h.match !== "invalid_email";
        });
      }).length,
    [previewRows]
  );

  const noCreatableHint = useMemo(() => {
    if (creatableSelectedCount > 0) return null;
    const selected = previewRows.filter((r) => r.selected);
    if (selected.length === 0) {
      return "No creatable rows selected. Fix validation errors or select rows that can be created.";
    }
    const blockedByExisting = selected.every(
      (r) =>
        r.propertyMatch?.status === "existing" && r.forceCreate !== true
    );
    if (blockedByExisting) {
      return 'Selected properties already exist. Enable "Create anyway" to create duplicates, or deselect them.';
    }
    return "No creatable rows selected. Fix validation errors or select rows that can be created.";
  }, [previewRows, creatableSelectedCount]);

  const displayPreviewRows = useMemo(() => {
    if (showAllRows || previewRows.length <= PREVIEW_PAGE_SIZE) return previewRows;
    return previewRows.slice(0, PREVIEW_PAGE_SIZE);
  }, [previewRows, showAllRows]);

  const executeBatch = useCallback(async () => {
    if (!selectedAgent?.id || isExecuting) return;
    const rows = previewRows
      .filter((r) => r.selected)
      .map((r) => ({
        clientKey: r.clientKey,
        property_name: r.property_name,
        address: r.address,
        city: r.city,
        state: r.state,
        zip: r.zip,
        homeowners: (r.homeowners || []).map((h) => ({
          name: h.name,
          email: h.email,
          phone: h.phone,
        })),
        selected: true,
        forceCreate: r.forceCreate === true,
      }));
    if (!rows.length) {
      setExecuteError("Select at least one row to process");
      return;
    }
    setIsExecuting(true);
    setExecuteError("");
    try {
      const res = await AppApi.executeBulkOnboard({
        agentUserId: selectedAgent.id,
        rows,
        options: {
          sendHomeownerInvites,
          enqueueAttomLookup,
        },
      });
      setResults(res);
      setStep(4);
      try {
        await refreshProperties?.();
      } catch (_) {
        /* ignore */
      }
    } catch (err) {
      setExecuteError(getApiErrorMessage(err) || "Bulk onboard failed");
    } finally {
      setIsExecuting(false);
    }
  }, [
    selectedAgent,
    previewRows,
    isExecuting,
    sendHomeownerInvites,
    enqueueAttomLookup,
    refreshProperties,
  ]);

  const downloadErrorReport = useCallback(() => {
    if (!results?.results?.length) return;
    const failed = results.results.filter(
      (r) => r.status === "failed" || r.status === "partial" || r.error
    );
    const rows = failed.map((r) => ({
      Status: r.status,
      Address: previewRows.find((p) => p.clientKey === r.clientKey)?.address || "",
      PropertyId: r.propertyId || "",
      Error: r.error || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Status: "none", Error: "No errors" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "bulk_onboard_errors.xlsx");
  }, [results, previewRows]);

  const currentStep = step;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            <nav className="mb-4">
              <button
                type="button"
                onClick={() =>
                  navigate(accountUrl ? `/${accountUrl}/properties` : "/properties")
                }
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to properties
              </button>
            </nav>

            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-1">
                Bulk Agent Onboarding
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Select one agent, upload properties with homeowners, review matches, then
                create in one pass.
              </p>
            </div>

            <div className="mb-6 flex items-center gap-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-1 shadow-sm overflow-x-auto">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                      currentStep === s.id
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : currentStep > s.id
                          ? "text-gray-600 dark:text-gray-400"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        currentStep === s.id
                          ? "bg-white/20 dark:bg-gray-900/20"
                          : currentStep > s.id
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      {currentStep > s.id ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        s.id
                      )}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{s.short}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mx-0.5 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step 1: Agent */}
            {step === 1 && (
              <section className="mb-6">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      1. Select agent
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      All properties in this batch will be created under this agent&apos;s
                      account and the agent will be set as owner.
                    </p>
                  </div>
                  <div className="p-4 max-w-xl">
                    {agentsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading agents…
                      </div>
                    ) : agentsError ? (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {agentsError}
                      </div>
                    ) : (
                      <AgentPicker
                        agents={agents}
                        selected={selectedAgent}
                        onSelect={setSelectedAgent}
                      />
                    )}
                    <div className="mt-6 flex gap-2">
                      <button
                        type="button"
                        className="btn btn-primary disabled:opacity-50"
                        disabled={!selectedAgent}
                        onClick={() => setStep(2)}
                      >
                        Continue
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Step 2: Upload */}
            {step === 2 && (
              <>
                <section className="mb-6">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          2. Upload spreadsheet
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Agent:{" "}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {selectedAgent?.name || selectedAgent?.email}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                        onClick={() => setStep(1)}
                      >
                        Change agent
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={downloadXlsxTemplate}
                          className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white inline-flex items-center gap-2"
                        >
                          <Download className="w-4 h-4 shrink-0" />
                          Download template
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Required: Address, City, State, Zip, Homeowner Email. Optional:
                        Property Name, Homeowner Name/Phone, Homeowner 2. Duplicate an
                        address row to add more homeowners.
                      </p>

                      {mergedGroups.length === 0 && !pendingFile && (
                        <div
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-8 text-center bg-gray-50 dark:bg-gray-800/30"
                        >
                          <input
                            type="file"
                            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                            onChange={handleFileInput}
                            className="hidden"
                            id="bulk-onboard-file"
                          />
                          <label
                            htmlFor="bulk-onboard-file"
                            className="cursor-pointer flex flex-col items-center gap-3"
                          >
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <Upload className="w-6 h-6 text-gray-500" />
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">
                              Drag and drop, or{" "}
                              <span className="underline">browse</span>
                            </span>
                            <span className="text-sm text-gray-500">.xlsx or .csv</span>
                          </label>
                        </div>
                      )}

                      {pendingFile && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex-1">
                            <FileSpreadsheet className="w-8 h-8 text-gray-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                                {pendingFile.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {(pendingFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={parsePendingFile}
                            disabled={isParsing}
                            className="btn btn-primary disabled:opacity-50 inline-flex items-center gap-2"
                          >
                            {isParsing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Parsing…
                              </>
                            ) : (
                              <>
                                <FileCheck className="w-4 h-4" />
                                Parse file
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn border border-gray-200 dark:border-gray-600"
                            onClick={() => {
                              setPendingFile(null);
                              setParseError("");
                            }}
                            disabled={isParsing}
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {parseError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{parseError}</span>
                        </div>
                      )}

                      {mergedGroups.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <Home className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <div className="text-sm">
                              <span className="font-medium text-gray-800 dark:text-gray-100">
                                {mergedGroups.length} propert
                                {mergedGroups.length === 1 ? "y" : "ies"}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">
                                {" "}
                                ·{" "}
                                {mergedGroups.reduce(
                                  (n, g) => n + g.homeowners.length,
                                  0
                                )}{" "}
                                homeowner
                                {mergedGroups.reduce(
                                  (n, g) => n + g.homeowners.length,
                                  0
                                ) === 1
                                  ? ""
                                  : "s"}
                              </span>
                              {orphanErrors.length > 0 && (
                                <span className="text-amber-700 dark:text-amber-300">
                                  {" "}
                                  · {orphanErrors.length} row
                                  {orphanErrors.length === 1 ? "" : "s"} skipped
                                  (missing address)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={runPreview}
                              disabled={previewLoading}
                              className="btn btn-primary disabled:opacity-50 inline-flex items-center gap-2"
                            >
                              {previewLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Matching…
                                </>
                              ) : (
                                <>
                                  Continue to review
                                  <ChevronRight className="w-4 h-4" />
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              className="btn border border-gray-200 dark:border-gray-600"
                              onClick={() => {
                                setMergedGroups([]);
                                setOrphanErrors([]);
                              }}
                            >
                              Clear file
                            </button>
                          </div>
                          {previewError && (
                            <div className="flex items-center gap-2 text-sm text-red-600">
                              <AlertCircle className="w-4 h-4" />
                              {previewError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <section className="mb-6">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      3. Review & match
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Agent{" "}
                      <span className="font-medium">
                        {selectedAgent?.name || selectedAgent?.email}
                      </span>
                      {previewAccount?.name
                        ? ` · account ${previewAccount.name}`
                        : ""}
                      {" · "}
                      {selectedPreviewCount} selected · {creatableSelectedCount} will
                      create
                    </p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4 py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
                      <div className="flex items-start gap-2 min-w-0">
                        <Mail className="w-4 h-4 mt-0.5 text-[#456564] dark:text-[#7aa3a2] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            Send homeowner invite emails
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {sendHomeownerInvites
                              ? "Homeowners will receive an invitation email to join each property."
                              : "Invitations are created but not emailed. You can send them later from Properties → Actions."}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={sendHomeownerInvites}
                        aria-label="Send homeowner invite emails"
                        onClick={() =>
                          setSendHomeownerInvites(!sendHomeownerInvites)
                        }
                        disabled={isExecuting}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          sendHomeownerInvites
                            ? "bg-[#456564]"
                            : "bg-gray-300 dark:bg-gray-600"
                        } ${isExecuting ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            sendHomeownerInvites ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={enqueueAttomLookup}
                        onChange={(e) => setEnqueueAttomLookup(e.target.checked)}
                      />
                      Queue public-records lookup (ATTOM)
                    </label>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="table-auto w-full text-sm">
                        <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
                          <tr>
                            <th className="px-3 py-2 text-left w-10">
                              <input
                                type="checkbox"
                                className="form-checkbox"
                                checked={
                                  previewRows.length > 0 &&
                                  previewRows.every((r) => r.selected)
                                }
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setPreviewRows((prev) =>
                                    prev.map((r) => ({ ...r, selected: checked }))
                                  );
                                }}
                              />
                            </th>
                            <th className="px-3 py-2 text-left">Property</th>
                            <th className="px-3 py-2 text-left">Match</th>
                            <th className="px-3 py-2 text-left">Homeowners</th>
                            <th className="px-3 py-2 text-left">Force create</th>
                            <th className="px-3 py-2 text-left">Issues</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {displayPreviewRows.map((row) => (
                            <tr
                              key={row.clientKey}
                              className={
                                row.selected
                                  ? ""
                                  : "opacity-50 bg-gray-50/50 dark:bg-gray-800/20"
                              }
                            >
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="checkbox"
                                  className="form-checkbox"
                                  checked={row.selected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setPreviewRows((prev) =>
                                      prev.map((r) =>
                                        r.clientKey === row.clientKey
                                          ? { ...r, selected: checked }
                                          : r
                                      )
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2 align-top min-w-[14rem]">
                                <div className="font-medium text-gray-800 dark:text-gray-100">
                                  {row.property_name || "—"}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400">
                                  {row.address}
                                  <br />
                                  {row.city}, {row.state} {row.zip}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <StatusBadge
                                  status={
                                    row.propertyMatch?.status === "existing"
                                      ? "existing"
                                      : "none"
                                  }
                                />
                                {row.propertyMatch?.propertyUid && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    UID {row.propertyMatch.propertyUid}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top min-w-[14rem]">
                                <ul className="space-y-2">
                                  {(row.homeowners || []).map((h, hi) => (
                                    <li key={`${row.clientKey}-ho-${hi}`} className="space-y-1">
                                      <input
                                        type="text"
                                        className="form-input w-full text-xs py-1"
                                        value={h.name || ""}
                                        placeholder="Name"
                                        onChange={(e) => {
                                          const name = e.target.value;
                                          setPreviewRows((prev) =>
                                            prev.map((r) => {
                                              if (r.clientKey !== row.clientKey) return r;
                                              const homeowners = [...(r.homeowners || [])];
                                              homeowners[hi] = {
                                                ...homeowners[hi],
                                                name,
                                              };
                                              return { ...r, homeowners };
                                            })
                                          );
                                        }}
                                      />
                                      <input
                                        type="email"
                                        className="form-input w-full text-xs py-1"
                                        value={h.email || ""}
                                        placeholder="Email"
                                        onChange={(e) => {
                                          const email = e.target.value;
                                          setPreviewRows((prev) =>
                                            prev.map((r) => {
                                              if (r.clientKey !== row.clientKey) return r;
                                              const homeowners = [...(r.homeowners || [])];
                                              homeowners[hi] = {
                                                ...homeowners[hi],
                                                email,
                                                match: "new_invite",
                                                warnings: [],
                                              };
                                              return { ...r, homeowners, errors: [] };
                                            })
                                          );
                                        }}
                                      />
                                      <StatusBadge status={h.match} />
                                    </li>
                                  ))}
                                </ul>
                              </td>
                              <td className="px-3 py-2 align-top">
                                {row.propertyMatch?.status === "existing" ? (
                                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="form-checkbox"
                                      checked={row.forceCreate}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setPreviewRows((prev) =>
                                          prev.map((r) =>
                                            r.clientKey === row.clientKey
                                              ? { ...r, forceCreate: checked }
                                              : r
                                          )
                                        );
                                      }}
                                    />
                                    Create anyway
                                  </label>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top text-xs text-red-600 dark:text-red-400 max-w-[14rem]">
                                {(row.errors || []).length
                                  ? row.errors.join("; ")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {previewRows.length > PREVIEW_PAGE_SIZE && !showAllRows && (
                      <button
                        type="button"
                        className="text-sm text-gray-600 dark:text-gray-400 underline"
                        onClick={() => setShowAllRows(true)}
                      >
                        Show all {previewRows.length} rows
                      </button>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={executeBatch}
                        disabled={isExecuting || creatableSelectedCount === 0}
                        className="btn btn-primary disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {isExecuting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating…
                          </>
                        ) : (
                          <>
                            <Users className="w-4 h-4" />
                            Create ({creatableSelectedCount})
                          </>
                        )}
                      </button>
                    </div>
                    {executeError && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {executeError}
                      </div>
                    )}
                    {noCreatableHint && (
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {noCreatableHint}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="btn border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 inline-flex items-center gap-1.5 disabled:opacity-50"
                    onClick={() => setStep(2)}
                    disabled={isExecuting}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to upload
                  </button>
                </div>
              </section>
            )}

            {/* Step 4: Results */}
            {step === 4 && results && (
              <section className="mb-6">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      4. Results
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Batch complete for{" "}
                      {results.agent?.name || results.agent?.email || "agent"}
                    </p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        ["Total", results.summary?.total ?? 0],
                        ["Created", results.summary?.created ?? 0],
                        ["Skipped", results.summary?.skipped ?? 0],
                        ["Failed", results.summary?.failed ?? 0],
                        ["Invited", results.summary?.invitedHomeowners ?? 0],
                        ["Added", results.summary?.addedHomeowners ?? 0],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                        >
                          <div className="text-xs text-gray-500 uppercase">{label}</div>
                          <div className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="table-auto w-full text-sm">
                        <thead className="text-xs uppercase text-gray-500 bg-gray-50 dark:bg-gray-800/60">
                          <tr>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Property</th>
                            <th className="px-3 py-2 text-left">Homeowners</th>
                            <th className="px-3 py-2 text-left">Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {(results.results || []).map((r) => {
                            const preview = previewRows.find(
                              (p) => p.clientKey === r.clientKey
                            );
                            return (
                              <tr key={r.clientKey}>
                                <td className="px-3 py-2 align-top">
                                  <StatusBadge status={r.status} />
                                  {r.propertyUid && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      UID {r.propertyUid}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {preview?.address || "—"}
                                  {preview && (
                                    <div className="text-xs text-gray-500">
                                      {preview.city}, {preview.state} {preview.zip}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <ul className="space-y-1">
                                    {(r.homeowners || []).map((h) => (
                                      <li key={h.email} className="text-xs">
                                        {h.email}:{" "}
                                        <StatusBadge status={h.status} />
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                                <td className="px-3 py-2 align-top text-xs text-red-600 dark:text-red-400 max-w-[16rem]">
                                  {r.error || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          navigate(
                            accountUrl ? `/${accountUrl}/properties` : "/properties"
                          )
                        }
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        className="btn border border-gray-200 dark:border-gray-600 inline-flex items-center gap-2"
                        onClick={downloadErrorReport}
                      >
                        <Download className="w-4 h-4" />
                        Download error report
                      </button>
                      <button
                        type="button"
                        className="btn border border-gray-200 dark:border-gray-600"
                        onClick={() => {
                          setStep(1);
                          setSelectedAgent(null);
                          setMergedGroups([]);
                          setPreviewRows([]);
                          setResults(null);
                          setPendingFile(null);
                        }}
                      >
                        Start another batch
                      </button>
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

export default BulkOnboardWizard;
