import React, {useState, useEffect, useContext} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {ArrowLeft, Home} from "lucide-react";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PropertyContext from "../../context/PropertyContext";
import ContactContext from "../../context/ContactContext";
import {MaintenanceFormPanel} from "./partials/maintenance";
import PropertyUnauthorized from "./PropertyUnauthorized";
import PropertyNotFound from "./PropertyNotFound";
import {ApiError} from "../../api/api";
import {
  PROPERTY_SYSTEMS,
  DEFAULT_SYSTEM_IDS,
} from "./constants/propertySystems";

function isPropertyNotFoundError(err) {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404) return true;
  if (err.status === 403) {
    const msg = (err.message || (err.messages && err.messages[0]) || "").toLowerCase();
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

  const {getPropertyById, updateProperty} = useContext(PropertyContext);
  const {contacts} = useContext(ContactContext);

  const [property, setProperty] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState(null);
  const [propertyAccessDenied, setPropertyAccessDenied] = useState(false);
  const [propertyNotFound, setPropertyNotFound] = useState(false);

  // Load property and find the record
  useEffect(() => {
    async function loadProperty() {
      setLoading(true);
      setPropertyAccessDenied(false);
      setPropertyNotFound(false);
      try {
        const propertyData = await getPropertyById(propertyId);
        setProperty(propertyData);

        // Find the specific record if editing existing
        if (
          recordId &&
          recordId !== "new" &&
          propertyData?.maintenanceHistory
        ) {
          const existingRecord = propertyData.maintenanceHistory.find(
            (r) => r.id === recordId,
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
    loadProperty();
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

  // Handle save
  const handleSave = async (recordData) => {
    try {
      // Update the property's maintenance history
      const updatedHistory = [...(property?.maintenanceHistory || [])];
      const existingIndex = updatedHistory.findIndex(
        (r) => r.id === recordData.id,
      );

      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = recordData;
      } else {
        updatedHistory.push(recordData);
      }

      // Update property via context (if available)
      if (updateProperty) {
        await updateProperty(propertyId, {
          ...property,
          maintenanceHistory: updatedHistory,
        });
      }

      setRecord(recordData);
      setSaveMessage({type: "success", text: "Record saved successfully!"});
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Error saving record:", err);
      setSaveMessage({
        type: "error",
        text: "Failed to save record. Please try again.",
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  // Handle delete
  const handleDelete = async (deleteRecordId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this maintenance record?",
      )
    ) {
      return;
    }

    try {
      const updatedHistory = (property?.maintenanceHistory || []).filter(
        (r) => r.id !== deleteRecordId,
      );

      if (updateProperty) {
        await updateProperty(propertyId, {
          ...property,
          maintenanceHistory: updatedHistory,
        });
      }

      // Navigate back to property after deletion
      navigate(`/${accountUrl}/properties/${propertyId}`);
    } catch (err) {
      console.error("Error deleting record:", err);
      setSaveMessage({
        type: "error",
        text: "Failed to delete record. Please try again.",
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
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
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
            <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
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
            <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
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
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-6xl mx-auto">
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

            {/* Save/Error Message */}
            {saveMessage && (
              <div
                className={`mb-4 p-4 rounded-lg ${
                  saveMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                }`}
              >
                {saveMessage.text}
              </div>
            )}

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
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default MaintenanceRecordPage;
