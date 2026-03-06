import React from "react";
import { Send, Mail, Smartphone, Clock, Zap } from "lucide-react";

const CHANNELS = [
  { value: "in_app", label: "In-app (Opsy)", icon: Smartphone, desc: "Notification bell in the app" },
  { value: "email", label: "Email", icon: Mail, desc: "Send via email" },
  { value: "both", label: "Both", icon: Send, desc: "In-app notification + email" },
];

function DeliverySection({ form, updateForm, disabled }) {
  const isAutoSend = form.deliveryMode === "auto_send";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
            <Send className="w-4 h-4 text-[#456564]" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Delivery
          </h2>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Channel selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Delivery channel
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {CHANNELS.map((ch) => {
              const Icon = ch.icon;
              const selected = (form.deliveryChannel || "in_app") === ch.value;
              return (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => !disabled && updateForm({ deliveryChannel: ch.value })}
                  disabled={disabled}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors disabled:opacity-60 ${
                    selected
                      ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${selected ? "text-[#456564]" : "text-gray-400"}`} />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{ch.label}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ch.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timing (only for manual send mode) */}
        {!isAutoSend && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              When to send
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => !disabled && updateForm({ deliveryMode: "send_now", scheduledAt: "" })}
                disabled={disabled}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors disabled:opacity-60 ${
                  form.deliveryMode === "send_now"
                    ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                }`}
              >
                <Zap className={`w-5 h-5 shrink-0 ${form.deliveryMode === "send_now" ? "text-[#456564]" : "text-gray-400"}`} />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Send now</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Deliver immediately</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => !disabled && updateForm({ deliveryMode: "schedule" })}
                disabled={disabled}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors disabled:opacity-60 ${
                  form.deliveryMode === "schedule"
                    ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                }`}
              >
                <Clock className={`w-5 h-5 shrink-0 ${form.deliveryMode === "schedule" ? "text-[#456564]" : "text-gray-400"}`} />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Schedule</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pick a date and time</p>
                </div>
              </button>
            </div>

            {form.deliveryMode === "schedule" && (
              <div className="mt-3">
                <input
                  type="datetime-local"
                  value={form.scheduledAt || ""}
                  onChange={(e) => updateForm({ scheduledAt: e.target.value })}
                  disabled={disabled}
                  min={new Date().toISOString().slice(0, 16)}
                  className="form-input w-full max-w-xs text-sm disabled:opacity-60"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeliverySection;
