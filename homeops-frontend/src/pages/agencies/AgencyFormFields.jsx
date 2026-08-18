import React, {useEffect, useMemo, useCallback, useState, useRef} from "react";
import {
  AlertCircle,
  Building2,
  Loader2,
  Globe,
  MapPin,
  Phone,
  Plus,
  Users,
  Pencil,
  Check,
  X,
} from "lucide-react";
import ImageUploadField from "../../components/ImageUploadField";
import UsStateSelect from "../../components/UsStateSelect";
import useImageUpload from "../../hooks/useImageUpload";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import AppApi from "../../api/api";
import {usStates} from "../../data/states";

const AGENCY_FORM_KEYS = [
  "name",
  "website",
  "addressLine1",
  "city",
  "state",
  "phone",
  "logoUrl",
];

function normalizeAgencyFormValues(values) {
  const normalized = {};
  for (const key of AGENCY_FORM_KEYS) {
    normalized[key] = String(values?.[key] ?? "").trim();
  }
  if (values?.officeName !== undefined) {
    normalized.officeName = String(values.officeName ?? "").trim();
  }
  return normalized;
}

function agencyFormDiffers(
  baseline,
  current,
  {includeOfficeName = false} = {},
) {
  if (!baseline || !current) return false;
  for (const key of AGENCY_FORM_KEYS) {
    if (baseline[key] !== current[key]) return true;
  }
  if (includeOfficeName && baseline.officeName !== current.officeName)
    return true;
  return false;
}

function structureDraftHasContent(draft) {
  if (!draft) return false;
  return Object.values(draft).some((value) => String(value ?? "").trim() !== "");
}

function officeRowDiffers(office, draft) {
  if (!office || !draft) return false;
  return (
    String(office.name || "").trim() !== String(draft.name || "").trim() ||
    String(office.addressLine1 || "").trim() !==
      String(draft.addressLine1 || "").trim() ||
    String(office.city || "").trim() !== String(draft.city || "").trim() ||
    normalizeStateCode(office.state) !== normalizeStateCode(draft.state) ||
    String(office.phone || "").trim() !== String(draft.phone || "").trim()
  );
}

function teamRowDiffers(team, draft) {
  if (!team || !draft) return false;
  return (
    String(team.name || "").trim() !== String(draft.name || "").trim() ||
    String(team.officeId ?? "") !== String(draft.officeId ?? "")
  );
}

function validateOfficeName(draft) {
  const errs = {};
  if (!draft?.name?.trim()) errs.name = "Office name is required";
  return errs;
}

function validateTeamDraft(draft) {
  const errs = {};
  if (!draft?.officeId) errs.officeId = "Office is required";
  if (!draft?.name?.trim()) errs.name = "Team name is required";
  return errs;
}

const EMPTY_FORM = {
  name: "",
  website: "",
  addressLine1: "",
  city: "",
  state: "",
  phone: "",
  officeName: "",
  logoUrl: "",
  /** Working image URL from API (presigned); not part of dirty checks */
  logoDisplayUrl: "",
};

const EMPTY_NEW_OFFICE = {
  name: "",
  addressLine1: "",
  city: "",
  state: "",
  phone: "",
};

const EMPTY_NEW_TEAM = {officeId: "", name: ""};

const TABS = [
  {id: "agency", label: "Agency"},
  {id: "offices", label: "Offices"},
  {id: "teams", label: "Teams"},
];

const inlineControlClass =
  "h-9 min-h-9 w-full py-0 text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 focus:border-[#456564] dark:focus:border-[#456564] rounded-md";

const inlineInputClass = `form-input ${inlineControlClass}`;

const inlineSelectClass = `form-select ${inlineControlClass}`;

const officeFormFieldClass =
  "form-input w-full h-9 min-h-9 py-0 text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm";

const officeStateButtonClass =
  "!h-9 !min-h-9 !py-0 rounded-lg shadow-sm";

function InlineEditCell({error, children, center = false}) {
  return (
    <div>
      <div
        className={`flex min-h-9 items-center ${center ? "justify-center" : ""}`}
      >
        {children}
      </div>
      {error ? <FieldErrorMessage message={error} /> : null}
    </div>
  );
}

function fieldErrorClass(hasError) {
  return hasError ? "!border-red-500 focus:!border-red-500" : "";
}

function FieldErrorMessage({message, reserveSpace = true}) {
  if (!message && !reserveSpace) return null;
  return (
    <div
      className={`mt-1 flex items-start text-sm text-red-500${reserveSpace ? " min-h-[1.25rem]" : ""}`}
      aria-live="polite"
    >
      {message ? (
        <>
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{message}</span>
        </>
      ) : null}
    </div>
  );
}

