import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import { PAGE_LAYOUT, SETTINGS_CARD } from "../../constants/layout";

/**
 * New ticket submission form (like Contact at /contacts/new).
 * Submit form only. Back → SupportList.
 */
function SupportNew() {
  const { t } = useTranslation();
  const { accountUrl } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentAccount } = useCurrentAccount();
  const [type, setType] = useState("support");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const accountId = currentAccount?.id;
  const listPath = `/${accountUrl || currentAccount?.url}/settings/support`;

  function handleBack() {
    navigate(listPath);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!subject?.trim()) {
      setError(t("support.subjectRequired") || "Subject is required");
      return;
    }
    if (!description?.trim()) {
      setError(t("support.descriptionRequired") || "Description is required");
      return;
    }
    if (!accountId) {
      setError(t("support.selectAccount") || "Please select an account");
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
            console.warn("File upload not fully implemented:", uploadErr);
          }
        }
      }

      const ticket = await AppApi.createSupportTicket({
        type,
        subject: subject.trim(),
        description: description.trim(),
        accountId,
        attachmentKeys: attachmentKeys.length ? attachmentKeys : undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate(`/${accountUrl || currentAccount?.url}/settings/support/${ticket.id}`);
      }, 1500);
    } catch (err) {
      setError(err.message || err.messages?.[0] || "Failed to submit ticket");
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
              {t("support.selectAccount") ||
                "Select an account to submit a support ticket."}
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
              <span className="text-lg font-medium">Back to list</span>
            </button>

            <section className={SETTINGS_CARD.card}>
              <div className={SETTINGS_CARD.header}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("support.submitTicket") || "Submit a Ticket"}
                </h2>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                  {t("support.submitDescription") ||
                    "Describe your issue or feedback. Required fields are marked."}
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
                    {t("support.submitted") || "Ticket submitted successfully. Redirecting..."}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("support.type") || "Type"}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="form-select w-full max-w-xs"
                  >
                    <option value="support">{t("support.typeSupport") || "Support"}</option>
                    <option value="feedback">{t("support.typeFeedback") || "Feedback"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("support.subject")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="form-input w-full"
                    placeholder={t("support.subjectPlaceholder") || "Brief summary of your request"}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("support.descriptionLabel")} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="form-input w-full min-h-[120px]"
                    placeholder={t("support.descriptionPlaceholder") || "Provide details about your issue or feedback"}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("support.attachments")} ({t("support.optional") || "optional"})
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
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="truncate">{f.name}</span>
                          <button type="button" onClick={() => removeFile(i)} className="text-red-600 hover:text-red-700 dark:text-red-400">
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
                    {submitting ? t("saving") || "Submitting..." : t("support.submit") || "Submit Ticket"}
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

export default SupportNew;
