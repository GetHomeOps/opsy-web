import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Link, useLocation, useNavigate, useParams} from "react-router-dom";
import {ArrowLeft, Link2, Loader2, RotateCcw, SlidersHorizontal} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import Banner from "../../partials/containers/Banner";
import AppApi from "../../api/api";
import {
  useAccountBranding,
  DEFAULT_ACCENT,
  DEFAULT_SIDEBAR_TEXT,
} from "../../context/AccountBrandingContext";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {PAGE_LAYOUT, SETTINGS_CARD} from "../../constants/layout";
import ImageUploadField from "../../components/ImageUploadField";
import LogoCropModal from "../../components/LogoCropModal";
import useImageUpload from "../../hooks/useImageUpload";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import AgentCard from "../home/components/AgentCard";

const DEFAULT_CARD_TEXT = "#ffffff";

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  sidebarIconKey: null,
  sidebarIconUrl: null,
  agentCardLogoKey: null,
  agentCardLogoUrl: null,
  agentCardAccentColor: DEFAULT_ACCENT,
  agentCardBackgroundColor: "",
  agentCardAgentLabel: "Your Agent",
  agentCardCompanyName: "",
  sidebarTextColor: DEFAULT_SIDEBAR_TEXT,
  agentCardTextColor: DEFAULT_CARD_TEXT,
};

const PREVIEW_AGENT = {
  name: "Alex Morgan",
  email: "alex@example.com",
  company: null,
  image: null,
  agency: {name: "Sample Brokerage", logoDisplayUrl: null},
};

/** Normalize form values the same way as the save payload for dirty comparison. */
function normalizeForm(form) {
  const logoKey = form.sidebarIconKey || form.agentCardLogoKey || null;
  return {
    accentColor: form.accentColor || null,
    sidebarIconKey: logoKey,
    agentCardLogoKey: logoKey,
    agentCardAccentColor: form.agentCardAccentColor || null,
    agentCardBackgroundColor: form.agentCardBackgroundColor || null,
    agentCardAgentLabel: form.agentCardAgentLabel || null,
    agentCardCompanyName: form.agentCardCompanyName || null,
    sidebarTextColor: form.sidebarTextColor || null,
    agentCardTextColor: form.agentCardTextColor || null,
  };
}

function formsEqual(a, b) {
  const na = normalizeForm(a);
  const nb = normalizeForm(b);
  return Object.keys(na).every((key) => na[key] === nb[key]);
}

function ColorField({label, value, onChange, fallback}) {
  const fallbackHex = fallback || DEFAULT_ACCENT;
  const isValidHex = typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
  const pickerValue = isValidHex ? value : fallbackHex;
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v || null);
          }}
          placeholder={fallbackHex}
          className="form-input font-mono text-xs w-28"
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function formFromBranding(branding) {
  const logoKey = branding.sidebarIconKey || branding.agentCardLogoKey || null;
  const logoUrl = branding.sidebarIconUrl || branding.agentCardLogoUrl || null;
  return {
    accentColor: branding.accentColor || DEFAULT_ACCENT,
    sidebarIconKey: logoKey,
    sidebarIconUrl: logoUrl,
    agentCardLogoKey: logoKey,
    agentCardLogoUrl: logoUrl,
    agentCardAccentColor: branding.agentCardAccentColor || DEFAULT_ACCENT,
    agentCardBackgroundColor: branding.agentCardBackgroundColor || "",
    agentCardAgentLabel: branding.agentCardAgentLabel || "Your Agent",
    agentCardCompanyName: branding.agentCardCompanyName || "",
    sidebarTextColor: branding.sidebarTextColor || DEFAULT_SIDEBAR_TEXT,
    agentCardTextColor: branding.agentCardTextColor || DEFAULT_CARD_TEXT,
  };
}

