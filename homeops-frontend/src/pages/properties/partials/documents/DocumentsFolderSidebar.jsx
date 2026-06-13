import React from "react";
import {useDroppable} from "@dnd-kit/core";
import {
  Files,
  Folder,
  Inbox,
  Plus,
  PanelLeftClose,
} from "lucide-react";

/**
 * A single folder row. The row is a @dnd-kit droppable so inbox cards and
 * filed documents can be dropped onto it (same data contract as the old
 * tree view: {type: "folder", systemKey, label}).
 */
function FolderRow({
  category,
  count,
  isSelected,
  isDropDisabled,
  dropDisabledReason,
  onSelect,
  onUploadForSystem,
}) {
  const Icon = category.icon || Folder;
  const {isOver, setNodeRef} = useDroppable({
    id: `folder:${category.id}`,
    data: {type: "folder", systemKey: category.id, label: category.label},
    disabled: isDropDisabled,
  });

  const dropHighlight = isOver
    ? isDropDisabled
      ? "bg-red-50 dark:bg-red-900/20 ring-2 ring-red-300/40"
      : "bg-[#456654]/[0.08] dark:bg-[#456654]/20 ring-2 ring-[#456654]/30"
    : "";

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect?.(category.id)}
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${dropHighlight} ${
        isSelected
          ? "bg-[#456654]/[0.08] dark:bg-[#456654]/20 text-[#2f4a44] dark:text-[#a8c0b4]"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60"
      }`}
      title={isDropDisabled && isOver ? dropDisabledReason : category.label}
    >
      <Icon
        className={`w-4 h-4 shrink-0 ${
          isSelected
            ? "text-[#456654] dark:text-[#7a9a88]"
            : "text-gray-400 dark:text-gray-500"
        }`}
      />
      <span
        className={`text-sm flex-1 truncate ${
          isSelected ? "font-semibold" : "font-medium"
        }`}
      >
        {category.label}
      </span>
      {isOver && !isDropDisabled ? (
        <span className="text-[10px] font-medium text-[#3a5548] dark:text-[#a8c0b4] bg-[#456654]/15 dark:bg-[#456654]/30 px-1.5 py-0.5 rounded">
          Drop
        </span>
      ) : (
        <>
          {onUploadForSystem && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isDropDisabled) onUploadForSystem(category.id);
              }}
              disabled={isDropDisabled}
              className="p-0.5 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:text-[#456654] hover:bg-[#456654]/10 dark:hover:bg-[#456654]/20 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
              title={
                isDropDisabled
                  ? dropDisabledReason
                  : `Upload to ${category.label}`
              }
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {count > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
              {count}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Clean folder navigation sidebar for the Documents tab:
 * "All Documents", Inbox (staged uploads), then one row per system folder
 * with counts. Folder rows are drop targets for drag-and-drop filing.
 */
function DocumentsFolderSidebar({
  systemsToShow = [],
  documentsBySystem = {},
  totalCount = 0,
  inboxCount = 0,
  allSelected = false,
  inboxSelected = false,
  selectedFolderId = null,
  onSelectAll,
  onSelectInbox,
  onSelectFolder,
  onUploadForSystem,
  systemUploadDisabledIds = [],
  onCollapse,
}) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
          Documents
        </h3>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {/* All Documents */}
        <div
          onClick={() => onSelectAll?.()}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            allSelected
              ? "bg-[#456654]/[0.08] dark:bg-[#456654]/20 text-[#2f4a44] dark:text-[#a8c0b4]"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60"
          }`}
        >
          <Files
            className={`w-4 h-4 shrink-0 ${
              allSelected
                ? "text-[#456654] dark:text-[#7a9a88]"
                : "text-gray-400 dark:text-gray-500"
            }`}
          />
          <span
            className={`text-sm flex-1 truncate ${
              allSelected ? "font-semibold" : "font-medium"
            }`}
          >
            All Documents
          </span>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
              {totalCount}
            </span>
          )}
        </div>

        {/* Inbox (staged uploads waiting to be filed) */}
        <div
          onClick={() => onSelectInbox?.()}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            inboxSelected
              ? "bg-[#456654]/[0.08] dark:bg-[#456654]/20 text-[#2f4a44] dark:text-[#a8c0b4]"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60"
          }`}
        >
          <Inbox
            className={`w-4 h-4 shrink-0 ${
              inboxSelected
                ? "text-[#456654] dark:text-[#7a9a88]"
                : "text-gray-400 dark:text-gray-500"
            }`}
          />
          <span
            className={`text-sm flex-1 truncate ${
              inboxSelected ? "font-semibold" : "font-medium"
            }`}
          >
            Inbox
          </span>
          {inboxCount > 0 && (
            <span className="text-[10px] font-semibold text-[#3a5548] dark:text-[#a8c0b4] bg-[#456654]/15 dark:bg-[#456654]/30 px-1.5 py-0.5 rounded-full shrink-0">
              {inboxCount}
            </span>
          )}
        </div>

        <div className="pt-3 pb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
          Folders
        </div>

        {systemsToShow.map((category) => {
          const disabled = systemUploadDisabledIds.includes(category.id);
          return (
            <FolderRow
              key={category.id}
              category={category}
              count={(documentsBySystem[category.id] || []).length}
              isSelected={selectedFolderId === category.id}
              isDropDisabled={disabled}
              dropDisabledReason="This property already has an inspection report"
              onSelect={onSelectFolder}
              onUploadForSystem={onUploadForSystem}
            />
          );
        })}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {totalCount} document{totalCount === 1 ? "" : "s"} filed
          {inboxCount > 0
            ? ` · ${inboxCount} in inbox`
            : ""}
        </p>
      </div>
    </div>
  );
}

export default DocumentsFolderSidebar;
