import React, {useState, useEffect, useContext} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {X, Building, Zap} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";
import MaintenanceScheduleModal from "../properties/partials/MaintenanceScheduleModal";
import {PROPERTY_SYSTEMS} from "../properties/constants/propertySystems";
import PropertyContext from "../../context/PropertyContext";
import ContactContext from "../../context/ContactContext";

/**
 * Wrapper modal for scheduling maintenance from the Calendar page.
 * Lets user pick property + system first, then opens MaintenanceScheduleModal.
 */
function CalendarScheduleModal({isOpen, onClose, onScheduled, initialDate = "", initialTime = ""}) {
  const navigate = useNavigate();
  const {accountUrl} = useParams();
  const {properties, getPropertyById, getSystemsByPropertyId} = useContext(PropertyContext);
  const {contacts = []} = useContext(ContactContext);

  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [propertyData, setPropertyData] = useState(null);
  const [propertySystems, setPropertySystems] = useState([]);
  const [loadingProperty, setLoadingProperty] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPropertyId("");
      setSelectedSystem(null);
      setPropertyData(null);
      setPropertySystems([]);
      setShowScheduleModal(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPropertyId || !getPropertyById) {
      setPropertyData(null);
      setPropertySystems([]);
      return;
    }
    let cancelled = false;
    setLoadingProperty(true);
    setSelectedSystem(null);
    getPropertyById(selectedPropertyId)
      .then(async (data) => {
        if (cancelled) return;
        const prop = data || null;
        setPropertyData(prop);
        const propId = prop?.id ?? prop?.property_uid ?? selectedPropertyId;
        if (getSystemsByPropertyId) {
          try {
            const systemsRes = await getSystemsByPropertyId(propId);
            const systemsArr = systemsRes?.systems ?? systemsRes ?? [];
            if (!cancelled) {
              const systems = (systemsArr ?? []).filter((s) => s.included !== false);
              setPropertySystems(systems);
            }
          } catch {
            if (!cancelled) setPropertySystems([]);
          }
        } else {
          setPropertySystems([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPropertyData(null);
          setPropertySystems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProperty(false);
      });
    return () => { cancelled = true; };
  }, [selectedPropertyId]); // getPropertyById, getSystemsByPropertyId omitted - stable from context

  const handleContinue = () => {
    if (selectedPropertyId && selectedSystem && propertyData) {
      setShowScheduleModal(true);
    }
  };

  const handleScheduleClose = (closed) => {
    setShowScheduleModal(false);
    if (closed) {
      onScheduled?.();
      onClose(false);
    }
  };

  const canContinue =
    selectedPropertyId &&
    selectedSystem &&
    propertyData &&
    !loadingProperty;

  const professionalsPath = accountUrl ? `/${accountUrl}/professionals` : "/professionals";

  return (
    <ModalBlank
      id="calendar-schedule-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName={showScheduleModal ? "max-w-2xl" : "max-w-md"}
    >
      {showScheduleModal && selectedSystem && propertyData ? (
        <MaintenanceScheduleModal
          isOpen={true}
          onClose={handleScheduleClose}
          systemType={selectedSystem.id}
          systemLabel={selectedSystem.name}
          propertyData={propertyData}
          propertyIdFallback={selectedPropertyId}
          contacts={contacts}
          onSchedule={() => onScheduled?.()}
          initialScheduledDate={initialDate}
          initialScheduledTime={initialTime}
          embedded={true}
        />
      ) : (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-800/40 flex items-center justify-center">
              <Building className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Schedule Event
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select property and system
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#456564]" />
                Property
              </span>
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="form-select w-full"
            >
              <option value="">Select a property</option>
              {(properties || [])
                .slice()
                .sort((a, b) =>
                  (a.passport_id || a.identity?.propertyName || a.name || "").localeCompare(
                    b.passport_id || b.identity?.propertyName || b.name || "",
                  ),
                )
                .map((p) => {
                  const pid = p.property_uid ?? p.id ?? p.uid;
                  const name = p.identity?.propertyName || p.name || `Property ${pid}`;
                  const passportId = p.passport_id ?? p.passportId ?? "";
                  const label = passportId ? `${name} (${passportId})` : name;
                  return (
                    <option key={pid} value={pid}>
                      {label}
                    </option>
                  );
                })}
            </select>
            {!properties?.length && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                No properties yet.{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose(false);
                    navigate(accountUrl ? `/${accountUrl}/properties` : "/properties");
                  }}
                  className="underline hover:no-underline"
                >
                  Add a property
                </button>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#456564]" />
                System
              </span>
            </label>
            <select
              value={selectedSystem?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const sys = PROPERTY_SYSTEMS.find((s) => s.id === id);
                setSelectedSystem(sys || null);
              }}
              className="form-select w-full"
              disabled={!selectedPropertyId || loadingProperty}
            >
              <option value="">
                {!selectedPropertyId
                  ? "Select a property first"
                  : loadingProperty
                    ? "Loading systems..."
                    : propertySystems.length === 0
                      ? "No systems configured for this property"
                      : "Select a system"}
              </option>
              {(() => {
                const systemKeys = propertySystems.map(
                  (s) => s.system_key ?? s.systemKey,
                ).filter(Boolean);
                const systemsToShow =
                  systemKeys.length > 0
                    ? PROPERTY_SYSTEMS.filter((sys) => systemKeys.includes(sys.id))
                    : [];
                return systemsToShow.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name}
                  </option>
                ));
              })()}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingProperty ? "Loading..." : "Continue"}
          </button>
        </div>
      </div>
      )}
    </ModalBlank>
  );
}

export default CalendarScheduleModal;
