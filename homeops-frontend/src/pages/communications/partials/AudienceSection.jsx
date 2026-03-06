import React, { useState } from "react";
import { Users, Search, Plus, Trash2 } from "lucide-react";

const RECIPIENT_PRESETS_ADMIN = [
  { value: "all_homeowners", label: "All homeowners", desc: "Every homeowner in your organization" },
  { value: "all_agents", label: "All agents", desc: "Every agent in your organization" },
  { value: "all_users", label: "All users", desc: "Everyone (homeowners + agents)" },
  { value: "selected_homeowners", label: "Selected homeowners", desc: "Pick individual homeowners" },
  { value: "selected_agents", label: "Selected agents", desc: "Pick individual agents" },
  { value: "selected_users", label: "Selected users", desc: "Pick individual users" },
];

const RECIPIENT_PRESETS_AGENT = [
  { value: "all_homeowners", label: "All assigned homeowners", desc: "Homeowners linked to your properties" },
  { value: "selected_homeowners", label: "Selected homeowners", desc: "Pick individual homeowners" },
];

const AUTO_SEND_TRIGGERS = [
  { value: "user_created", label: "Creates an account" },
  { value: "property_created", label: "Creates a property" },
  { value: "maintenance_recorded", label: "Records maintenance" },
  { value: "event_scheduled", label: "Schedules an event" },
];

const AUTO_SEND_ROLES = [
  { value: "", label: "Any user" },
  { value: "homeowner", label: "Homeowner" },
  { value: "agent", label: "Agent" },
];

function AudienceSection({ form, updateForm, disabled, isAdmin, recipientOptions, estimatedCount }) {
  const [recipientSearch, setRecipientSearch] = useState("");
  const presets = isAdmin ? RECIPIENT_PRESETS_ADMIN : RECIPIENT_PRESETS_AGENT;
  const isAutoSend = form.deliveryMode === "auto_send";

  const toggleRecipientId = (uid) => {
    const ids = form.recipientIds || [];
    const next = ids.includes(uid) ? ids.filter((x) => x !== uid) : [...ids, uid];
    updateForm({ recipientIds: next });
  };

  const filterList = (list) => {
    if (!recipientSearch?.trim()) return list || [];
    const q = recipientSearch.toLowerCase().trim();
    return (list || []).filter(
      (r) => (r.name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q)
    );
  };

  const isSelectMode = ["selected_homeowners", "selected_agents", "selected_users"].includes(form.recipientMode);

  const getPickerList = () => {
    if (!recipientOptions) return [];
    switch (form.recipientMode) {
      case "selected_homeowners":
        return filterList(recipientOptions.homeowners);
      case "selected_agents":
        return filterList(recipientOptions.agents);
      case "selected_users":
        return filterList([...(recipientOptions.homeowners || []), ...(recipientOptions.agents || [])]);
      default:
        return [];
    }
  };

  // Auto-send rules management
  const addRule = () => {
    updateForm({
      rules: [...(form.rules || []), { triggerEvent: "user_created", triggerRole: "" }],
    });
  };

  const updateRule = (index, field, value) => {
    const next = [...(form.rules || [])];
    next[index] = { ...next[index], [field]: value };
    updateForm({ rules: next });
  };

  const removeRule = (index) => {
    const next = [...(form.rules || [])];
    next.splice(index, 1);
    updateForm({ rules: next });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-[#456564]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Audience
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isAutoSend ? "Set rules for when to automatically send" : "Who should receive this communication?"}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Delivery mode toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => !disabled && updateForm({ deliveryMode: "send_now", rules: [] })}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !isAutoSend
                ? "bg-[#456564]/10 text-[#456564] dark:text-[#5a7a78] border-2 border-[#456564]"
                : "border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"
            } disabled:opacity-60`}
          >
            Manual send
          </button>
          <button
            type="button"
            onClick={() => !disabled && updateForm({ deliveryMode: "auto_send", recipientMode: "", recipientIds: [] })}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isAutoSend
                ? "bg-[#456564]/10 text-[#456564] dark:text-[#5a7a78] border-2 border-[#456564]"
                : "border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"
            } disabled:opacity-60`}
          >
            Auto-send rules
          </button>
        </div>

        {/* Manual: recipient presets */}
        {!isAutoSend && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {presets.map((preset) => (
                <label
                  key={preset.value}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                    form.recipientMode === preset.value
                      ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="recipientMode"
                    value={preset.value}
                    checked={form.recipientMode === preset.value}
                    onChange={() => updateForm({ recipientMode: preset.value, recipientIds: [] })}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{preset.label}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{preset.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* User picker for "selected_*" modes */}
            {isSelectMode && (
              <div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="form-input w-full pl-9 text-sm"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl p-2 space-y-0.5">
                  {getPickerList().length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-3 text-center">
                      {recipientSearch ? "No matches." : "No users available."}
                    </p>
                  ) : (
                    getPickerList().map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 cursor-pointer py-2 px-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={(form.recipientIds || []).includes(u.id)}
                          onChange={() => toggleRecipientId(u.id)}
                          disabled={disabled}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                          {u.name || u.email}
                          {u.name && u.email && (
                            <span className="text-gray-500 dark:text-gray-400"> ({u.email})</span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Estimated count */}
            {form.recipientMode && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Estimated recipients:
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {estimatedCount ?? "…"}
                </span>
              </div>
            )}
          </>
        )}

        {/* Auto-send rules */}
        {isAutoSend && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically send this message when <strong>any</strong> of these events happen.
            </p>
            {(form.rules || []).map((rule, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30"
              >
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">When</span>
                <select
                  value={rule.triggerRole || ""}
                  onChange={(e) => updateRule(idx, "triggerRole", e.target.value || null)}
                  disabled={disabled}
                  className="form-select flex-1 min-w-0 text-sm disabled:opacity-60"
                >
                  {AUTO_SEND_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <select
                  value={rule.triggerEvent}
                  onChange={(e) => updateRule(idx, "triggerEvent", e.target.value)}
                  disabled={disabled}
                  className="form-select flex-1 min-w-0 text-sm disabled:opacity-60"
                >
                  {AUTO_SEND_TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button
                type="button"
                onClick={addRule}
                className="flex items-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564] text-sm transition-colors justify-center"
              >
                <Plus className="w-4 h-4" />
                Add rule
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AudienceSection;
