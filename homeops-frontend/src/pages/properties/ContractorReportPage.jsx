import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Wrench, Calendar, FileText, DollarSign, Clock,
  AlertCircle, Loader2, CheckCircle, Send,
  User, Mail, Phone,
} from "lucide-react";
import { API_BASE_URL } from "../../api/api";
import Logo from "../../images/logo-no-bg.png";

/**
 * Public page accessible by contractors via a token link.
 * No login required — the token serves as authentication.
 * Contractors fill out maintenance/inspection report details here.
 */
function ContractorReportPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    description: "",
    workOrderNumber: "",
    cost: "",
    materialsUsed: "",
    notes: "",
    status: "Completed",
    completedAt: new Date().toISOString().slice(0, 10),
    nextServiceDate: "",
  });

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing report link.");
      setLoading(false);
      return;
    }
    loadReportData();
  }, [token]);

  async function loadReportData() {
    try {
      const resp = await fetch(`${API_BASE_URL}/contractor-report/${encodeURIComponent(token)}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error?.message || "This link is invalid or has expired.");
      }
      const data = await resp.json();
      setReportData(data);
      setFormData((prev) => ({
        ...prev,
        description: data.existingData?.description || "",
        workOrderNumber: data.existingData?.workOrderNumber || "",
        cost: data.existingData?.cost || "",
        materialsUsed: data.existingData?.materialsUsed || "",
        notes: data.existingData?.notes || "",
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.description?.trim()) {
      setError("Please provide a work description.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/contractor-report/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Failed to submit report.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!token || (error && !reportData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <img src={Logo} alt="HomeOps" className="h-10 mx-auto mb-6" />
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Invalid</h1>
          <p className="text-gray-600">{error || "This report link is invalid or has expired. Please contact the homeowner for a new link."}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <img src={Logo} alt="HomeOps" className="h-10 mx-auto mb-6" />
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted</h1>
          <p className="text-gray-600 mb-4">
            Thank you! Your maintenance report has been submitted successfully.
            The homeowner will be notified of your findings.
          </p>
          <p className="text-sm text-gray-400">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={Logo} alt="HomeOps" className="h-8" />
          <span className="text-sm text-gray-500">Contractor Report</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Property & system info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Maintenance Report</h1>
          <p className="text-gray-500 mb-4">
            Please fill out the details of the work performed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {reportData.propertyAddress && (
              <div>
                <span className="text-gray-500">Property:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {reportData.propertyName || reportData.propertyAddress}
                </span>
                {reportData.propertyName && (
                  <p className="text-gray-400 text-xs mt-0.5">{reportData.propertyAddress}</p>
                )}
              </div>
            )}
            {reportData.systemName && (
              <div>
                <span className="text-gray-500">System:</span>
                <span className="ml-2 font-medium text-gray-900">{reportData.systemName}</span>
              </div>
            )}
            {reportData.contractorName && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{reportData.contractorName}</span>
              </div>
            )}
            {reportData.contractorEmail && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{reportData.contractorEmail}</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Report form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date & Work Order */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Basic Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Completion Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="completedAt"
                  value={formData.completedAt}
                  onChange={handleChange}
                  required
                  className="form-input w-full rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Order #
                </label>
                <input
                  type="text"
                  name="workOrderNumber"
                  value={formData.workOrderNumber}
                  onChange={handleChange}
                  placeholder="Optional reference number"
                  className="form-input w-full rounded-lg border-gray-300"
                />
              </div>
            </div>
          </div>

          {/* Work Description */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Work Performed
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  required
                  placeholder="Describe the work performed, issues found, repairs made, and any recommendations..."
                  className="form-input w-full rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Wrench className="w-4 h-4 inline mr-1" />
                  Materials Used
                </label>
                <textarea
                  name="materialsUsed"
                  value={formData.materialsUsed}
                  onChange={handleChange}
                  rows={3}
                  placeholder="List materials, parts, or supplies used..."
                  className="form-input w-full rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status After Work
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="form-select w-full rounded-lg border-gray-300"
                >
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress — More Work Needed</option>
                  <option value="Scheduled">Follow-up Scheduled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cost & Scheduling */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Cost & Follow-up
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost
                </label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="form-input w-full rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Next Service Date
                </label>
                <input
                  type="date"
                  name="nextServiceDate"
                  value={formData.nextServiceDate}
                  onChange={handleChange}
                  className="form-input w-full rounded-lg border-gray-300"
                />
                <p className="mt-1 text-xs text-gray-400">
                  When should the next service be scheduled?
                </p>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Additional Notes
            </h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional observations, recommendations, or follow-up actions needed..."
              className="form-input w-full rounded-lg border-gray-300"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end pb-8">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-8 py-3 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#456564" }}
              onMouseEnter={(e) => { if (!submitting) e.target.style.backgroundColor = "#3a5548"; }}
              onMouseLeave={(e) => { if (!submitting) e.target.style.backgroundColor = "#456564"; }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContractorReportPage;