function CustomizationPage() {
  const {
    accountUrl,
    accountId: accountIdParam,
    agencyId: agencyIdParam,
    teamId: teamIdParam,
  } = useParams();
  const isAgencyMode = Boolean(agencyIdParam);
  const isTeamMode = Boolean(teamIdParam);
  const accountId = accountIdParam ? Number(accountIdParam) : null;
  const agencyId = agencyIdParam ? Number(agencyIdParam) : null;
  const teamId = teamIdParam ? Number(teamIdParam) : null;
  const entityId = isAgencyMode ? agencyId : isTeamMode ? teamId : accountId;
  const navigate = useNavigate();
  const location = useLocation();
  const {currentAccount} = useCurrentAccount();
  const {refreshBranding} = useAccountBranding();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountUrlSlug, setAccountUrlSlug] = useState("");
  const [subtitleMeta, setSubtitleMeta] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [savedForm, setSavedForm] = useState(DEFAULT_FORM);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readOnlyReason, setReadOnlyReason] = useState(null);
  const [banner, setBanner] = useState({open: false, type: "success", message: ""});
  const [fallbackIds, setFallbackIds] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const cropImageSrcRef = React.useRef(null);
  const hasLoadedOnceRef = React.useRef(false);
  const loadGenerationRef = React.useRef(0);

  const showBanner = useCallback((type, message) => {
    setBanner({open: true, type, message});
  }, []);

  const applyBranding = useCallback((branding) => {
    const next = formFromBranding(branding);
    setForm(next);
    setSavedForm(next);
    setAccountName(branding.name || "");
    setAccountUrlSlug(branding.url || "");
    if (isTeamMode) {
      const parts = [branding.agencyName, branding.officeName].filter(Boolean);
      setSubtitleMeta(parts.join(" · "));
    } else {
      setSubtitleMeta("");
    }
    if ((isTeamMode || !isAgencyMode) && branding.customizable === false) {
      setReadOnlyReason(
        branding.inheritsFromLabel ||
          (isTeamMode
            ? "This team isn’t customizable while its agency has branding."
            : "This account isn’t customizable."),
      );
    } else {
      setReadOnlyReason(null);
    }
  }, [isAgencyMode, isTeamMode]);

  const updateField = (key, value) => {
    if (readOnlyReason) return;
    setForm((prev) => ({...prev, [key]: value}));
  };

  const uploadFolder = isAgencyMode
    ? S3_UPLOAD_FOLDER.AGENCY_BRANDING
    : isTeamMode
      ? S3_UPLOAD_FOLDER.TEAM_BRANDING
      : S3_UPLOAD_FOLDER.ACCOUNT_BRANDING;

  const {
    uploadImage: uploadLogo,
    imagePreviewUrl: logoPreview,
    uploadedImageUrl: logoUploadedUrl,
    imageUploading: logoUploading,
    imageUploadError: logoUploadError,
    setImageUploadError: setLogoUploadError,
    clearPreview: clearLogoPreview,
    clearUploadedUrl: clearLogoUploaded,
  } = useImageUpload({
    uploadFolder,
    preserveTransparency: true,
    onSuccess: (key, displayUrl) => {
      setForm((prev) => ({
        ...prev,
        sidebarIconKey: key,
        sidebarIconUrl: displayUrl || prev.sidebarIconUrl,
        agentCardLogoKey: key,
        agentCardLogoUrl: displayUrl || prev.agentCardLogoUrl,
      }));
    },
  });

  const clearImagePreviews = useCallback(() => {
    clearLogoPreview();
    clearLogoUploaded();
  }, [clearLogoPreview, clearLogoUploaded]);

  const closeCropModal = useCallback(() => {
    setCropModalOpen(false);
    if (cropImageSrcRef.current) {
      URL.revokeObjectURL(cropImageSrcRef.current);
      cropImageSrcRef.current = null;
    }
    setCropImageSrc(null);
  }, []);

  useEffect(() => {
    return () => {
      if (cropImageSrcRef.current) {
        URL.revokeObjectURL(cropImageSrcRef.current);
        cropImageSrcRef.current = null;
      }
    };
  }, []);

  const handleLogoFilePick = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setLogoUploadError("Please select an image file (JPEG, PNG, WebP)");
      return;
    }
    setLogoUploadError(null);
    if (cropImageSrcRef.current) {
      URL.revokeObjectURL(cropImageSrcRef.current);
    }
    const url = URL.createObjectURL(file);
    cropImageSrcRef.current = url;
    setCropImageSrc(url);
    setCropModalOpen(true);
  }, [setLogoUploadError]);

  const handleCropConfirm = useCallback(
    async (croppedFile) => {
      await uploadLogo(croppedFile);
    },
    [uploadLogo],
  );

  const loadBranding = useCallback(
    async (id) => {
      if (!id) {
        setForm(DEFAULT_FORM);
        setSavedForm(DEFAULT_FORM);
        setAccountName("");
        setAccountUrlSlug("");
        setSubtitleMeta("");
        setReadOnlyReason(null);
        setLoadingBranding(false);
        setSwitchingAccount(false);
        return;
      }

      const generation = ++loadGenerationRef.current;
      const isInitial = !hasLoadedOnceRef.current;
      if (isInitial) {
        setLoadingBranding(true);
      } else {
        setSwitchingAccount(true);
      }

      try {
        let branding;
        if (isAgencyMode) {
          branding = await AppApi.getAgencyBranding(id);
        } else if (isTeamMode) {
          branding = await AppApi.getTeamBranding(id);
        } else {
          branding = await AppApi.getAccountBranding(id);
        }
        if (generation !== loadGenerationRef.current) return;
        clearImagePreviews();
        applyBranding(branding);
        hasLoadedOnceRef.current = true;
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        showBanner(
          "error",
          Array.isArray(err) ? err.join(", ") : err?.message || "Failed to load branding",
        );
        clearImagePreviews();
        setForm(DEFAULT_FORM);
        setSavedForm(DEFAULT_FORM);
        setAccountName("");
        setAccountUrlSlug("");
        setSubtitleMeta("");
        setReadOnlyReason(null);
      } finally {
        if (generation === loadGenerationRef.current) {
          setLoadingBranding(false);
          setSwitchingAccount(false);
        }
      }
    },
    [showBanner, applyBranding, clearImagePreviews, isAgencyMode, isTeamMode],
  );

  useEffect(() => {
    loadBranding(entityId);
  }, [entityId, loadBranding]);

  // Fallback id list for prev/next when opened without list navigation state
  useEffect(() => {
    const fromList = location.state;
    if (isAgencyMode) {
      if (fromList?.visibleAgencyIds?.length) return;
    } else if (isTeamMode) {
      if (fromList?.visibleTeamIds?.length) return;
    } else if (fromList?.visibleAccountIds?.length) return;

    let cancelled = false;
    (async () => {
      try {
        if (isAgencyMode) {
          const list = await AppApi.getAgenciesForCustomization();
          if (cancelled) return;
          const ids = (Array.isArray(list) ? list : [])
            .slice()
            .sort((a, b) =>
              (a.name || "").localeCompare(b.name || "", undefined, {
                sensitivity: "base",
              }),
            )
            .map((a) => a.id);
          setFallbackIds(ids);
        } else if (isTeamMode) {
          const list = await AppApi.getTeamsForCustomization();
          if (cancelled) return;
          const ids = (Array.isArray(list) ? list : [])
            .slice()
            .sort((a, b) =>
              (a.name || "").localeCompare(b.name || "", undefined, {
                sensitivity: "base",
              }),
            )
            .map((t) => t.id);
          setFallbackIds(ids);
        } else {
          const list = await AppApi.getAllAccounts();
          if (cancelled) return;
          const ids = (Array.isArray(list) ? list : [])
            .filter((a) => a.customizable)
            .slice()
            .sort((a, b) =>
              (a.name || "").localeCompare(b.name || "", undefined, {
                sensitivity: "base",
              }),
            )
            .map((a) => a.id);
          setFallbackIds(ids);
        }
      } catch {
        if (!cancelled) setFallbackIds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.state, isAgencyMode, isTeamMode]);

  const navState = useMemo(() => {
    const fromList = location.state;
    if (isAgencyMode) {
      if (fromList?.visibleAgencyIds?.length && fromList.currentIndex != null) {
        return {
          currentIndex: fromList.currentIndex,
          totalItems: fromList.totalItems ?? fromList.visibleAgencyIds.length,
          visibleIds: fromList.visibleAgencyIds,
        };
      }
    } else if (isTeamMode) {
      if (fromList?.visibleTeamIds?.length && fromList.currentIndex != null) {
        return {
          currentIndex: fromList.currentIndex,
          totalItems: fromList.totalItems ?? fromList.visibleTeamIds.length,
          visibleIds: fromList.visibleTeamIds,
        };
      }
    } else if (
      fromList?.visibleAccountIds?.length &&
      fromList.currentIndex != null
    ) {
      return {
        currentIndex: fromList.currentIndex,
        totalItems: fromList.totalItems ?? fromList.visibleAccountIds.length,
        visibleIds: fromList.visibleAccountIds,
      };
    }
    if (!fallbackIds?.length || !entityId) return null;
    const idx = fallbackIds.findIndex((id) => Number(id) === Number(entityId));
    if (idx === -1) return null;
    return {
      currentIndex: idx + 1,
      totalItems: fallbackIds.length,
      visibleIds: fallbackIds,
    };
  }, [location.state, fallbackIds, entityId, isAgencyMode, isTeamMode]);

  const goToEntity = (nextId, nextIndex) => {
    if (!nextId || !navState) return;
    const path = isAgencyMode
      ? `/${accountUrl}/customization/agency/${nextId}`
      : isTeamMode
        ? `/${accountUrl}/customization/team/${nextId}`
        : `/${accountUrl}/customization/${nextId}`;
    navigate(path, {
      state: {
        ...location.state,
        currentIndex: nextIndex,
        totalItems: navState.totalItems,
        ...(isAgencyMode
          ? {visibleAgencyIds: navState.visibleIds}
          : isTeamMode
            ? {visibleTeamIds: navState.visibleIds}
            : {visibleAccountIds: navState.visibleIds}),
      },
    });
  };

  const logoSrc =
    logoPreview ||
    logoUploadedUrl ||
    form.sidebarIconUrl ||
    form.agentCardLogoUrl ||
    null;

  const hasChanges = useMemo(
    () => !readOnlyReason && !formsEqual(form, savedForm),
    [form, savedForm, readOnlyReason],
  );

  const previewBranding = useMemo(
    () => ({
      accentColor: form.accentColor || DEFAULT_ACCENT,
      agentCardAccentColor: form.agentCardAccentColor || form.accentColor || DEFAULT_ACCENT,
      agentCardBackgroundColor: form.agentCardBackgroundColor || null,
      agentCardAgentLabel: form.agentCardAgentLabel || "Your Agent",
      agentCardCompanyName: form.agentCardCompanyName || null,
      agentCardLogoUrl: logoSrc,
      agentCardTextColor: form.agentCardTextColor || DEFAULT_CARD_TEXT,
    }),
    [form, logoSrc],
  );

  const shellTextColor = form.sidebarTextColor || DEFAULT_SIDEBAR_TEXT;

  const handleCancel = () => {
    setForm(savedForm);
    clearImagePreviews();
    setLogoUploadError(null);
  };

  const persistBranding = async (payload) => {
    if (isAgencyMode) return AppApi.updateAgencyBranding(entityId, payload);
    if (isTeamMode) return AppApi.updateTeamBranding(entityId, payload);
    return AppApi.updateAccountBranding(entityId, payload);
  };

  const handleUpdate = async () => {
    if (!entityId || readOnlyReason) return;
    setSaving(true);
    try {
      const branding = await persistBranding(normalizeForm(form));
      applyBranding(branding);
      clearImagePreviews();
      if (!isAgencyMode && !isTeamMode && entityId === currentAccount?.id) {
        await refreshBranding();
      }
      showBanner("success", "Branding updated.");
    } catch (err) {
      showBanner(
        "error",
        Array.isArray(err) ? err.join(", ") : err?.message || "Failed to update branding",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!entityId || readOnlyReason) return;
    setSaving(true);
    try {
      const resetPayload = {
        accentColor: null,
        sidebarIconKey: null,
        agentCardLogoKey: null,
        agentCardAccentColor: null,
        agentCardBackgroundColor: null,
        agentCardAgentLabel: null,
        agentCardCompanyName: null,
        sidebarTextColor: null,
        agentCardTextColor: null,
      };
      const branding = await persistBranding(resetPayload);
      applyBranding(branding);
      clearImagePreviews();
      if (!isAgencyMode && !isTeamMode && entityId === currentAccount?.id) {
        await refreshBranding();
      }
      showBanner("success", "Reset to Opsy defaults.");
    } catch (err) {
      showBanner(
        "error",
        Array.isArray(err) ? err.join(", ") : err?.message || "Failed to reset branding",
      );
    } finally {
      setSaving(false);
    }
  };

  const listPath = `/${accountUrl}/customization`;
  const updateDisabled =
    saving || logoUploading || switchingAccount || Boolean(readOnlyReason);
  const canEdit = !readOnlyReason;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={PAGE_LAYOUT.settings}>
          <div className="mb-8">
            <Link
              to={listPath}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {isAgencyMode
                ? "All agencies"
                : isTeamMode
                  ? "All teams"
                  : "All accounts"}
            </Link>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--opsy-accent,#456564)]/10 text-[var(--opsy-accent,#456564)] ring-1 ring-[var(--opsy-accent,#456564)]/15"
                  aria-hidden
                >
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-[1.75rem] leading-tight text-gray-900 dark:text-gray-50 font-bold truncate">
                    {accountName ||
                      (isAgencyMode
                        ? "Agency customization"
                        : isTeamMode
                          ? "Team customization"
                          : "Customization")}
                  </h1>
                  {accountUrlSlug && (
                    <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-200/80 dark:ring-gray-700/80">
                      <Link2 className="w-3 h-3 shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="truncate font-mono tracking-tight">
                        /{accountUrlSlug}
                      </span>
                    </div>
                  )}
                  {subtitleMeta && (
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                      {subtitleMeta}
                    </p>
                  )}
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {isAgencyMode
                      ? "White-label this agency’s shell accent, logo, and homeowner agent card. Affiliated agents inherit these settings (overriding team branding)."
                      : isTeamMode
                        ? "White-label this team’s shell accent, logo, and homeowner agent card. Applies only when the parent agency has no customization."
                        : "White-label this account’s shell accent, logo, and homeowner agent card."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:pt-1">
                {entityId && !loadingBranding && canEdit && (
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    disabled={saving || switchingAccount}
                    className="btn text-sm inline-flex items-center gap-2 shrink-0 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm disabled:opacity-60"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Opsy defaults
                  </button>
                )}
                {navState && navState.totalItems > 1 && (
                  <div className="flex items-center gap-0.5 ml-1 pl-3 border-l border-neutral-200 dark:border-neutral-700">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 mr-1.5 tabular-nums">
                      {navState.currentIndex} / {navState.totalItems}
                    </span>
                    <button
                      type="button"
                      className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:hover:bg-transparent transition-colors"
                      title="Previous"
                      onClick={() => {
                        if (navState.currentIndex > 1) {
                          const prevId =
                            navState.visibleIds[navState.currentIndex - 2];
                          goToEntity(prevId, navState.currentIndex - 1);
                        }
                      }}
                      disabled={switchingAccount || navState.currentIndex <= 1}
                    >
                      <svg
                        className={`fill-current shrink-0 w-5 h-5 ${
                          switchingAccount || navState.currentIndex <= 1
                            ? "text-neutral-200 dark:text-neutral-700"
                            : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                        }`}
                        viewBox="0 0 18 18"
                      >
                        <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:hover:bg-transparent transition-colors"
                      title="Next"
                      onClick={() => {
                        if (navState.currentIndex < navState.totalItems) {
                          const nextId =
                            navState.visibleIds[navState.currentIndex];
                          goToEntity(nextId, navState.currentIndex + 1);
                        }
                      }}
                      disabled={
                        switchingAccount ||
                        navState.currentIndex >= navState.totalItems
                      }
                    >
                      <svg
                        className={`fill-current shrink-0 w-5 h-5 ${
                          switchingAccount ||
                          navState.currentIndex >= navState.totalItems
                            ? "text-neutral-200 dark:text-neutral-700"
                            : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                        }`}
                        viewBox="0 0 18 18"
                      >
                        <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {banner.message && (
            <div className="mb-4">
              <Banner
                open={banner.open}
                type={banner.type}
                setOpen={(open) => setBanner((b) => ({...b, open}))}
              >
                {banner.message}
              </Banner>
            </div>
          )}

          {readOnlyReason && !loadingBranding && (
            <div className="mb-4">
              <Banner open type="warning" setOpen={() => {}}>
                {readOnlyReason}{" "}
                {isTeamMode
                  ? "Team branding is stored but overridden by the agency until agency branding is cleared."
                  : "Branding below is inherited and cannot be edited on this account."}
              </Banner>
            </div>
          )}

          {loadingBranding ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading branding…
            </div>
          ) : (
            entityId && (
              <div
                className={`space-y-5 transition-opacity duration-150 ${
                  switchingAccount ? "opacity-50 pointer-events-none" : "opacity-100"
                } ${readOnlyReason ? "opacity-75" : ""}`}
              >
                <fieldset disabled={!canEdit} className="space-y-5 border-0 p-0 m-0 min-w-0">
                <div className={SETTINGS_CARD.card}>
                  <div className={SETTINGS_CARD.header}>
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      Shell accent & logo
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Controls the app accent color, sidebar text, and the logo shown in the
                      sidebar and agent card for this
                      {isAgencyMode ? " agency" : isTeamMode ? " team" : " account"}.
                    </p>
                  </div>
                  <div className={`${SETTINGS_CARD.body} space-y-5`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                      <div className="space-y-4">
                        <ColorField
                          label="Accent color"
                          value={form.accentColor}
                          onChange={(v) => updateField("accentColor", v)}
                          fallback={DEFAULT_ACCENT}
                        />
                        <ColorField
                          label="Sidebar text color"
                          value={form.sidebarTextColor}
                          onChange={(v) => updateField("sidebarTextColor", v)}
                          fallback={DEFAULT_SIDEBAR_TEXT}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Logo
                        </label>
                        <ImageUploadField
                          imageSrc={logoSrc}
                          hasImage={Boolean(logoSrc)}
                          imageUploading={logoUploading}
                          onUpload={handleLogoFilePick}
                          onRemove={() => {
                            clearLogoPreview();
                            clearLogoUploaded();
                            updateField("sidebarIconKey", null);
                            updateField("sidebarIconUrl", null);
                            updateField("agentCardLogoKey", null);
                            updateField("agentCardLogoUrl", null);
                          }}
                          showRemove={Boolean(
                            form.sidebarIconKey || form.agentCardLogoKey || logoSrc,
                          )}
                          imageUploadError={logoUploadError}
                          onDismissError={() => setLogoUploadError(null)}
                          size="sm"
                          variant="logo"
                          logoBackdropColor={form.accentColor || DEFAULT_ACCENT}
                          placeholder="generic"
                          alt="Logo"
                          uploadLabel="Upload logo"
                          removeLabel="Remove logo"
                          emptyLabel="Add logo"
                        />
                        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 max-w-[11rem]">
                          If you see a white box or checkerboard on the accent,
                          re-upload and enable Remove background.
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Preview
                      </p>
                      <div className="flex items-center gap-3 flex-wrap rounded-lg border border-gray-100 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-900/40 p-3">
                        <div
                          className="w-36 h-14 rounded-lg flex items-center justify-center"
                          style={{backgroundColor: form.accentColor || DEFAULT_ACCENT}}
                        >
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt=""
                              className="h-12 max-w-[7.5rem] object-contain"
                            />
                          ) : (
                            <span
                              className="text-xs font-medium"
                              style={{color: shellTextColor}}
                            >
                              Sidebar
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn text-sm pointer-events-none shadow-sm"
                          style={{
                            backgroundColor: form.accentColor || DEFAULT_ACCENT,
                            color: shellTextColor,
                          }}
                        >
                          Primary button
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={SETTINGS_CARD.card}>
                  <div className={SETTINGS_CARD.header}>
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      Agent card
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Branding shown on the homeowner home agent card, including colors and
                      labels. Uses the logo from Shell accent & logo above.
                    </p>
                  </div>
                  <div className={`${SETTINGS_CARD.body} space-y-5`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                      <div className="space-y-4">
                        <ColorField
                          label="Card accent color"
                          value={form.agentCardAccentColor}
                          onChange={(v) => updateField("agentCardAccentColor", v)}
                          fallback={DEFAULT_ACCENT}
                        />
                        <ColorField
                          label="Card background tint"
                          value={form.agentCardBackgroundColor}
                          onChange={(v) => updateField("agentCardBackgroundColor", v || "")}
                          fallback="#ffffff"
                        />
                      </div>
                      <ColorField
                        label="Card text color"
                        value={form.agentCardTextColor}
                        onChange={(v) => updateField("agentCardTextColor", v)}
                        fallback={DEFAULT_CARD_TEXT}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Agent label
                        </label>
                        <input
                          type="text"
                          className="form-input w-full"
                          value={form.agentCardAgentLabel}
                          onChange={(e) =>
                            updateField("agentCardAgentLabel", e.target.value)
                          }
                          placeholder="Your Agent"
                          maxLength={80}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Company name override
                        </label>
                        <input
                          type="text"
                          className="form-input w-full"
                          value={form.agentCardCompanyName}
                          onChange={(e) =>
                            updateField("agentCardCompanyName", e.target.value)
                          }
                          placeholder="Company name on card"
                          maxLength={120}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Live preview
                      </p>
                      <div className="relative rounded-xl overflow-hidden min-h-[220px] bg-gradient-to-br from-gray-700 to-gray-900 p-6 flex items-start">
                        <AgentCard
                          agent={PREVIEW_AGENT}
                          branding={previewBranding}
                          onOpenModal={() => {}}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                </fieldset>

                {/* Sticky save bar — sibling of cards (not inside overflow-hidden)
                    so it can pin to the scroll viewport. -mt-5 collapses space-y gap. */}
                <div
                  className={`${
                    hasChanges ? "sticky -mt-5" : "hidden"
                  } bottom-0 z-10 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/50 border-t border-t-neutral-100 dark:border-t-neutral-800 px-6 py-4 rounded-b-2xl transition-all duration-200`}
                  style={{
                    boxShadow:
                      "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={saving}
                      className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdate}
                      disabled={updateDisabled}
                      className="btn btn-primary transition-colors duration-200 shadow-sm min-w-[100px] disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          Updating...
                        </>
                      ) : (
                        "Update"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </main>
      </div>

      <LogoCropModal
        open={cropModalOpen}
        onClose={closeCropModal}
        imageSrc={cropImageSrc}
        accentColor={form.accentColor || DEFAULT_ACCENT}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}

export default CustomizationPage;
