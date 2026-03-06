import React, {useState, useMemo} from "react";
import {createPortal} from "react-dom";
import {User, Upload, Calendar, CheckSquare, Square} from "lucide-react";
import InstallerPopover from "./InstallerPopover";
import ScheduleSystemModal from "./ScheduleSystemModal";
import UploadDocumentModal from "./UploadDocumentModal";

function SystemActionButtons({
  systemType,
  systemLabel,
  installerId,
  installerName,
  contacts = [],
  isNewInstall,
  onNewInstallChange,
  onScheduleInspection,
  onScheduleSuccess,
  propertyId,
  propertyData = {},
  systemsToShow = [],
}) {
  const [showInstallerCard, setShowInstallerCard] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const installer = useMemo(() => {
    if (installerId != null && installerId !== "" && contacts.length) {
      const byId = contacts.find((c) => String(c.id) === String(installerId));
      if (byId) return byId;
    }
    if (!installerName || !contacts.length) return null;
    return contacts.find(
      (c) =>
        c.name?.toLowerCase().includes(installerName.toLowerCase()) ||
        installerName.toLowerCase().includes(c.name?.toLowerCase())
    );
  }, [installerId, installerName, contacts]);

  const installerData =
    installer || (installerName ? {name: installerName} : null);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 flex-nowrap">
        {/* Installer Button */}
        <InstallerPopover
          installer={installerData}
          isOpen={showInstallerCard}
          onOpenChange={setShowInstallerCard}
          trigger={
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                installerData
                  ? "bg-emerald-200 dark:bg-emerald-700/60 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-300 dark:hover:bg-emerald-600/60"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={
                installerData
                  ? `Installer: ${installerData.name}`
                  : "No installer assigned"
              }
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Installer</span>
              {installerData && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 dark:bg-emerald-600" />
              )}
            </button>
          }
        />

        {/* New Install Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNewInstallChange?.(!isNewInstall);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
            isNewInstall
              ? "bg-emerald-200 dark:bg-emerald-700/60 text-emerald-900 dark:text-emerald-100"
              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
          title="Mark as new installation"
        >
          {isNewInstall ? (
            <CheckSquare className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">New Install</span>
        </button>

        {/* Upload Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowUploadModal(true);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-gray-200 transition-all duration-150"
          title="Upload document"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        {/* Schedule Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowScheduleModal(true);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-emerald-200 dark:hover:bg-emerald-700/60 hover:text-emerald-800 dark:hover:text-emerald-100 transition-all duration-150"
          title="Schedule inspection or maintenance"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Schedule</span>
        </button>
      </div>

      {/* Portal modals to document.body so they aren't clipped by overflow in the collapsible section header */}
      {showScheduleModal &&
        createPortal(
          <ScheduleSystemModal
            isOpen={true}
            onClose={() => setShowScheduleModal(false)}
            systemLabel={systemLabel}
            systemType={systemType}
            contacts={contacts}
            onSchedule={onScheduleInspection}
            onScheduleSuccess={onScheduleSuccess}
            propertyId={propertyId}
            propertyData={propertyData}
          />,
          document.body,
        )}

      {/* Only mount when open to avoid Radix Popover PopperAnchor infinite loop
          when many modals are hidden (each has DatePickerInput with Popover). */}
      {showUploadModal &&
        createPortal(
          <UploadDocumentModal
            isOpen={true}
            onClose={() => setShowUploadModal(false)}
            systemType={systemType}
            systemLabel={systemLabel}
            propertyId={propertyId}
            systemsToShow={systemsToShow}
          />,
          document.body,
        )}
    </div>
  );
}

export default SystemActionButtons;
