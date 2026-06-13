import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Upload,
  CheckSquare,
  Square,
  Bell,
  Wrench,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import ScheduleSystemModal from "../ScheduleSystemModal";
import UploadDocumentModal from "../UploadDocumentModal";

/**
 * Quick actions for the system detail right rail (screenshot 3 reference).
 */
export function SystemQuickActionsCard({
  systemId,
  systemLabel,
  propertyId,
  propertyData,
  systemsToShow,
  propertySystems,
  contacts,
  isNewInstall,
  onNewInstallChange,
  onScheduleInspection,
  onScheduleSuccess,
  uploadTrigger = 0,
  scheduleTrigger = 0,
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (uploadTrigger > 0) setShowUpload(true);
  }, [uploadTrigger]);

  useEffect(() => {
    if (scheduleTrigger > 0) setShowSchedule(true);
  }, [scheduleTrigger]);

  const actions = [
    {
      id: "schedule",
      label: "Schedule Maintenance",
      icon: Calendar,
      onClick: () => setShowSchedule(true),
    },
    {
      id: "upload",
      label: "Upload Document",
      icon: Upload,
      onClick: () => setShowUpload(true),
    },
    {
      id: "new-install",
      label: isNewInstall ? "Marked as New Install" : "Mark as New Install",
      icon: isNewInstall ? CheckSquare : Square,
      onClick: () => onNewInstallChange?.(!isNewInstall),
    },
    {
      id: "reminder",
      label: "Add Reminder",
      icon: Bell,
      onClick: () => setShowSchedule(true),
    },
  ];

  return (
    <>
      <SectionCard flat title="Quick Actions" icon={Wrench}>
        <ul className="space-y-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={action.onClick}
                  className="w-full flex items-center gap-2.5 py-2 px-1 rounded-lg text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors group"
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      action.id === "new-install" && isNewInstall
                        ? "text-emerald-600"
                        : "text-neutral-400 group-hover:text-[#456564]"
                    }`}
                  />
                  <span className="group-hover:text-[#456564] dark:group-hover:text-[#7fa3a1]">
                    {action.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      {showSchedule &&
        createPortal(
          <ScheduleSystemModal
            isOpen
            onClose={() => setShowSchedule(false)}
            systemLabel={systemLabel}
            systemType={systemId}
            contacts={contacts}
            onSchedule={onScheduleInspection}
            onScheduleSuccess={onScheduleSuccess}
            propertyId={propertyId}
            propertyData={propertyData}
          />,
          document.body,
        )}

      {showUpload &&
        createPortal(
          <UploadDocumentModal
            isOpen
            onClose={() => setShowUpload(false)}
            systemType={systemId}
            systemLabel={systemLabel}
            propertyId={propertyId}
            systemsToShow={systemsToShow}
            propertySystems={propertySystems}
            customSystemNames={propertyData?.customSystemNames ?? []}
          />,
          document.body,
        )}
    </>
  );
}
