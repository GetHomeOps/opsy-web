import React, {useState, useEffect, useContext} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {ArrowLeft, Home, Loader2} from "lucide-react";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PropertyContext from "../../context/PropertyContext";
import ContactContext from "../../context/ContactContext";
import {useAuth} from "../../context/AuthContext";
import {MaintenanceFormPanel} from "./partials/maintenance";
import PropertyUnauthorized from "./PropertyUnauthorized";
import PropertyNotFound from "./PropertyNotFound";
import {ApiError} from "../../api/api";
import AppApi from "../../api/api";
import {
  fromMaintenanceRecordBackend,
  mapMaintenanceRecordsFromBackend,
  toMaintenanceRecordPayload,
} from "./helpers/maintenanceRecordMapping";
import {PROPERTY_SYSTEMS} from "./constants/propertySystems";

function isPropertyNotFoundError(err) {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404) return true;
  if (err.status === 403) {
    const msg = (
      err.message ||
      (err.messages && err.messages[0]) ||
      ""
    ).toLowerCase();
    return msg.includes("not found");
  }
  return false;
}

/**
 * Standalone page for viewing/editing a single maintenance record.
 * Opened via "Open in New Tab" functionality from MaintenanceTab.
 *
 * Route: /:accountUrl/properties/:uid/maintenance/:systemId/:recordId
 *
 * This allows users to:
 * - Keep reference materials open alongside the form
 * - Work on multiple records simultaneously
 * - Return to the record later without losing context
 */
function MaintenanceRecordPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {accountUrl, uid: propertyId, systemId, recordId} = useParams();
  const navigate = useNavigate();

  const {getPropertyById} = useContext(PropertyContext);
  const {contacts} = useContext(ContactContext);
  const {currentUser} = useAuth();

  const [property, setProperty] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [propertyAccessDenied, setPropertyAccessDenied] = useState(false);
  const [propertyNotFound, setPropertyNotFound] = useState(false);

  // Load property and maintenance record (maintenance is fetched separately; property API does not include it)
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setPropertyAccessDenied(false);
      setPropertyNotFound(false);
      try {
        const propertyData = await getPropertyById(propertyId);
        setProperty(propertyData);

        if (recordId && recordId !== "new") {
          const numericPropertyId = propertyData?.id ?? propertyData?.property_id ?? propertyId;
          const rawRecords = await AppApi.getMaintenanceRecordsByPropertyId(numericPropertyId);
          const mapped = mapMaintenanceRecordsFromBackend(rawRecords ?? []);
          const existingRecord = mapped.find(
            (r) => String(r.id) === String(recordId),
          );
          setRecord(existingRecord || null);
        } else {
          setRecord(null);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (isPropertyNotFoundError(err)) {
            setPropertyNotFound(true);
          } else if (err.status === 403) {
            setPropertyAccessDenied(true);
          } else {
            console.error("Error loading property:", err);
          }
        } else {
          console.error("Error loading property:", err);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [propertyId, recordId, getPropertyById]);

  // Get system name
  const getSystemName = () => {
    // Check predefined systems
    const predefinedSystem = PROPERTY_SYSTEMS.find((s) => s.id === systemId);
    if (predefinedSystem) return predefinedSystem.name;

    // Check custom systems
    if (systemId?.startsWith("custom-")) {
      return systemId.replace("custom-", "");
    }

    return systemId || "System";
  };

  // Handle save — persists via maintenance API
  const handleSave = async (recordData) => {
    const numericPropertyId = property?.id ?? property?.property_id ?? propertyId;
    setIsSubmitting(true);
    try {
      if (recordData.id && !String(recordData.id).startsWith("MT-")) {
        const payload = toMaintenanceRecordPayload(recordData, numericPropertyId);
        const updated = await AppApi.updateMaintenanceRecord(recordData.id, payload);
        setRecord(fromMaintenanceRecordBackend(updated));
      } else {
        const created = await AppApi.createMaintenanceRecord({
          ...toMaintenanceRecordPayload(recordData, numericPropertyId),
          property_id: numericPropertyId,
        });
        setRecord(fromMaintenanceRecordBackend(created));
      }
      setSaveMessage({type: "success", text: "Record saved successfully!"});
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Error saving record:", err);
      setSaveMessage({
        type: "error",
        text: err?.message || "Failed to save record. Please try again.",
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete — persists via maintenance API
  const handleDelete = async (deleteRecordId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this maintenance record?",
      )
    ) {
      return;
    }

    try {
      const numericPropertyId = property?.id ?? property?.property_id ?? propertyId;
      await AppApi.deleteMaintenanceRecord(deleteRecordId, numericPropertyId);
      navigate(`/${accountUrl}/properties/${propertyId}`);
    } catch (err) {
      console.error("Error deleting record:", err);
      setSaveMessage({
        type: "error",
        text: err?.message || "Failed to delete record. Please try again.",
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  // Handle navigation back
  const handleBack = () => {
    navigate(`/${accountUrl}/properties/${propertyId}`);
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="grow flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
          </main>
        </div>
      </div>
    );
  }

  if (propertyNotFound) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="grow">
            <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
              <PropertyNotFound />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (propertyAccessDenied) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="grow">
            <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
              <PropertyUnauthorized />
            </div>
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
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-6xl mx-auto">
            {/* Breadcrumb / Navigation */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Property
                </button>
              </div>

              {/* Property info */}
              {property && (
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <Home className="w-4 h-4" />
                  <span>{property.address || "Property"}</span>
                  <span>•</span>
                  <span>{getSystemName()} Maintenance</span>
                </div>
              )}
            </div>

            {/* Form Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <MaintenanceFormPanel
                record={record}
                systemId={systemId}
                systemName={getSystemName()}
                propertyId={propertyId}
                onSave={handleSave}
                onDelete={handleDelete}
                contacts={contacts || []}
                isNewRecord={!record}
                isSubmitting={isSubmitting}
                saveBarAtTop
                propertyAddress={
                  property
                    ? [property.address, property.city, property.state]
                        .filter(Boolean)
                        .join(", ") || ""
                    : ""
                }
                senderName={currentUser?.data?.name || currentUser?.name || ""}
                externalBanner={
                  saveMessage
                    ? {
                        open: true,
                        message: saveMessage.text,
                        type: saveMessage.type || "success",
                      }
                    : null
                }
                onExternalBannerClose={() => setSaveMessage(null)}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default MaintenanceRecordPage;
