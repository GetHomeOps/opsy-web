import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldOff, Loader2, Globe, Calendar, CheckCircle2 } from "lucide-react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import { useAuth } from "../../context/AuthContext";
import AppApi from "../../api/api";
import { PAGE_LAYOUT, SETTINGS_CARD } from "../../constants/layout";
import useImageUpload from "../../hooks/useImageUpload";
import ImageUploadField from "../../components/ImageUploadField";

/**
 * Configuration page — profile settings: name, password, phone, MFA.
 * Email is read-only (changing requires verification).
 * Language changes apply only on save.
 */
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

function ConfigurationPage() {
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, refreshCurrentUser, updateCurrentUser } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState(i18n.language?.split("-")[0] || "en");
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageSuccess, setLanguageSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const [mfaStatus, setMfaStatus] = useState({ mfaEnabled: false, backupCodesRemaining: 0 });
  const [mfaLoading, setMfaLoading] = useState(true);
  const [enableModalOpen, setEnableModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [enableStep, setEnableStep] = useState(1);
  const [qrData, setQrData] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState("");
  const [disableUsePassword, setDisableUsePassword] = useState(true);
  const [mfaActionError, setMfaActionError] = useState(null);
  const [mfaActionLoading, setMfaActionLoading] = useState(false);

  const [calendarIntegrations, setCalendarIntegrations] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarDisconnecting, setCalendarDisconnecting] = useState(null);
  const [calendarConnecting, setCalendarConnecting] = useState(null);
  const [calendarMessage, setCalendarMessage] = useState(null);

  const [photoError, setPhotoError] = useState(null);
  const [pendingImageKey, setPendingImageKey] = useState(null);
  const [pendingRemovePhoto, setPendingRemovePhoto] = useState(false);
  /** Latest image_url from save response; keeps photo visible immediately after save without reload */
  const [savedImageUrl, setSavedImageUrl] = useState(null);
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
    onSuccess: (key) => {
      setPhotoError(null);
      setPendingImageKey(key);
      setPendingRemovePhoto(false);
    },
    onError: (msg) => setPhotoError(msg),
  });

  const profilePhotoUrl = pendingRemovePhoto
    ? null
    : imagePreviewUrl ||
      uploadedImageUrl ||
      savedImageUrl ||
      currentUser?.avatarUrl ||
      currentUser?.image_url;
  const hasProfilePhoto =
    !pendingRemovePhoto && !!(profilePhotoUrl || currentUser?.image);

  function handleRemoveProfilePhoto() {
    if (profileSaving) return;
    setPhotoError(null);
    setPendingRemovePhoto(true);
    setPendingImageKey(null);
    clearPreview();
    clearUploadedUrl();
  }

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setPhone(currentUser.phone || "");
    }
  }, [currentUser]);

  useEffect(() => {
    setLanguage(i18n.language?.split("-")[0] || "en");
  }, [i18n.language]);

  async function handleLanguageSubmit(e) {
    e.preventDefault();
    setLanguageSuccess(false);
    setLanguageSaving(true);
    try {
      await i18n.changeLanguage(language);
      setLanguageSuccess(true);
      setTimeout(() => setLanguageSuccess(false), 3000);
    } catch {
      // i18n.changeLanguage typically doesn't throw
    } finally {
      setLanguageSaving(false);
    }
  }

  useEffect(() => {
    async function fetchMfaStatus() {
      if (!currentUser?.id) return;
      setMfaLoading(true);
      try {
        const res = await AppApi.getMfaStatus();
        setMfaStatus({ mfaEnabled: res.mfaEnabled, backupCodesRemaining: res.backupCodesRemaining ?? 0 });
      } catch {
        setMfaStatus({ mfaEnabled: false, backupCodesRemaining: 0 });
      } finally {
        setMfaLoading(false);
      }
    }
    fetchMfaStatus();
  }, [currentUser?.id, enableModalOpen, disableModalOpen]);

  const { accountUrl } = useParams();
  useEffect(() => {
    async function fetchCalendars() {
      if (!currentUser?.id) return;
      setCalendarLoading(true);
      try {
        const list = await AppApi.getCalendarIntegrations();
        setCalendarIntegrations(list);
      } catch {
        setCalendarIntegrations([]);
      } finally {
        setCalendarLoading(false);
      }
    }
    fetchCalendars();
  }, [currentUser?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendar = params.get("calendar");
    const status = params.get("status");
    if (calendar && status === "connected") {
      setCalendarMessage(`${calendar === "google" ? "Google" : "Outlook"} Calendar connected.`);
      setTimeout(() => setCalendarMessage(null), 5000);
      window.history.replaceState({}, "", window.location.pathname);
      AppApi.getCalendarIntegrations()
        .then(setCalendarIntegrations)
        .catch(() => {});
    }
  }, []);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    if (!currentUser?.id) return;
    setProfileError(null);
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      const payload = { name, phone };
      if (pendingRemovePhoto) {
        payload.image = null;
        payload.avatar_url = null;
      } else if (pendingImageKey) {
        payload.image = pendingImageKey;
        // Clear OAuth avatar so uploaded photo takes precedence (avatarUrl || image_url display order)
        payload.avatar_url = null;
      }
      const updatedUser = await AppApi.updateUser(currentUser.id, payload);
      setSavedImageUrl(pendingRemovePhoto ? null : (updatedUser?.image_url ?? savedImageUrl));
      const authUpdates = { name: updatedUser?.name, phone: updatedUser?.phone };
      if (pendingRemovePhoto) {
        authUpdates.image = null;
        authUpdates.image_url = null;
        authUpdates.avatarUrl = null;
      } else if (pendingImageKey) {
        authUpdates.image = updatedUser?.image;
        authUpdates.image_url = updatedUser?.image_url;
        authUpdates.avatarUrl = null; // Clear OAuth avatar so uploaded photo displays
      }
      updateCurrentUser(authUpdates);
      await refreshCurrentUser();
      setProfileSuccess(true);
      clearPreview();
      clearUploadedUrl();
      setPendingImageKey(null);
      setPendingRemovePhoto(false);
    } catch (err) {
      setProfileError(err.message || err.messages?.[0] || "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordsDoNotMatch") || "Passwords do not match");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError(t("settings.passwordTooShort") || "Password must be at least 4 characters");
      return;
    }
    setPasswordSaving(true);
    try {
      await AppApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err.message || err.messages?.[0] || "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleEnableMfaStart() {
    setEnableModalOpen(true);
    setEnableStep(1);
    setQrData(null);
    setMfaCode("");
    setBackupCodes(null);
    setBackupCodesSaved(false);
    setMfaActionError(null);
    try {
      const res = await AppApi.mfaSetup();
      setQrData(res);
    } catch (err) {
      setMfaActionError(err?.message || err?.messages?.[0] || "Failed to start MFA setup");
    }
  }

  async function handleEnableMfaConfirm(e) {
    e.preventDefault();
    setMfaActionError(null);
    setMfaActionLoading(true);
    try {
      const res = await AppApi.mfaConfirm(mfaCode.trim());
      setBackupCodes(res.backupCodes || []);
      setEnableStep(2);
    } catch (err) {
      setMfaActionError(err?.message || err?.messages?.[0] || "Invalid code");
    } finally {
      setMfaActionLoading(false);
    }
  }

  function handleEnableMfaClose() {
    setEnableModalOpen(false);
    setEnableStep(1);
    setQrData(null);
    setMfaCode("");
    setBackupCodes(null);
    setBackupCodesSaved(false);
    setMfaActionError(null);
  }

  async function handleDisableMfa(e) {
    e.preventDefault();
    setMfaActionError(null);
    setMfaActionLoading(true);
    try {
      const payload = disableUsePassword ? { password: disableConfirm } : { codeOrBackupCode: disableConfirm };
      await AppApi.mfaDisable(payload);
      setMfaStatus({ mfaEnabled: false, backupCodesRemaining: 0 });
      setDisableModalOpen(false);
      setDisableConfirm("");
    } catch (err) {
      setMfaActionError(err?.message || err?.messages?.[0] || "Invalid code");
    } finally {
      setMfaActionLoading(false);
    }
  }

  function downloadBackupCodes() {
    if (!backupCodes?.length) return;
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "homeops-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.settings}>
            <div className="mb-10">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {t("settings.configuration") || "Configuration"}
              </h1>
              <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                {t("settings.configurationDescription") ||
                  "Manage your profile and account security settings."}
              </p>
            </div>

            <div className="space-y-10">
              {/* Profile — name, phone (email read-only) */}
              <section className={SETTINGS_CARD.card}>
                <div className={SETTINGS_CARD.header}>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t("profile") || "Profile"}
                  </h2>
                  <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                    {t("settings.profileDescription") ||
                      "Update your name and contact information. Email cannot be changed here."}
                  </p>
                </div>
                <div className={`${SETTINGS_CARD.body} space-y-4`}>
                  {profileError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                      {profileError}
                    </div>
                  )}
                  {photoError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                      {photoError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      {t("settings.profileSaved") || "Profile saved successfully."}
                    </div>
                  )}
                  {/* Profile photo — outside form so remove button doesn't trigger form submit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t("settings.profilePhoto") || "Profile photo"}
                    </label>
                    <ImageUploadField
                      imageSrc={profilePhotoUrl}
                      hasImage={hasProfilePhoto}
                      imageUploading={imageUploading || profileSaving}
                      onUpload={uploadImage}
                      onRemove={handleRemoveProfilePhoto}
                      showRemove={hasProfilePhoto}
                      imageUploadError={imageUploadError}
                      onDismissError={() => {
                        setImageUploadError(null);
                        setPhotoError(null);
                      }}
                      size="sm"
                      placeholder="avatar"
                      alt={currentUser?.name || "Profile"}
                      uploadLabel={t("uploadImage") || "Upload photo"}
                      removeLabel={t("removePhoto") || "Remove photo"}
                    />
                  </div>
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="config-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t("name") || "Name"}
                    </label>
                    <input
                      id="config-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-input w-full"
                      placeholder={t("name") || "Your name"}
                    />
                  </div>
                  <div>
                    <label htmlFor="config-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t("email") || "Email"}
                    </label>
                    <input
                      id="config-email"
                      type="email"
                      value={currentUser?.email || ""}
                      readOnly
                      disabled
                      className="form-input w-full bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t("settings.emailReadOnly") || "Email cannot be changed. Contact support if needed."}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="config-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t("phone") || "Phone"}
                    </label>
                    <input
                      id="config-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="form-input w-full"
                      placeholder={t("phonePlaceholder") || "Enter phone number"}
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                    >
                      {profileSaving ? (t("saving") || "Saving...") : (t("save") || "Save Changes")}
                    </button>
                  </div>
                  </form>
                </div>
              </section>

              {/* Password */}
              <section className={SETTINGS_CARD.card}>
                <div className={SETTINGS_CARD.header}>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t("password") || "Password"}
                  </h2>
                  <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                    {t("settings.passwordDescription") ||
                      "Set a permanent password. You'll need your current password to change it."}
                  </p>
                </div>
                <form onSubmit={handlePasswordSubmit} className={`${SETTINGS_CARD.body} space-y-4`}>
                  {passwordError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      {t("settings.passwordChanged") || "Password changed successfully."}
                    </div>
                  )}
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t("settings.currentPassword") || "Current Password"}
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="form-input w-full"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t("settings.newPassword") || "New Password"}
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-input w-full"
                      placeholder="••••••••"
                      minLength={4}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t("settings.confirmPassword") || "Confirm New Password"}
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-input w-full"
                      placeholder="••••••••"
                      minLength={4}
                      required
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                    >
                      {passwordSaving
                        ? (t("saving") || "Saving...")
                        : (t("settings.changePassword") || "Change Password")}
                    </button>
                  </div>
                </form>
              </section>

              {/* Language — applies only on save */}
              <section className={SETTINGS_CARD.card}>
                <div className={SETTINGS_CARD.header}>
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {t("settings.language") || "Language"}
                    </h2>
                  </div>
                  <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                    {t("settings.languageDescription") ||
                      "Choose your preferred language for the interface."}
                  </p>
                </div>
                <form onSubmit={handleLanguageSubmit} className={SETTINGS_CARD.body}>
                  {languageSuccess && (
                    <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      {t("settings.languageSaved") || "Language saved. The interface will update."}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[200px]">
                      <label htmlFor="config-language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t("settings.language") || "Language"}
                      </label>
                      <select
                        id="config-language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="form-select w-full"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={languageSaving}
                      className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                    >
                      {languageSaving ? (t("saving") || "Saving...") : (t("save") || "Save Changes")}
                    </button>
                  </div>
                </form>
              </section>

              {/* Calendar Integrations */}
              <section id="calendar-integrations" className={SETTINGS_CARD.card}>
                <div className={SETTINGS_CARD.header}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {t("settings.calendarIntegrations") || "Calendar Integrations"}
                    </h2>
                  </div>
                  <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                    {t("settings.calendarIntegrationsDescription") ||
                      "Connect your calendars so events you create sync automatically to Google Calendar and Outlook."}
                  </p>
                </div>
                <div className={`${SETTINGS_CARD.body} space-y-4`}>
                  {calendarMessage && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      {calendarMessage}
                    </div>
                  )}
                  {calendarLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t("loading") || "Loading..."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { provider: "google", label: "Google Calendar" },
                        { provider: "outlook", label: "Microsoft Outlook" },
                      ].map(({ provider, label }) => {
                        const integration = calendarIntegrations.find((i) => i.provider === provider);
                        const returnTo = accountUrl ? `${accountUrl}/settings/configuration` : "settings/configuration";
                        const isConnecting = calendarConnecting === provider;
                        return (
                          <div
                            key={provider}
                            className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50"
                          >
                            <div className="flex items-center gap-3">
                              {integration ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                              )}
                              <span className="font-medium text-gray-800 dark:text-gray-100">{label}</span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {integration ? (t("settings.connected") || "Connected") : (t("settings.notConnected") || "Not connected")}
                              </span>
                            </div>
                            <div>
                              {integration ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setCalendarDisconnecting(integration.id);
                                    try {
                                      await AppApi.deleteCalendarIntegration(integration.id);
                                      setCalendarIntegrations((prev) => prev.filter((i) => i.id !== integration.id));
                                    } catch {
                                      // ignore
                                    } finally {
                                      setCalendarDisconnecting(null);
                                    }
                                  }}
                                  disabled={calendarDisconnecting === integration.id}
                                  className="btn border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                                >
                                  {calendarDisconnecting === integration.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    t("settings.disconnect") || "Disconnect"
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setCalendarConnecting(provider);
                                    try {
                                      const { url } = await AppApi.getCalendarConnectUrl(provider, returnTo);
                                      window.location.href = url;
                                    } catch {
                                      setCalendarConnecting(null);
                                    }
                                  }}
                                  disabled={isConnecting}
                                  className="btn bg-[#456564] hover:bg-[#34514f] text-white text-sm disabled:opacity-70"
                                >
                                  {isConnecting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    t("settings.connect") || "Connect"
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Multi-Factor Authentication */}
              <section className={SETTINGS_CARD.card}>
                <div className={SETTINGS_CARD.header}>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t("settings.mfaTitle") || "Multi-Factor Authentication"}
                  </h2>
                  <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                    {t("settings.mfaDescription") ||
                      "Add an extra layer of security with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy)."}
                  </p>
                </div>
                <div className={`${SETTINGS_CARD.body} flex items-center justify-between gap-4`}>
                  <div className="flex items-center gap-3">
                    {mfaLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    ) : mfaStatus.mfaEnabled ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ShieldOff className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {mfaStatus.mfaEnabled
                          ? (t("settings.mfaEnabled") || "Enabled")
                          : (t("settings.mfaDisabled") || "Disabled")}
                      </span>
                      {mfaStatus.mfaEnabled && mfaStatus.backupCodesRemaining > 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {mfaStatus.backupCodesRemaining} {t("settings.backupCodesRemaining") || "backup codes remaining"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    {mfaStatus.mfaEnabled ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDisableModalOpen(true);
                          setDisableConfirm("");
                          setDisableUsePassword(true);
                          setMfaActionError(null);
                        }}
                        className="btn border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {t("settings.disable") || "Disable"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnableMfaStart}
                        className="btn bg-[#456564] hover:bg-[#34514f] text-white"
                      >
                        {t("settings.enable") || "Enable"}
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Enable MFA Modal */}
              {enableModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                        {enableStep === 1
                          ? (t("settings.mfaSetup") || "Set up authenticator")
                          : (t("settings.mfaBackupCodes") || "Save your backup codes")}
                      </h3>
                      {mfaActionError && (
                        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                          {mfaActionError}
                        </div>
                      )}
                      {enableStep === 1 && qrData && (
                        <>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {t("settings.mfaScanQr") || "Scan QR code with your authenticator app, or enter the code manually."}
                          </p>
                          {qrData.qrCodeDataUrl && (
                            <div className="flex justify-center mb-4">
                              <img src={qrData.qrCodeDataUrl} alt="QR Code" className="w-48 h-48" />
                            </div>
                          )}
                          <details className="mb-4">
                            <summary className="text-sm text-violet-600 dark:text-violet-400 cursor-pointer hover:underline">
                              {t("settings.cantScan") || "Can't scan?"}
                            </summary>
                            <p className="mt-2 text-sm font-mono bg-gray-100 dark:bg-gray-700 p-3 rounded break-all">
                              {qrData.manualCode}
                            </p>
                          </details>
                          <form onSubmit={handleEnableMfaConfirm}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t("settings.enterCode") || "Enter 6-digit code from app"}
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={mfaCode}
                              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                              className="form-input w-full text-center text-lg tracking-widest mb-4"
                              placeholder="000000"
                            />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={handleEnableMfaClose} className="btn border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                {t("cancel") || "Cancel"}
                              </button>
                              <button type="submit" disabled={mfaActionLoading || mfaCode.length !== 6} className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50">
                                {mfaActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t("settings.confirm") || "Confirm")}
                              </button>
                            </div>
                          </form>
                        </>
                      )}
                      {enableStep === 2 && backupCodes && (
                        <>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {t("settings.mfaBackupCodesDesc") || "Save these codes in a secure place. Each can be used once if you lose access to your authenticator."}
                          </p>
                          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg font-mono text-sm mb-4 max-h-40 overflow-y-auto">
                            {backupCodes.map((c, i) => (
                              <div key={i}>{c}</div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={downloadBackupCodes} className="btn border border-gray-300 dark:border-gray-600">
                              {t("settings.download") || "Download"}
                            </button>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={backupCodesSaved} onChange={(e) => setBackupCodesSaved(e.target.checked)} />
                              {t("settings.iSavedThese") || "I saved these"}
                            </label>
                            <button
                              type="button"
                              onClick={handleEnableMfaClose}
                              disabled={!backupCodesSaved}
                              className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                            >
                              {t("settings.done") || "Done"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Disable MFA Modal */}
              {disableModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                        {t("settings.disableMfa") || "Disable MFA"}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {t("settings.disableMfaConfirm") || "Enter your password or a current authenticator code to disable MFA."}
                      </p>
                      {mfaActionError && (
                        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                          {mfaActionError}
                        </div>
                      )}
                      <form onSubmit={handleDisableMfa}>
                        <div className="mb-4">
                          <button
                            type="button"
                            onClick={() => setDisableUsePassword((b) => !b)}
                            className="text-sm text-violet-600 dark:text-violet-400 hover:underline mb-2"
                          >
                            {disableUsePassword
                              ? (t("settings.useCodeInstead") || "Use authenticator code instead")
                              : (t("settings.usePasswordInstead") || "Use password instead")}
                          </button>
                          <input
                            type={disableUsePassword ? "password" : "text"}
                            value={disableConfirm}
                            onChange={(e) => setDisableConfirm(e.target.value)}
                            className="form-input w-full"
                            placeholder={disableUsePassword ? (t("password") || "Password") : "000000"}
                            autoComplete={disableUsePassword ? "current-password" : "one-time-code"}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setDisableModalOpen(false)} className="btn border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                            {t("cancel") || "Cancel"}
                          </button>
                          <button type="submit" disabled={mfaActionLoading || !disableConfirm.trim()} className="btn border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                            {mfaActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t("settings.disable") || "Disable")}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ConfigurationPage;