function normalizeStateCode(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const byCode = usStates.find(
    (s) => s.code.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byCode) return byCode.code;
  const byName = usStates.find(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return byName?.code || trimmed.slice(0, 2).toUpperCase();
}

function normalizeStateName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const byCode = usStates.find(
    (s) => s.code.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byCode) return byCode.name;
  const byName = usStates.find(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return byName?.name || trimmed;
}

function formatLocationLine({addressLine1, city, state}) {
  const stateLabel = normalizeStateName(state);
  return [addressLine1, city, stateLabel].filter(Boolean).join(", ");
}

function toHeroDisplay(values) {
  const v = values || {};
  return {
    name: v.name || "",
    website: v.website || "",
    addressLine1: v.addressLine1 || "",
    city: v.city || "",
    state: normalizeStateName(v.state),
    phone: v.phone || "",
  };
}

function InlineActionButtons({onSave, onCancel, saving}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50"
        title="Save"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50"
        title="Cancel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function OfficesInlineTable({
  rows,
  loading,
  emptyMessage,
  editingId,
  editDraft,
  savingId,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
  editErrors = {},
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading...
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
      <table className="table-fixed w-full text-sm dark:text-gray-300">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[22%]" />
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-900/40">
          <tr>
            <th className="px-4 py-3 text-left">Office</th>
            <th className="px-4 py-3 text-left">Address</th>
            <th className="px-4 py-3 text-left">City</th>
            <th className="px-4 py-3 text-center">State</th>
            <th className="px-4 py-3 text-left">Phone</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-center w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
          {rows.map((row) => {
            const isEditing = editingId === row.id;
            const isSaving = savingId === `office-${row.id}`;
            return (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-900/20"
              >
                <td className="px-4 py-2 align-middle">
                  {isEditing ? (
                    <InlineEditCell error={editErrors.name}>
                      <input
                        type="text"
                        value={editDraft.name}
                        onChange={(e) =>
                          onDraftChange({...editDraft, name: e.target.value})
                        }
                        className={`${inlineInputClass} min-w-0 ${fieldErrorClass(editErrors.name)}`}
                        autoFocus
                      />
                    </InlineEditCell>
                  ) : (
                    <span
                      className="block truncate"
                      title={row.name || undefined}
                    >
                      {row.name || "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 align-middle">
                  {isEditing ? (
                    <InlineEditCell>
                      <input
                        type="text"
                        value={editDraft.addressLine1}
                        onChange={(e) =>
                          onDraftChange({
                            ...editDraft,
                            addressLine1: e.target.value,
                          })
                        }
                        className={inlineInputClass}
                        placeholder="Street address"
                      />
                    </InlineEditCell>
                  ) : (
                    <span
                      className="block truncate"
                      title={row.addressLine1 || undefined}
                    >
                      {row.addressLine1 || "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 align-middle">
                  {isEditing ? (
                    <InlineEditCell>
                      <input
                        type="text"
                        value={editDraft.city}
                        onChange={(e) =>
                          onDraftChange({...editDraft, city: e.target.value})
                        }
                        className={inlineInputClass}
                      />
                    </InlineEditCell>
                  ) : (
                    row.city || "—"
                  )}
                </td>
                <td className="px-2 py-2 align-middle text-center">
                  {isEditing ? (
                    <InlineEditCell center>
                      <UsStateSelect
                        value={editDraft.state}
                        onChange={(state) =>
                          onDraftChange({...editDraft, state})
                        }
                        buttonClassName={officeStateButtonClass}
                      />
                    </InlineEditCell>
                  ) : (
                    row.state || "—"
                  )}
                </td>
                <td className="px-4 py-2 align-middle">
                  {isEditing ? (
                    <InlineEditCell>
                      <input
                        type="text"
                        value={editDraft.phone}
                        onChange={(e) =>
                          onDraftChange({...editDraft, phone: e.target.value})
                        }
                        className={inlineInputClass}
                      />
                    </InlineEditCell>
                  ) : (
                    row.phone || "—"
                  )}
                </td>
                <td className="px-4 py-2 align-middle text-center capitalize">
                  {row.status || "—"}
                </td>
                <td className="px-4 py-2 align-middle text-center">
                  <div
                    className={`flex items-center justify-center ${isEditing ? "min-h-9" : ""}`}
                  >
                    {isEditing ? (
                      <InlineActionButtons
                        onSave={() => onSave(row)}
                        onCancel={onCancelEdit}
                        saving={isSaving}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartEdit(row)}
                        disabled={Boolean(editingId)}
                        className="p-1.5 rounded-md text-[#456564] hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-40"
                        title="Edit office"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamsInlineTable({
  rows,
  offices,
  loading,
  emptyMessage,
  editingId,
  editDraft,
  savingId,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
  editErrors = {},
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading...
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
      <table className="table-fixed w-full text-sm dark:text-gray-300">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[38%]" />
          <col className="w-[18%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-900/40">
          <tr>
            <th className="px-4 py-3 text-left">Team</th>
            <th className="px-4 py-3 text-left">Office</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-center w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
          {rows.map((row) => {
            const isEditing = editingId === row.id;
            const isSaving = savingId === `team-${row.id}`;
            return (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-900/20"
              >
                <td className="px-4 py-2 align-middle">
                  {isEditing ? (
                    <InlineEditCell error={editErrors.name}>
                      <input
                        type="text"
                        value={editDraft.name}
                        onChange={(e) =>
                          onDraftChange({...editDraft, name: e.target.value})
                        }
                        className={`${inlineInputClass} ${fieldErrorClass(editErrors.name)}`}
                        autoFocus
                      />
                    </InlineEditCell>
                  ) : (
                    row.name || "—"
                  )}
                </td>
                <td className="px-4 py-2 align-middle">
                  {isEditing ? (
                    <InlineEditCell error={editErrors.officeId}>
                      <select
                        value={editDraft.officeId}
                        onChange={(e) =>
                          onDraftChange({
                            ...editDraft,
                            officeId: e.target.value,
                          })
                        }
                        className={`${inlineSelectClass} ${fieldErrorClass(editErrors.officeId)}`}
                      >
                        {offices.map((office) => (
                          <option key={office.id} value={office.id}>
                            {office.name}
                          </option>
                        ))}
                      </select>
                    </InlineEditCell>
                  ) : (
                    <span className="block truncate" title={row.officeName || undefined}>
                      {row.officeName || "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 align-middle text-center capitalize">
                  {row.status || "—"}
                </td>
                <td className="px-4 py-2 align-middle text-center">
                  <div className="flex items-center justify-center">
                    {isEditing ? (
                      <InlineActionButtons
                        onSave={() => onSave(row)}
                        onCancel={onCancelEdit}
                        saving={isSaving}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartEdit(row)}
                        disabled={Boolean(editingId)}
                        className="p-1.5 rounded-md text-[#456564] hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-40"
                        title="Edit team"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgencyFormFields({
  initialValues,
  editingId = null,
  saving = false,
  formError = null,
  onSubmit,
  onSaveSuccess,
  onAgencyCreated,
}) {
  const [form, setForm] = useState({...EMPTY_FORM, ...initialValues});
  const [committedHero, setCommittedHero] = useState(() =>
    toHeroDisplay({...EMPTY_FORM, ...initialValues}),
  );
  const [activeTab, setActiveTab] = useState("agency");
  const [offices, setOffices] = useState([]);
  const [teams, setTeams] = useState([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [structureError, setStructureError] = useState(null);
  const [addingOffice, setAddingOffice] = useState(false);
  const [addingTeam, setAddingTeam] = useState(false);
  const [newOffice, setNewOffice] = useState({...EMPTY_NEW_OFFICE});
  const [newTeam, setNewTeam] = useState({...EMPTY_NEW_TEAM});
  const [editingOfficeId, setEditingOfficeId] = useState(null);
  const [officeEditDraft, setOfficeEditDraft] = useState(null);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [teamEditDraft, setTeamEditDraft] = useState(null);
  const [savingStructureId, setSavingStructureId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [newOfficeErrors, setNewOfficeErrors] = useState({});
  const [newTeamErrors, setNewTeamErrors] = useState({});
  const [officeEditErrors, setOfficeEditErrors] = useState({});
  const [teamEditErrors, setTeamEditErrors] = useState({});
  const [structureTouched, setStructureTouched] = useState(false);
  const baselineFormRef = useRef(null);
  const baselineLogoDisplayUrlRef = useRef("");

  const agencyId =
    typeof editingId === "number" && Number.isFinite(editingId) && editingId > 0
      ? editingId
      : null;
  const canManageStructure = Boolean(agencyId);
  const isNew = !editingId;

  useEffect(() => {
    const nextForm = {
      ...EMPTY_FORM,
      ...normalizeAgencyFormValues({
        ...EMPTY_FORM,
        ...initialValues,
      }),
      logoDisplayUrl: String(initialValues?.logoDisplayUrl ?? "").trim(),
      state: normalizeStateName(initialValues?.state),
    };
    setForm(nextForm);
    baselineFormRef.current = normalizeAgencyFormValues(nextForm);
    baselineLogoDisplayUrlRef.current = String(
      nextForm.logoDisplayUrl ?? "",
    ).trim();
    setCommittedHero(toHeroDisplay(nextForm));
  }, [initialValues, editingId]);

  const hasAgencyChanges = agencyFormDiffers(
    baselineFormRef.current,
    normalizeAgencyFormValues(form),
    {includeOfficeName: isNew},
  );
  const hasNewOfficeDraft = structureDraftHasContent(newOffice);
  const hasNewTeamDraft = structureDraftHasContent(newTeam);
  const editingOffice =
    offices.find((office) => office.id === editingOfficeId) ?? null;
  const editingTeam = teams.find((team) => team.id === editingTeamId) ?? null;
  const hasOfficeEditChanges = officeRowDiffers(
    editingOffice,
    officeEditDraft,
  );
  const hasTeamEditChanges = teamRowDiffers(editingTeam, teamEditDraft);
  const hasStructureChanges =
    hasNewOfficeDraft ||
    hasNewTeamDraft ||
    hasOfficeEditChanges ||
    hasTeamEditChanges;
  const hasChanges =
    hasAgencyChanges || hasStructureChanges || structureTouched;
  const structureSaving =
    addingOffice || addingTeam || Boolean(savingStructureId);

  const logoKey = (form.logoUrl || "").trim();
  const logoDisplayUrl = (form.logoDisplayUrl || "").trim();

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
    onSuccess: (key) =>
      setForm((f) => ({...f, logoUrl: key, logoDisplayUrl: ""})),
  });

  const logoKeyNeedsPresigned =
    logoKey && !logoKey.startsWith("blob:") && !logoKey.startsWith("http");

  const {
    url: presignedUrl,
    isLoading: presignedLoading,
    fetchPreview,
    clearUrl: clearPresignedUrl,
    currentKey: presignedKey,
  } = usePresignedPreview({forImage: true});

  useEffect(() => {
    clearPreview();
    clearUploadedUrl();
    clearPresignedUrl();
  }, [editingId, clearPreview, clearUploadedUrl, clearPresignedUrl]);

  useEffect(() => {
    // Skip fetch when API already gave us a display URL for this key
    if (!logoKeyNeedsPresigned) return;
    if (logoDisplayUrl && !logoDisplayUrl.startsWith("blob:")) return;
    fetchPreview(logoKey);
  }, [logoKeyNeedsPresigned, logoKey, logoDisplayUrl, fetchPreview]);

  const logoDisplaySrc = useMemo(() => {
    if (imagePreviewUrl) return imagePreviewUrl;
    if (uploadedImageUrl) return uploadedImageUrl;
    if (logoDisplayUrl) return logoDisplayUrl;
    if (logoKey.startsWith("http://") || logoKey.startsWith("https://"))
      return logoKey;
    if (presignedUrl && presignedKey === logoKey) return presignedUrl;
    return null;
  }, [
    imagePreviewUrl,
    uploadedImageUrl,
    logoDisplayUrl,
    logoKey,
    presignedUrl,
    presignedKey,
  ]);

  const hasLogo = Boolean(logoDisplaySrc);
  const logoImageLoading =
    presignedLoading &&
    logoKeyNeedsPresigned &&
    !imagePreviewUrl &&
    !uploadedImageUrl &&
    !logoDisplayUrl;

  const loadStructure = useCallback(async () => {
    if (!agencyId) {
      setOffices([]);
      setTeams([]);
      return;
    }
    setStructureLoading(true);
    setStructureError(null);
    try {
      const [officeList, teamList] = await Promise.all([
        AppApi.listAdminAgencyOffices(agencyId),
        AppApi.listAdminAgencyTeams(agencyId),
      ]);
      setOffices(officeList || []);
      setTeams(teamList || []);
    } catch (err) {
      setStructureError(err.message || "Failed to load offices and teams");
      setOffices([]);
      setTeams([]);
    } finally {
      setStructureLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    setEditingOfficeId(null);
    setOfficeEditDraft(null);
    setEditingTeamId(null);
    setTeamEditDraft(null);
    setOfficeEditErrors({});
    setTeamEditErrors({});
    setNewOfficeErrors({});
    setNewTeamErrors({});
    setStructureTouched(false);
    loadStructure();
  }, [loadStructure]);

  useEffect(() => {
    if (formError === "Agency name is required.") {
      setFieldErrors({name: formError});
      setActiveTab("agency");
    }
  }, [formError]);

  const handleRemoveLogo = useCallback(() => {
    setForm((f) => ({...f, logoUrl: "", logoDisplayUrl: ""}));
    clearPreview();
    clearUploadedUrl();
    clearPresignedUrl();
    setImageUploadError(null);
  }, [clearPreview, clearUploadedUrl, clearPresignedUrl, setImageUploadError]);

  const handlePasteLogoUrl = useCallback(() => {
    const url = window.prompt("Paste logo image URL (https://...)");
    if (url?.trim()) {
      setForm((f) => ({
        ...f,
        logoUrl: url.trim(),
        logoDisplayUrl: url.trim(),
      }));
      clearPreview();
      clearUploadedUrl();
      clearPresignedUrl();
    }
  }, [clearPreview, clearUploadedUrl, clearPresignedUrl]);

  const handleAddOffice = async () => {
    if (!agencyId) return false;
    const errs = validateOfficeName(newOffice);
    if (Object.keys(errs).length > 0) {
      setNewOfficeErrors(errs);
      return false;
    }
    setNewOfficeErrors({});
    setAddingOffice(true);
    setStructureError(null);
    try {
      await AppApi.createAdminAgencyOffice(agencyId, {
        name: newOffice.name.trim(),
        addressLine1: newOffice.addressLine1.trim() || null,
        city: newOffice.city.trim() || null,
        state: newOffice.state.trim() || null,
        phone: newOffice.phone.trim() || null,
      });
      setNewOffice({...EMPTY_NEW_OFFICE});
      setStructureTouched(true);
      await loadStructure();
      return true;
    } catch (err) {
      setStructureError(
        Array.isArray(err)
          ? err.join(" ")
          : err.message || "Failed to add office",
      );
      return false;
    } finally {
      setAddingOffice(false);
    }
  };

  const handleAddTeam = async () => {
    if (!agencyId) return false;
    const errs = validateTeamDraft(newTeam);
    if (Object.keys(errs).length > 0) {
      setNewTeamErrors(errs);
      return false;
    }
    setNewTeamErrors({});
    setAddingTeam(true);
    setStructureError(null);
    try {
      await AppApi.createAdminAgencyTeam(agencyId, {
        officeId: Number(newTeam.officeId),
        name: newTeam.name.trim(),
      });
      setNewTeam({...EMPTY_NEW_TEAM});
      setStructureTouched(true);
      await loadStructure();
      return true;
    } catch (err) {
      setStructureError(
        Array.isArray(err)
          ? err.join(" ")
          : err.message || "Failed to add team",
      );
      return false;
    } finally {
      setAddingTeam(false);
    }
  };

  const startEditOffice = (office) => {
    setEditingTeamId(null);
    setTeamEditDraft(null);
    setTeamEditErrors({});
    setOfficeEditErrors({});
    setEditingOfficeId(office.id);
    setOfficeEditDraft({
      name: office.name || "",
      addressLine1: office.addressLine1 || "",
      city: office.city || "",
      state: normalizeStateCode(office.state),
      phone: office.phone || "",
    });
  };

  const cancelEditOffice = () => {
    setEditingOfficeId(null);
    setOfficeEditDraft(null);
    setOfficeEditErrors({});
  };

  const saveOfficeEdit = async (office) => {
    if (!agencyId) return false;
    const errs = validateOfficeName(officeEditDraft);
    if (Object.keys(errs).length > 0) {
      setOfficeEditErrors(errs);
      return false;
    }
    setOfficeEditErrors({});
    setSavingStructureId(`office-${office.id}`);
    setStructureError(null);
    try {
      const updated = await AppApi.updateAdminAgencyOffice(
        agencyId,
        office.id,
        {
          name: officeEditDraft.name.trim(),
          addressLine1: officeEditDraft.addressLine1.trim() || null,
          city: officeEditDraft.city.trim() || null,
          state: officeEditDraft.state.trim() || null,
          phone: officeEditDraft.phone.trim() || null,
        },
      );
      setOffices((prev) =>
        prev.map((o) => (o.id === office.id ? {...o, ...updated} : o)),
      );
      setTeams((prev) =>
        prev.map((t) =>
          Number(t.officeId) === office.id
            ? {...t, officeName: updated.name}
            : t,
        ),
      );
      cancelEditOffice();
      setStructureTouched(true);
      return true;
    } catch (err) {
      setStructureError(
        Array.isArray(err)
          ? err.join(" ")
          : err.message || "Failed to update office",
      );
      return false;
    } finally {
      setSavingStructureId(null);
    }
  };

  const startEditTeam = (team) => {
    setEditingOfficeId(null);
    setOfficeEditDraft(null);
    setOfficeEditErrors({});
    setTeamEditErrors({});
    setEditingTeamId(team.id);
    setTeamEditDraft({
      name: team.name || "",
      officeId: String(team.officeId || ""),
    });
  };

  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setTeamEditDraft(null);
    setTeamEditErrors({});
  };

  const saveTeamEdit = async (team) => {
    if (!agencyId) return false;
    const errs = validateTeamDraft(teamEditDraft);
    if (Object.keys(errs).length > 0) {
      setTeamEditErrors(errs);
      return false;
    }
    setTeamEditErrors({});
    setSavingStructureId(`team-${team.id}`);
    setStructureError(null);
    try {
      const updated = await AppApi.updateAdminAgencyTeam(agencyId, team.id, {
        name: teamEditDraft.name.trim(),
        officeId: Number(teamEditDraft.officeId),
      });
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? {...t, ...updated} : t)),
      );
      cancelEditTeam();
      setStructureTouched(true);
      return true;
    } catch (err) {
      setStructureError(
        Array.isArray(err)
          ? err.join(" ")
          : err.message || "Failed to update team",
      );
      return false;
    } finally {
      setSavingStructureId(null);
    }
  };

  const handleSaveAgency = async (e) => {
    e.preventDefault();
    const shouldSaveAgency = isNew || hasAgencyChanges;

    if (shouldSaveAgency) {
      const errs = {};
      if (!form.name.trim()) errs.name = "Agency name is required";
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setActiveTab("agency");
        return;
      }
      setFieldErrors({});
    }

    if (hasOfficeEditChanges) {
      const errs = validateOfficeName(officeEditDraft);
      if (Object.keys(errs).length > 0) {
        setOfficeEditErrors(errs);
        setActiveTab("offices");
        return;
      }
    }
    if (hasNewOfficeDraft) {
      const errs = validateOfficeName(newOffice);
      if (Object.keys(errs).length > 0) {
        setNewOfficeErrors(errs);
        setActiveTab("offices");
        return;
      }
    }
    if (hasTeamEditChanges) {
      const errs = validateTeamDraft(teamEditDraft);
      if (Object.keys(errs).length > 0) {
        setTeamEditErrors(errs);
        setActiveTab("teams");
        return;
      }
    }
    if (hasNewTeamDraft) {
      const errs = validateTeamDraft(newTeam);
      if (Object.keys(errs).length > 0) {
        setNewTeamErrors(errs);
        setActiveTab("teams");
        return;
      }
    }

    if (shouldSaveAgency) {
      const result = await onSubmit?.(form);
      if (!result?.agency) return;
      // API returns null for empty optional fields — coerce so controlled inputs stay strings
      const saved = {
        ...EMPTY_FORM,
        ...normalizeAgencyFormValues({
          name: result.agency.name,
          website: result.agency.website,
          addressLine1: result.agency.addressLine1,
          city: result.agency.city,
          state: result.agency.state,
          phone: result.agency.phone,
          logoUrl: result.agency.logoUrl,
        }),
        state: normalizeStateName(result.agency.state),
        logoDisplayUrl: String(result.agency.logoDisplayUrl ?? "").trim(),
      };
      baselineFormRef.current = normalizeAgencyFormValues(saved);
      baselineLogoDisplayUrlRef.current = saved.logoDisplayUrl;
      setCommittedHero(toHeroDisplay(saved));
      // Keep logo visible immediately from API display URL (blob may be cleared on remount)
      setForm((f) => ({
        ...f,
        ...saved,
        state: normalizeStateName(saved.state),
      }));
      if (result.agency.id && !editingId) {
        onAgencyCreated?.(result.agency);
      }
    }

    if (hasOfficeEditChanges && editingOffice) {
      const saved = await saveOfficeEdit(editingOffice);
      if (!saved) {
        setActiveTab("offices");
        return;
      }
    }
    if (hasTeamEditChanges && editingTeam) {
      const saved = await saveTeamEdit(editingTeam);
      if (!saved) {
        setActiveTab("teams");
        return;
      }
    }
    if (hasNewOfficeDraft) {
      const saved = await handleAddOffice();
      if (!saved) {
        setActiveTab("offices");
        return;
      }
    }
    if (hasNewTeamDraft) {
      const saved = await handleAddTeam();
      if (!saved) {
        setActiveTab("teams");
        return;
      }
    }

    setStructureTouched(false);
    if (editingId) {
      onSaveSuccess?.();
    }
  };

  const handleCancelChanges = () => {
    const baseline = baselineFormRef.current;
    const restored = {
      ...EMPTY_FORM,
      ...(baseline || {}),
      state: normalizeStateName(baseline?.state),
      logoDisplayUrl: baselineLogoDisplayUrlRef.current || "",
    };
    setForm(restored);
    setCommittedHero(toHeroDisplay(restored));
    clearPreview();
    clearUploadedUrl();
    clearPresignedUrl();
    setImageUploadError(null);
    setNewOffice({...EMPTY_NEW_OFFICE});
    setNewTeam({...EMPTY_NEW_TEAM});
    setEditingOfficeId(null);
    setOfficeEditDraft(null);
    setEditingTeamId(null);
    setTeamEditDraft(null);
    setOfficeEditErrors({});
    setTeamEditErrors({});
    setNewOfficeErrors({});
    setNewTeamErrors({});
    setFieldErrors({});
    setStructureError(null);
    setStructureTouched(false);
  };

  const hero = isNew ? form : committedHero;
  const heroLocationLine = formatLocationLine(
    isNew
      ? form
      : {
          addressLine1: committedHero.addressLine1,
          city: committedHero.city,
          state: committedHero.state,
        },
  );

  return (
    <form onSubmit={handleSaveAgency}>
      {/* Header card — logo + summary (matches contractor form) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 w-full">
            <ImageUploadField
              imageSrc={logoDisplaySrc}
              hasImage={hasLogo}
              imageUploading={imageUploading}
              imageLoading={logoImageLoading}
              onUpload={uploadImage}
              onRemove={handleRemoveLogo}
              onPasteUrl={handlePasteLogoUrl}
              showRemove={hasLogo}
              imageUploadError={imageUploadError}
              onDismissError={() => setImageUploadError(null)}
              size="md"
              placeholder="generic"
              alt="Agency logo"
              uploadLabel="Upload logo"
              removeLabel="Remove logo"
              pasteUrlLabel="Paste URL"
              emptyLabel="Add logo"
            />

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words mb-3">
                {hero.name.trim() || (editingId ? "Edit agency" : "New Agency")}
              </h1>

              <div className="space-y-1.5">
                {heroLocationLine && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                    <span>{heroLocationLine}</span>
                  </div>
                )}
                {hero.website?.trim() && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 min-w-0">
                    <Globe className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                    <span className="truncate">{hero.website}</span>
                  </div>
                )}
                {hero.phone?.trim() && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <Phone className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                    <span>{hero.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {formError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
          {formError}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-6">
            <nav
              className="flex flex-wrap gap-x-8 gap-y-2"
              aria-label="Agency tabs"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                    activeTab === tab.id
                      ? "border-[#456564] text-[#456564] dark:text-[#7aa3a2]"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                  {tab.id === "offices" && offices.length > 0 && (
                    <span className="ml-1.5 text-xs text-gray-400">
                      ({offices.length})
                    </span>
                  )}
                  {tab.id === "teams" && teams.length > 0 && (
                    <span className="ml-1.5 text-xs text-gray-400">
                      ({teams.length})
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "agency" && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#456564]" />
                Agency Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                    Agency Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name ?? ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({...f, name}));
                      if (fieldErrors.name) {
                        setFieldErrors((prev) => {
                          const next = {...prev};
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                    className={`form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm ${fieldErrorClass(fieldErrors.name)}`}
                  />
                  <FieldErrorMessage
                    message={fieldErrors.name}
                    reserveSpace={false}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                    Website
                  </label>
                  <input
                    type="text"
                    value={form.website ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({...f, website: e.target.value}))
                    }
                    className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                    placeholder="https://"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({...f, phone: e.target.value}))
                    }
                    className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                    placeholder="(555) 555-5555"
                    autoComplete="tel"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                    Address
                  </label>
                  <input
                    type="text"
                    value={form.addressLine1 ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({...f, addressLine1: e.target.value}))
                    }
                    className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                    placeholder="Street address"
                    autoComplete="street-address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.city ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({...f, city: e.target.value}))
                    }
                    className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                    State
                  </label>
                  <UsStateSelect
                    value={form.state ?? ""}
                    onChange={(state) => setForm((f) => ({...f, state}))}
                    labelFormat="name"
                  />
                </div>
                {!editingId && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                      Main Office Name
                    </label>
                    <input
                      type="text"
                      value={form.officeName ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({...f, officeName: e.target.value}))
                      }
                      className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                      placeholder='Defaults to "{Agency name} — Main Office"'
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Created with the agency. Add more offices in the Offices
                      tab after saving.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "offices" &&
            (!canManageStructure ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                Save the agency first to add offices and teams.
              </p>
            ) : (
              <>
                {structureError && (
                  <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {structureError}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#456564]" />
                      Add office
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                          Office name *
                        </label>
                        <input
                          type="text"
                          value={newOffice.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setNewOffice((o) => ({...o, name}));
                            if (newOfficeErrors.name) {
                              setNewOfficeErrors((prev) => {
                                const next = {...prev};
                                delete next.name;
                                return next;
                              });
                            }
                          }}
                          className={`${officeFormFieldClass} ${fieldErrorClass(newOfficeErrors.name)}`}
                        />
                        <FieldErrorMessage
                          message={newOfficeErrors.name}
                          reserveSpace={false}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                          Address
                        </label>
                        <input
                          type="text"
                          value={newOffice.addressLine1}
                          onChange={(e) =>
                            setNewOffice((o) => ({
                              ...o,
                              addressLine1: e.target.value,
                            }))
                          }
                          className={officeFormFieldClass}
                          placeholder="Street address"
                          autoComplete="street-address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                          City
                        </label>
                        <input
                          type="text"
                          value={newOffice.city}
                          onChange={(e) =>
                            setNewOffice((o) => ({...o, city: e.target.value}))
                          }
                          className={officeFormFieldClass}
                          autoComplete="address-level2"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                          State
                        </label>
                        <UsStateSelect
                          value={newOffice.state}
                          onChange={(state) =>
                            setNewOffice((o) => ({...o, state}))
                          }
                          labelFormat="name"
                          buttonClassName={officeStateButtonClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={newOffice.phone}
                          onChange={(e) =>
                            setNewOffice((o) => ({...o, phone: e.target.value}))
                          }
                          className={officeFormFieldClass}
                          placeholder="(555) 555-5555"
                          autoComplete="tel"
                        />
                      </div>
                      <div className="md:col-span-2 pt-0.5">
                        <button
                          type="button"
                          onClick={handleAddOffice}
                          disabled={addingOffice}
                          className="btn btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2"
                        >
                          {addingOffice ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Add office
                        </button>
                      </div>
                    </div>
                  </div>

                  <OfficesInlineTable
                    loading={structureLoading}
                    rows={offices}
                    emptyMessage="No offices yet. Add one above."
                    editingId={editingOfficeId}
                    editDraft={officeEditDraft}
                    savingId={savingStructureId}
                    onStartEdit={startEditOffice}
                    onCancelEdit={cancelEditOffice}
                    onDraftChange={(draft) => {
                      setOfficeEditDraft(draft);
                      if (officeEditErrors.name && draft.name?.trim()) {
                        setOfficeEditErrors((prev) => {
                          const next = {...prev};
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                    onSave={saveOfficeEdit}
                    editErrors={officeEditErrors}
                  />
                </div>
              </>
            ))}

          {activeTab === "teams" &&
            (!canManageStructure ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                Save the agency first to add offices and teams.
              </p>
            ) : (
              <>
                {structureError && (
                  <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {structureError}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#456564]" />
                      Add team
                    </h3>
                    {offices.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Add at least one office before creating teams.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3 items-start">
                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                              Office *
                            </label>
                            <select
                              value={newTeam.officeId}
                              onChange={(e) => {
                                const officeId = e.target.value;
                                setNewTeam((t) => ({...t, officeId}));
                                if (newTeamErrors.officeId) {
                                  setNewTeamErrors((prev) => {
                                    const next = {...prev};
                                    delete next.officeId;
                                    return next;
                                  });
                                }
                              }}
                              className={`${inlineSelectClass} ${fieldErrorClass(newTeamErrors.officeId)}`}
                            >
                              <option value="">Select office...</option>
                              {offices.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                            <FieldErrorMessage
                              message={newTeamErrors.officeId}
                              reserveSpace={false}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                              Team name *
                            </label>
                            <input
                              type="text"
                              value={newTeam.name}
                              onChange={(e) => {
                                const name = e.target.value;
                                setNewTeam((t) => ({...t, name}));
                                if (newTeamErrors.name) {
                                  setNewTeamErrors((prev) => {
                                    const next = {...prev};
                                    delete next.name;
                                    return next;
                                  });
                                }
                              }}
                              className={`form-input w-full ${fieldErrorClass(newTeamErrors.name)}`}
                            />
                            <FieldErrorMessage
                              message={newTeamErrors.name}
                              reserveSpace={false}
                            />
                          </div>
                        </div>
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={handleAddTeam}
                            disabled={addingTeam}
                            className="btn btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2"
                          >
                            {addingTeam ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            Add team
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <TeamsInlineTable
                    loading={structureLoading}
                    rows={teams}
                    offices={offices}
                    emptyMessage="No teams yet. Add one above."
                    editingId={editingTeamId}
                    editDraft={teamEditDraft}
                    savingId={savingStructureId}
                    onStartEdit={startEditTeam}
                    onCancelEdit={cancelEditTeam}
                    onDraftChange={(draft) => {
                      setTeamEditDraft(draft);
                      setTeamEditErrors((prev) => {
                        const next = {...prev};
                        if (prev.name && draft.name?.trim()) delete next.name;
                        if (prev.officeId && draft.officeId) delete next.officeId;
                        return next;
                      });
                    }}
                    onSave={saveTeamEdit}
                    editErrors={teamEditErrors}
                  />
                </div>
              </>
            ))}
        </div>

        {/* Save footer — matches professional form */}
        <div
          className={`${
            isNew || hasChanges ? "sticky" : "hidden"
          } bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-xl transition-all duration-200`}
        >
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelChanges}
              className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 shadow-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || imageUploading || structureSaving}
              className="btn shadow-sm min-w-[100px] btn-primary disabled:opacity-60"
            >
              {saving || structureSaving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : editingId ? (
                "Update"
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export {EMPTY_FORM as AGENCY_EMPTY_FORM};
export default AgencyFormFields;
