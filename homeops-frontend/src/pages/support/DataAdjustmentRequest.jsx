import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import { useAuth } from "../../context/AuthContext";
import AppApi from "../../api/api";
import { PAGE_LAYOUT, SETTINGS_CARD } from "../../constants/layout";
import {
  RENTCAST_FIELD_LABELS,
  ADJUSTABLE_FIELD_KEYS,
} from "../../pages/properties/constants/rentcastFields";

/** All fields that support Data Adjustment (RentCast + Address) for dropdown */
const ADJUSTABLE_FIELDS = Array.from(ADJUSTABLE_FIELD_KEYS).map((key) => ({
  value: key,
  label: RENTCAST_FIELD_LABELS[key] || key,
}));

/**
 * Data Adjustment Request page - submit a request to change verified RentCast field values.
 * Pre-populated when opened from a property page (propertyId, field, currentValue in query).
 */
function DataAdjustmentRequest() {
  const { accountUrl } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentAccount } = useCurrentAccount();

  const [propertyId, setPropertyId] = useState("");
  const [prefilledPropertyLabel, setPrefilledPropertyLabel] = useState("");
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [fieldToChange, setFieldToChange] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [requestedValue, setRequestedValue] = useState("");
  const [reason, setReason] = useState("");
  const [dataSource, setDataSource] = useState("RentCast");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(true);

  const accountId = currentAccount?.id;
  const listPath = `/${accountUrl || currentAccount?.url}/settings/support`;

  useEffect(() => {
    const pid = searchParams.get("propertyId");
    const field = searchParams.get("field");
    const system = searchParams.get("system");
    const propertyLabel = searchParams.get("propertyLabel");
    const currentVal = searchParams.get("currentValue");
    if (pid) setPropertyId(pid);
    if (field && ADJUSTABLE_FIELD_KEYS.has(field)) setFieldToChange(field);
    if (system) setDataSource(system);
    if (propertyLabel) setPrefilledPropertyLabel(propertyLabel);
    if (currentVal != null) setCurrentValue(currentVal);
  }, [searchParams]);

  const { currentUser } = useAuth();

  useEffect(() => {
    async function loadProperties() {
      if (!currentUser?.id) return;
      setLoadingProperties(true);
      try {
        const res = await AppApi.getPropertiesByUserId(currentUser.id);
        const list = Array.isArray(res) ? res : res?.properties ?? [];
        setPropertyOptions(
          list.map((p) => ({
            value: String(p.id ?? p.property_uid ?? p.identity?.id ?? ""),
            label:
              p.property_name ||
              [p.address, p.city, p.state].filter(Boolean).join(", ") ||
              p.address_line_1 ||
              `Property ${p.id}`,
          }))
        );
      } catch (err) {
        console.warn("Could not load properties:", err);
      } finally {
        setLoadingProperties(false);
      }
    }
    loadProperties();
  }, [accountId]);

  // Load current value when property and field are set (from pre-fill or selection)
  useEffect(() => {
    if (!propertyId || !prefilledPropertyLabel) return;
    setPropertyOptions((prev) => {
      const propertyIdString = String(propertyId);
      const existing = prev.find((opt) => opt.value === propertyIdString);
      if (existing) return prev;
      return [
        {value: propertyIdString, label: prefilledPropertyLabel},
        ...prev,
      ];
    });
  }, [propertyId, prefilledPropertyLabel]);

  useEffect(() => {
    if (!propertyId || !fieldToChange) return;

    async function loadPropertyValue() {
      try {
        const prop = await AppApi.getPropertyById(propertyId);
        const flat = prop?.property ?? prop ?? {};
        const camelKey = fieldToChange;
        const snakeKey = camelKey.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        const aliases = {
          taxId: ["parcel_tax_id"],
          bedCount: ["rooms"],
          bathCount: ["bathrooms"],
          addressLine1: ["address_line_1"],
        };
        const keysToCheck = [
          camelKey,
          snakeKey,
          ...(aliases[camelKey] || []),
        ];
        let val = null;
        for (const k of keysToCheck) {
          const v = flat[k] ?? flat.identity?.[k];
          if (v != null) {
            val = v;
            break;
          }
        }
        setCurrentValue((prev) => (prev ? prev : val != null ? String(val) : ""));
      } catch (err) {
        console.warn("Could not load property value:", err);
        setCurrentValue((prev) => (prev ? prev : ""));
      }
    }
    loadPropertyValue();
  }, [propertyId, fieldToChange]);

  function handleBack() {
    navigate(listPath);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!propertyId?.trim()) {
      setError("Please select a property");
      return;
    }
    if (!fieldToChange) {
      setError("Please select the field to change");
      return;
    }
    if (!requestedValue?.trim()) {
      setError("Requested value is required");
      return;
    }
    if (!reason?.trim()) {
      setError("Reason for change is required");
      return;
    }
    if (!accountId) {
      setError("Please select an account");
      return;
    }

    setSubmitting(true);
    try {
      const attachmentKeys = [];
      if (attachmentFiles.length > 0) {
        for (const file of attachmentFiles) {
          try {
            const doc = await AppApi.uploadDocument(file);
            if (doc?.key) attachmentKeys.push(doc.key);
          } catch (uploadErr) {
            console.warn("File upload error:", uploadErr);
          }
        }
      }

      const description = [
        `**Data Adjustment Request**`,
        ``,
        `Property ID: ${propertyId}`,
        `Data Source: ${dataSource}`,
        `Field: ${RENTCAST_FIELD_LABELS[fieldToChange] ?? fieldToChange}`,
        `Current Value: ${currentValue || "(empty)"}`,
        `Requested Value: ${requestedValue.trim()}`,
        ``,
        `**Reason:**`,
        reason.trim(),
      ].join("\n");

      const ticket = await AppApi.createSupportTicket({
        type: "data_adjustment",
        subject: `Data Adjustment: ${RENTCAST_FIELD_LABELS[fieldToChange] ?? fieldToChange} for Property ${propertyId}`,
        description,
        accountId,
        attachmentKeys: attachmentKeys.length ? attachmentKeys : undefined,
        propertyId: propertyId ? Number(propertyId) || propertyId : undefined,
        dataSource: dataSource || "RentCast",
        fieldKey: fieldToChange,
        currentValue: currentValue || null,
        requestedValue: requestedValue.trim(),
      });

      setSuccess(true);
      setTimeout(() => {
        navigate(`/${accountUrl || currentAccount?.url}/settings/support/${ticket.id}`);
      }, 1500);
    } catch (err) {
      setError(err.message || err.messages?.[0] || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(e) {
    const files = Array.from(e.target?.files || []);
    setAttachmentFiles((prev) => [...prev, ...files].slice(0, 5));
  }

  function removeFile(index) {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  }

  if (!accountId) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className={`grow ${PAGE_LAYOUT.settings}`}>
            <p className="text-gray-600 dark:text-gray-400">
              Please select an account to submit a data adjustment request.
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.settings}>
            <button
              type="button"
              onClick={handleBack}
              className="btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 pl-0 focus:outline-none shadow-none inline-flex items-center gap-2 mb-6"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              <span className="text-lg font-medium">Back to Support</span>
            </button>

            <section className={SETTINGS_CARD.card}>
              <div className={SETTINGS_CARD.header}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Data Adjustment Request
                </h2>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                  Request changes to verified property data provided by RentCast. Our team will review
                  your request and update the record when appropriate.
                </p>
              </div>
              <form onSubmit={handleSubmit} className={`${SETTINGS_CARD.body} space-y-4`}>
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                    Request submitted successfully. Redirecting...
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Property <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className="form-select w-full"
                    required
                    disabled={loadingProperties}
                  >
                    <option value="">Select a property...</option>
                    {propertyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Source
                  </label>
                  <input
                    type="text"
                    value={dataSource}
                    readOnly
                    className="form-input w-full bg-gray-50 dark:bg-gray-800/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field to change <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fieldToChange}
                    onChange={(e) => setFieldToChange(e.target.value)}
                    className="form-select w-full"
                    required
                  >
                    <option value="">Select a field...</option>
                    {ADJUSTABLE_FIELDS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current value
                  </label>
                  <input
                    type="text"
                    value={currentValue}
                    readOnly
                    className="form-input w-full bg-gray-50 dark:bg-gray-800/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Requested value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={requestedValue}
                    onChange={(e) => setRequestedValue(e.target.value)}
                    className="form-input w-full"
                    placeholder="Enter the correct value"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason for change <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="form-input w-full min-h-[100px]"
                    placeholder="Explain why this value should be updated"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supporting documents (optional)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-gray-300"
                  />
                  {attachmentFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachmentFiles.map((f, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                        >
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default DataAdjustmentRequest;
