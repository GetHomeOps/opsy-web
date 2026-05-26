import React, {useEffect, useState} from "react";
import {Send, Zap} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const VARIANT_DEFAULTS = {
  ses: {
    title: "Send test email",
    description: "Delivers via the configured provider using sample merge data.",
    submitLabel: "Send test",
    SubmitIcon: Send,
  },
  customer_io: {
    title: "Trigger Customer.io test event",
    description:
      "Identifies this address in Customer.io and sends the configured event name with the same sample data as previews. Use it to validate a journey or campaign in your workspace—not for transactional template sends.",
    submitLabel: "Send event",
    SubmitIcon: Zap,
  },
};

function EmailTestSendModal({
  modalOpen,
  setModalOpen,
  defaultEmail = "",
  onSend,
  sending = false,
  variant = "ses",
}) {
  const cfg = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.ses;
  const {title, description, submitLabel, SubmitIcon} = cfg;
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState("");

  useEffect(() => {
    if (modalOpen) {
      setEmail(defaultEmail || "");
      setError("");
    }
  }, [modalOpen, defaultEmail]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    await onSend(trimmed);
  }

  return (
    <ModalBlank
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {description}
        </p>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Recipient email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          placeholder="name@example.com"
          autoFocus
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] text-white text-sm font-medium hover:bg-[#3a5554] disabled:opacity-50"
          >
            <SubmitIcon className="w-4 h-4" />
            {sending ? "Sending…" : submitLabel}
          </button>
        </div>
      </form>
    </ModalBlank>
  );
}

export default EmailTestSendModal;
