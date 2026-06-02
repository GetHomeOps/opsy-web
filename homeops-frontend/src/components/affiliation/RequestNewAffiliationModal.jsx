import React, {useState, useMemo, useCallback} from "react";
import ModalBlank from "../ModalBlank";
import ImageUploadField from "../ImageUploadField";
import useImageUpload from "../../hooks/useImageUpload";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import {usStates} from "../../data/states";

const EMPTY_AGENCY_FORM = {
  requestedName: "",
  city: "",
  state: "",
  website: "",
  mainOfficeName: "",
  mainTeamName: "",
  logoUrl: "",
};

const EMPTY_OFFICE_FORM = {
  requestedName: "",
  addressLine1: "",
  city: "",
  state: "",
  phone: "",
};

function normalizeStateCode(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const byCode = usStates.find((s) => s.code.toLowerCase() === trimmed.toLowerCase());
  if (byCode) return byCode.code;
  const byName = usStates.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  return byName?.code || trimmed.slice(0, 2).toUpperCase();
}

function RequestNewAffiliationModal({
  open,
  onClose,
  requestType,
  onSubmit,
  submitting = false,
  error = null,
}) {
  const [agencyForm, setAgencyForm] = useState(EMPTY_AGENCY_FORM);
  const [officeForm, setOfficeForm] = useState(EMPTY_OFFICE_FORM);
  const [requestedName, setRequestedName] = useState("");
  const [notes, setNotes] = useState("");

  const isAgencyRequest = requestType === "agency";
  const isOfficeRequest = requestType === "office";

  const {
    uploadImage,
    imagePreviewUrl,
    uploadedImageUrl,
    imageUploading,
    imageUploadError,
    setImageUploadError,
    clearPreview,
    clearUploadedUrl,
  } = useImageUpload({
    uploadFolder: S3_UPLOAD_FOLDER.AGENCIES,
    onSuccess: (key) => setAgencyForm((prev) => ({...prev, logoUrl: key})),
  });

  const logoDisplaySrc = useMemo(() => {
    if (imagePreviewUrl) return imagePreviewUrl;
    if (uploadedImageUrl) return uploadedImageUrl;
    const logoUrl = (agencyForm.logoUrl || "").trim();
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) return logoUrl;
    return null;
  }, [imagePreviewUrl, uploadedImageUrl, agencyForm.logoUrl]);

  const titles = {
    agency: "Request New Agency",
    office: "Request New Office",
    team: "Request New Team",
  };

  const resetForm = () => {
    setAgencyForm(EMPTY_AGENCY_FORM);
    setOfficeForm(EMPTY_OFFICE_FORM);
    setRequestedName("");
    setNotes("");
    clearPreview();
    clearUploadedUrl();
    setImageUploadError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const handleAgencyFieldChange = (field, value) => {
    setAgencyForm((prev) => ({...prev, [field]: value}));
  };

  const handleOfficeFieldChange = (field, value) => {
    setOfficeForm((prev) => ({...prev, [field]: value}));
  };

  const handleRemoveLogo = useCallback(() => {
    setAgencyForm((prev) => ({...prev, logoUrl: ""}));
    clearPreview();
    clearUploadedUrl();
    setImageUploadError(null);
  }, [clearPreview, clearUploadedUrl, setImageUploadError]);

  const handlePasteLogoUrl = useCallback(() => {
    const url = window.prompt("Paste logo image URL (https://...)");
    if (url?.trim()) {
      setAgencyForm((prev) => ({...prev, logoUrl: url.trim()}));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isAgencyRequest) {
      const payload = {
        requestedName: agencyForm.requestedName.trim(),
        city: agencyForm.city.trim() || null,
        state: normalizeStateCode(agencyForm.state) || null,
        website: agencyForm.website.trim() || null,
        mainOfficeName: agencyForm.mainOfficeName.trim() || null,
        mainTeamName: agencyForm.mainTeamName.trim() || null,
        logoUrl: agencyForm.logoUrl.trim() || null,
      };
      const ok = await onSubmit?.(payload);
      if (ok !== false) resetForm();
      return;
    }

    if (isOfficeRequest) {
      const ok = await onSubmit?.({
        requestedName: officeForm.requestedName.trim(),
        addressLine1: officeForm.addressLine1.trim() || null,
        city: officeForm.city.trim() || null,
        state: normalizeStateCode(officeForm.state) || null,
        phone: officeForm.phone.trim() || null,
      });
      if (ok !== false) resetForm();
      return;
    }

    const ok = await onSubmit?.({
      requestedName: requestedName.trim(),
      notes: notes.trim() || null,
    });
    if (ok !== false) resetForm();
  };

  const agencySubmitDisabled =
    submitting || imageUploading || !agencyForm.requestedName.trim();
  const officeSubmitDisabled = submitting || !officeForm.requestedName.trim();
  const teamSubmitDisabled = submitting || !requestedName.trim();

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(v) => !v && handleClose()}
      backdropZClassName="z-[300]"
      dialogZClassName="z-[300]"
      contentClassName={
        isAgencyRequest || isOfficeRequest
          ? "max-w-lg overflow-visible"
          : "max-w-md overflow-visible"
      }
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {titles[requestType] || "Request New Affiliation"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Submit for super admin review. You can continue using HomeOps while your request is pending.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isAgencyRequest ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={agencyForm.requestedName}
                  onChange={(e) => handleAgencyFieldChange("requestedName", e.target.value)}
                  className="form-input w-full"
                  placeholder="Agency / brokerage name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Logo (optional)
                </label>
                <ImageUploadField
                  imageSrc={logoDisplaySrc}
                  hasImage={Boolean(logoDisplaySrc)}
                  imageUploading={imageUploading}
                  onUpload={uploadImage}
                  onRemove={handleRemoveLogo}
                  onPasteUrl={handlePasteLogoUrl}
                  imageUploadError={imageUploadError}
                  onDismissError={() => setImageUploadError(null)}
                  size="sm"
                  alt="Agency logo"
                  uploadLabel="Upload logo"
                  removeLabel="Remove logo"
                  emptyLabel="Add logo"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={agencyForm.city}
                    onChange={(e) => handleAgencyFieldChange("city", e.target.value)}
                    className="form-input w-full"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State
                  </label>
                  <select
                    value={agencyForm.state}
                    onChange={(e) => handleAgencyFieldChange("state", e.target.value)}
                    className="form-select w-full"
                  >
                    <option value="">Select state...</option>
                    {usStates.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={agencyForm.website}
                  onChange={(e) => handleAgencyFieldChange("website", e.target.value)}
                  className="form-input w-full"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Main office
                </label>
                <input
                  type="text"
                  value={agencyForm.mainOfficeName}
                  onChange={(e) => handleAgencyFieldChange("mainOfficeName", e.target.value)}
                  className="form-input w-full"
                  placeholder="Primary office name (defaults to “Agency Name — Main Office”)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Main team
                </label>
                <input
                  type="text"
                  value={agencyForm.mainTeamName}
                  onChange={(e) => handleAgencyFieldChange("mainTeamName", e.target.value)}
                  className="form-input w-full"
                  placeholder="Primary team name (optional)"
                />
              </div>
            </>
          ) : isOfficeRequest ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Office name *
                </label>
                <input
                  type="text"
                  required
                  value={officeForm.requestedName}
                  onChange={(e) => handleOfficeFieldChange("requestedName", e.target.value)}
                  className="form-input w-full"
                  placeholder="Office name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={officeForm.addressLine1}
                  onChange={(e) => handleOfficeFieldChange("addressLine1", e.target.value)}
                  className="form-input w-full"
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={officeForm.city}
                    onChange={(e) => handleOfficeFieldChange("city", e.target.value)}
                    className="form-input w-full"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State
                  </label>
                  <select
                    value={officeForm.state}
                    onChange={(e) => handleOfficeFieldChange("state", e.target.value)}
                    className="form-select w-full"
                  >
                    <option value="">Select state...</option>
                    {usStates.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={officeForm.phone}
                  onChange={(e) => handleOfficeFieldChange("phone", e.target.value)}
                  className="form-input w-full"
                  placeholder="(555) 555-5555"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={requestedName}
                  onChange={(e) => setRequestedName(e.target.value)}
                  className="form-input w-full"
                  placeholder="Team name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-textarea w-full"
                  rows={3}
                  placeholder="Additional details to help verification"
                />
              </div>
            </>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              disabled={submitting || imageUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={
                isAgencyRequest
                  ? agencySubmitDisabled
                  : isOfficeRequest
                    ? officeSubmitDisabled
                    : teamSubmitDisabled
              }
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </ModalBlank>
  );
}

export default RequestNewAffiliationModal;
