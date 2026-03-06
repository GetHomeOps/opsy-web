import React from "react";
import {useNavigate} from "react-router-dom";
import {Layers, Tag, ArrowRight} from "lucide-react";
import useCurrentAccount from "../../../hooks/useCurrentAccount";

const ICON_OPTIONS = [
  {value: "leaf", label: "Leaf"},
  {value: "zap", label: "Zap"},
  {value: "droplets", label: "Droplets"},
  {value: "droplet", label: "Droplet"},
  {value: "palette", label: "Palette"},
  {value: "shield", label: "Shield"},
  {value: "sparkles", label: "Sparkles"},
  {value: "wrench", label: "Wrench"},
  {value: "hammer", label: "Hammer"},
  {value: "home", label: "Home"},
];

function CategoryForm({
  formData,
  errors,
  isNew,
  parentCategories,
  childCategories,
  existingCategory,
  onChange,
}) {
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const isParent = formData.type === "parent";

  return (
    <div className="space-y-8">
      {/* ─── Category Type Selection ─────────────────────────── */}
      {isNew && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Category Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange("type", "parent")}
              className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                isParent
                  ? "border-violet-500 bg-violet-50/60 dark:bg-violet-500/10 shadow-sm shadow-violet-500/10"
                  : "border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isParent
                    ? "bg-violet-100 dark:bg-violet-500/20"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <Layers
                  className={`w-4.5 h-4.5 ${
                    isParent
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                />
              </div>
              <div className="text-left">
                <div
                  className={`text-sm font-semibold ${
                    isParent
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  Parent Category
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Top-level group
                </div>
              </div>
              {isParent && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => onChange("type", "child")}
              className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                !isParent
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10 shadow-sm shadow-emerald-500/10"
                  : "border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  !isParent
                    ? "bg-emerald-100 dark:bg-emerald-500/20"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <Tag
                  className={`w-4.5 h-4.5 ${
                    !isParent
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                />
              </div>
              <div className="text-left">
                <div
                  className={`text-sm font-semibold ${
                    !isParent
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  Subcategory
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Child of a parent
                </div>
              </div>
              {!isParent && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── General Information ──────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          General Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="category-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="category-name"
              type="text"
              className={`form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm ${
                errors.name ? "!border-red-500" : ""
              }`}
              placeholder={
                isParent
                  ? "e.g. Outdoor & Garden"
                  : "e.g. Landscapers"
              }
              value={formData.name}
              onChange={(e) => onChange("name", e.target.value)}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="category-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="category-description"
              className="form-textarea w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
              rows={3}
              placeholder="Brief description of this category..."
              value={formData.description}
              onChange={(e) => onChange("description", e.target.value)}
            />
          </div>

          {/* Parent selector (subcategories only) */}
          {!isParent && (
            <div>
              <label
                htmlFor="category-parent"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Parent Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category-parent"
                className={`form-select w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm ${
                  errors.parentId ? "!border-red-500" : ""
                }`}
                value={formData.parentId}
                onChange={(e) => onChange("parentId", e.target.value)}
              >
                <option value="">Select a parent category...</option>
                {parentCategories.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.parentId && (
                <p className="mt-1 text-xs text-red-500">{errors.parentId}</p>
              )}
            </div>
          )}

          {/* Icon selector (parent categories only) */}
          {isParent && (
            <div>
              <label
                htmlFor="category-icon"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Icon
              </label>
              <select
                id="category-icon"
                className="form-select w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                value={formData.icon}
                onChange={(e) => onChange("icon", e.target.value)}
              >
                <option value="">Select an icon...</option>
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ─── Subcategories Panel (when editing a parent) ─────── */}
      {!isNew && isParent && childCategories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Subcategories
            </h2>
            <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {childCategories.length}
            </span>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
            {childCategories.map((child) => (
              <div
                key={child.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer group"
                onClick={() =>
                  navigate(
                    `/${accountUrl}/professionals/categories/${child.id}`,
                  )
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  navigate(
                    `/${accountUrl}/professionals/categories/${child.id}`,
                  )
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  {(child.image_url || child.imageUrl) && (
                    <img
                      src={child.image_url || child.imageUrl}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                  )}
                  {!(child.image_url || child.imageUrl) && (
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Tag className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {child.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {child.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default CategoryForm;
