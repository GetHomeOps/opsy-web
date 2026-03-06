import React, {useState, useEffect} from "react";
import {
  Wrench,
  Calendar,
  User,
  FileText,
  FileCheck,
  Upload,
  X,
  File,
  AlertCircle,
  DollarSign,
  Clock,
  Mail,
  Phone,
  Send,
} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import DatePickerInput from "../../../../components/DatePickerInput";
import InstallerSelect from "../InstallerSelect";

/**
 * Modal form for adding/editing maintenance records.
 */
function MaintenanceRecordForm({
  isOpen,
  onClose,
  record,
  systemId,
  systemName: systemNameProp,
  onSave,
  contacts = [],
}) {
  const [formData, setFormData] = useState({
    date: "",
    contractor: "",
    contractorEmail: "",
    contractorPhone: "",
    description: "",
    status: "Completed",
    priority: "Medium",
    cost: "",
    workOrderNumber: "",
    nextServiceDate: "",
    materialsUsed: "",
    notes: "",
    files: [],
  });

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [requestStatus, setRequestStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (record) {
        setFormData({
          date: record.date || "",
          contractor: record.contractor || "",
          contractorEmail: record.contractorEmail || "",
          contractorPhone: record.contractorPhone || "",
          description: record.description || "",
          status: record.status || "Completed",
          priority: record.priority || "Medium",
          cost: record.cost || "",
          workOrderNumber: record.workOrderNumber || "",
          nextServiceDate: record.nextServiceDate || "",
          materialsUsed: record.materialsUsed || "",
          notes: record.notes || "",
          files: record.files || [],
        });
        setUploadedFiles(record.files || []);
        setRequestStatus(record.requestStatus || null);
      } else {
        setFormData({
          date: "",
          contractor: "",
          contractorEmail: "",
          contractorPhone: "",
          description: "",
          status: "Completed",
          priority: "Medium",
          cost: "",
          workOrderNumber: "",
          nextServiceDate: "",
          materialsUsed: "",
          notes: "",
          files: [],
        });
        setUploadedFiles([]);
        setRequestStatus(null);
      }
    }
  }, [isOpen, record]);

  const handleInputChange = (e) => {
    const {name, value} = e.target;
    setFormData((prev) => {
      const next = {...prev, [name]: value};
      if (name === "contractor" && contacts?.length) {
        const contact = contacts.find((c) => (c.name || "") === value);
        if (contact) {
          next.contractorEmail = contact.email || prev.contractorEmail;
          next.contractorPhone = contact.phone || prev.contractorPhone;
        }
      }
      return next;
    });
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles((prev) => [
      ...prev,
      ...files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
      })),
    ]);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!formData.date?.trim()) {
      return;
    }
    const recordData = {
      ...formData,
      files: uploadedFiles,
      systemId: systemId,
      id: record?.id || `MT-${Date.now()}`,
      requestStatus: requestStatus,
    };
    onSave(recordData);
    setFormData({
      date: "",
      contractor: "",
      contractorEmail: "",
      contractorPhone: "",
      description: "",
      status: "Completed",
      priority: "Medium",
      cost: "",
      workOrderNumber: "",
      nextServiceDate: "",
      materialsUsed: "",
      notes: "",
      files: [],
    });
    setUploadedFiles([]);
    setRequestStatus(null);
    onClose();
  };

  const handleSubmitRequest = () => {
    if (
      !formData.contractor ||
      (!formData.contractorEmail && !formData.contractorPhone)
    ) {
      alert(
        "Please provide contractor name and at least one contact method (email or phone) before submitting a request."
      );
      return;
    }
    setRequestStatus("pending");
    alert(
      "Request submitted to contractor. They will be notified to fill out the maintenance report."
    );
  };

  const systemName = systemNameProp ?? "System";

  return (
    <ModalBlank
      id="maintenance-record-form"
      modalOpen={isOpen}
      contentClassName="max-w-4xl"
      setModalOpen={(open) => {
        if (!open) {
          setFormData({
            date: "",
            contractor: "",
            contractorEmail: "",
            contractorPhone: "",
            description: "",
            status: "Completed",
            priority: "Medium",
            cost: "",
            workOrderNumber: "",
            nextServiceDate: "",
            materialsUsed: "",
            notes: "",
            files: [],
          });
          setUploadedFiles([]);
          setRequestStatus(null);
          onClose();
        }
      }}
    >
      {/* Pending banner - fixed at top of modal */}
      {requestStatus === "pending" && (
        <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Maintenance Record Pending
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                A request has been sent to the contractor to fill out this
                maintenance form. You'll be notified once they complete it.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 max-h-[90vh] overflow-y-auto">
        {!record && requestStatus === null && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                    Submit Request for Filling
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-3">
                    Need the contractor to fill out this form? Fill in the
                    contractor details below and click "Submit Request" to
                    notify them.
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                    style={{backgroundColor: "#456654"}}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#3a5548";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#456654";
                    }}
                  >
                    <Send className="w-4 h-4" />
                    Submit Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {record ? "Edit" : "Add"} Maintenance Record
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {systemName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FileCheck className="w-4 h-4 inline mr-2" />
                Work Order #
              </label>
              <input
                type="text"
                name="workOrderNumber"
                value={formData.workOrderNumber}
                onChange={handleInputChange}
                placeholder="Optional work order reference"
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date <span className="text-red-500">*</span>
              </label>
              <DatePickerInput
                name="date"
                value={formData.date}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="Completed">Completed</option>
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Contractor">
                  Pending Contractor Fill-out
                </option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Next Service Date
            </label>
            <DatePickerInput
              name="nextServiceDate"
              value={formData.nextServiceDate}
              onChange={handleInputChange}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              When is the next maintenance service scheduled?
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Contractor Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Contractor
                </label>
                <InstallerSelect
                  name="contractor"
                  value={formData.contractor}
                  onChange={handleInputChange}
                  contacts={contacts}
                  placeholder="Select contractor"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="contractorEmail"
                    value={formData.contractorEmail}
                    onChange={handleInputChange}
                    placeholder="contractor@email.com"
                    className="form-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="contractorPhone"
                    value={formData.contractorPhone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                    className="form-input w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Work Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={4}
              placeholder="Describe the maintenance work performed, issues found, and actions taken..."
              className="form-input w-full"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Provide a detailed description of the work completed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Wrench className="w-4 h-4 inline mr-2" />
              Materials Used
            </label>
            <textarea
              name="materialsUsed"
              value={formData.materialsUsed}
              onChange={handleInputChange}
              rows={3}
              placeholder="List materials, parts, or supplies used (e.g., HVAC filter, pipe fittings, paint)"
              className="form-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <DollarSign className="w-4 h-4 inline mr-2" />
              Total Cost
            </label>
            <input
              type="number"
              name="cost"
              value={formData.cost}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="form-input w-full"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Total amount charged for this maintenance service
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Any additional notes, recommendations, or follow-up actions needed..."
              className="form-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Upload className="w-4 h-4 inline mr-2" />
              Attachments
            </label>
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-400 dark:text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PDF, DOC, DOCX, JPG, PNG (MAX. 10MB)
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </label>
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          {file.size && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="text-red-500">*</span> Required fields
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn text-white"
                style={{backgroundColor: "#456654"}}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#3a5548";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#456654";
                }}
              >
                {record ? "Update" : "Save"} Record
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalBlank>
  );
}

export default MaintenanceRecordForm;
