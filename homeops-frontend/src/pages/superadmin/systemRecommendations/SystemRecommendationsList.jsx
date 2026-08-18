import React, {useEffect, useMemo, useState, useCallback} from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertTriangle,
} from "lucide-react";

import Banner from "../../../partials/containers/Banner";
import ModalBlank from "../../../components/ModalBlank";
import AppApi from "../../../api/api";
import {PAGE_LAYOUT} from "../../../constants/layout";
import {PROPERTY_SYSTEMS} from "../../properties/constants/propertySystems";
import SystemRecommendationFormModal from "./SystemRecommendationFormModal";

/** Canonical systems eligible for templates (excludes the "inspections" pseudo-system). */
const SYSTEM_OPTIONS = PROPERTY_SYSTEMS.filter((s) => s.id !== "inspections");
const SYSTEM_LABELS = Object.fromEntries(
  PROPERTY_SYSTEMS.map((s) => [s.id, s.name]),
);

const PRIORITY_TONES = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300",
};

function frequencyLabel(tpl) {
  if (tpl.frequency && tpl.frequency_unit) {
    const n = tpl.frequency;
    const unit = n === 1 ? tpl.frequency_unit.replace(/s$/, "") : tpl.frequency_unit;
    return `Every ${n === 1 ? "" : `${n} `}${unit}`.replace("Every  ", "Every ");
  }
  if (tpl.lifecycle_replacement_years) {
    return `Replace ~${tpl.lifecycle_replacement_years} yrs`;
  }
  return null;
}

function SystemRecommendationsList() {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);

  const [banner, setBanner] = useState({open: false, type: "success", message: ""});
  const showBanner = useCallback((type, message) => {
    setBanner({open: true, type, message});
  }, []);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [defaultSystemKey, setDefaultSystemKey] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const {grouped: g} = await AppApi.getSystemRecommendationTemplates();
      setGrouped(g || {});
    } catch (err) {
      showBanner("error", err?.message || "Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  }, [showBanner]);

  useEffect(() => {
    load();
  }, [load]);

  // Systems are shown in the canonical order, including empty groups.
  const orderedSystems = useMemo(
    () => SYSTEM_OPTIONS.map((s) => s.id),
    [],
  );

  const openCreate = (systemKey) => {
    setEditingTemplate(null);
    setDefaultSystemKey(systemKey || "");
    setFormOpen(true);
  };

  const openEdit = (tpl) => {
    setEditingTemplate(tpl);
    setDefaultSystemKey(tpl.system_key);
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    if (editingTemplate) {
      await AppApi.updateSystemRecommendationTemplate(editingTemplate.id, payload);
      showBanner("success", "Recommendation updated.");
    } else {
      await AppApi.createSystemRecommendationTemplate(payload);
      showBanner("success", "Recommendation created.");
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await AppApi.deleteSystemRecommendationTemplate(deleteTarget.id);
      showBanner("success", "Recommendation deleted.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showBanner("error", err?.message || "Could not delete the recommendation.");
    } finally {
      setDeleting(false);
    }
  };

  // Move a template up/down within its system and persist the new order.
  const move = async (systemKey, index, direction) => {
    const list = grouped[systemKey] || [];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const reordered = [...list];
    const [item] = reordered.splice(index, 1);
    reordered.splice(target, 0, item);

    // Optimistic update.
    setGrouped((prev) => ({...prev, [systemKey]: reordered}));
    try {
      await AppApi.reorderSystemRecommendationTemplates(
        systemKey,
        reordered.map((t) => t.id),
      );
    } catch (err) {
      showBanner("error", err?.message || "Could not reorder.");
      await load();
    }
  };

  return (
    <>

            <div className="fixed right-0 w-auto sm:w-full z-50">
          <Banner
            type={banner.type}
            open={banner.open}
            setOpen={(open) => setBanner((b) => ({...b, open}))}
            className={`transition-opacity duration-600 ${
              banner.open ? "opacity-100" : "opacity-0"
            }`}
          >
            {banner.message}
          </Banner>
        </div>

        <main className="grow">
          <div className={PAGE_LAYOUT.list}>
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  Default System Recommendations
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  These templates are copied into a property&apos;s Action Items
                  when each system is first added.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
                  onClick={() => openCreate("")}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  <span>New recommendation</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 py-12 text-center">
                Loading recommendations…
              </div>
            ) : (
              <div className="space-y-6">
                {orderedSystems.map((systemKey) => {
                  const list = grouped[systemKey] || [];
                  return (
                    <section
                      key={systemKey}
                      className="rounded-xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 shadow-sm overflow-hidden"
                    >
                      <div className="px-5 py-3.5 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {SYSTEM_LABELS[systemKey] || systemKey}
                          </h2>
                          <span className="text-xs text-gray-400">
                            {list.length}{" "}
                            {list.length === 1 ? "recommendation" : "recommendations"}
                          </span>
                        </div>
                        <button
                          className="btn-sm border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
                          onClick={() => openCreate(systemKey)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add
                        </button>
                      </div>

                      {list.length === 0 ? (
                        <div className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500">
                          No recommendations yet.
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {list.map((tpl, index) => {
                            const freq = frequencyLabel(tpl);
                            return (
                              <li
                                key={tpl.id}
                                className="px-5 py-3.5 flex items-start gap-3"
                              >
                                <div className="flex flex-col gap-1 pt-0.5">
                                  <button
                                    className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-300"
                                    onClick={() => move(systemKey, index, -1)}
                                    disabled={index === 0}
                                    aria-label="Move up"
                                  >
                                    <ArrowUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-300"
                                    onClick={() => move(systemKey, index, 1)}
                                    disabled={index === list.length - 1}
                                    aria-label="Move down"
                                  >
                                    <ArrowDown className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                      {tpl.title}
                                    </span>
                                    {!tpl.active && (
                                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                                        Inactive
                                      </span>
                                    )}
                                    <span
                                      className={`text-[11px] font-medium px-1.5 py-0.5 rounded capitalize ${
                                        PRIORITY_TONES[tpl.priority] ||
                                        PRIORITY_TONES.low
                                      }`}
                                    >
                                      {tpl.priority}
                                    </span>
                                    {freq && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                                        <Clock className="w-3 h-3" />
                                        {freq}
                                      </span>
                                    )}
                                  </div>
                                  {tpl.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                      {tpl.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 dark:hover:text-gray-200"
                                    onClick={() => openEdit(tpl)}
                                    aria-label="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                    onClick={() => setDeleteTarget(tpl)}
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      
  
    </>
  );
}

export default SystemRecommendationsList;
