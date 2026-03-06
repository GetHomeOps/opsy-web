import React, {useMemo, useState} from "react";
import {useNavigate, useLocation, useParams} from "react-router-dom";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import SystemsTab from "./SystemsTab";
import MaintenanceTab from "./MaintenanceTab";
import IdentityTab from "./IdentityTab";
import DocumentsTab from "./DocumentsTab";
import CircularProgress from "../../partials/propertyFeatures/CircularProgress";
import DonutChart from "../../partials/propertyFeatures/DonutChart";
import ScoreCard from "./ScoreCard";
import HomeOpsTeam from "./partials/HomeOpsTeam";
import {
  Bed,
  Bath,
  Ruler,
  Calendar,
  CheckCircle2,
  FileText,
  Settings,
  Wrench,
  Image as ImageIcon,
  ClipboardList,
  Home,
  MapPin,
  Building,
  Zap,
  Droplet,
  Shield,
  AlertTriangle,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {useTranslation} from "react-i18next";

const propertyProfile = {
  id: "HPS-100234",
  address: "1234 Maplewood Lane",
  city: "Anytown",
  state: "USA",
  zip: "12345",
  price: 785000,
  rooms: 4,
  bathrooms: 3,
  squareFeet: 2800,
  yearBuilt: 1995,
  hpsScore: 92,
  healthScore: 92,
  mainPhoto:
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
  summary:
    "Recently updated colonial home with modern systems, solar, smart security, and low-maintenance landscaping.",
  agentId: "USR-002",
  homeownerIds: ["USR-201", "USR-204"],
  teamMembers: [
    {id: "USR-201", name: "Jordan Lee", role: "Homeowner", image: ""},
    {id: "USR-204", name: "Lena Ortiz", role: "Homeowner", image: ""},
    {id: "USR-002", name: "Marcus Reed", role: "Primary Agent", image: ""},
    {id: "USR-003", name: "Olivia Park", role: "Mortgage Partner", image: ""},
  ],
  healthMetrics: {
    documentsUploaded: {current: 8, total: 10},
    systemsIdentified: {current: 3, total: 6},
    maintenanceProfileSetup: {complete: true},
  },
  healthHighlights: [
    {
      label: "Roof",
      status: "Good",
      note: "Replaced in 2021 with 30-year architectural shingles.",
    },
    {
      label: "HVAC",
      status: "Needs Attention",
      note: "Annual service overdue by two months.",
    },
    {
      label: "Foundation",
      status: "Good",
      note: "No cracks detected in latest inspection.",
    },
  ],
  photos: [
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1430285561322-7808604715df?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
  ],
  maintenanceHistory: [
    {
      id: "MT-2311",
      date: "2024-08-04",
      title: "Quarterly HVAC Service",
      status: "Scheduled",
      notes: "Filter replacement and condenser cleaning.",
    },
    {
      id: "MT-2265",
      date: "2024-04-17",
      title: "Exterior Paint Refresh",
      status: "Completed",
      notes: "Repainted siding and trim. Touch-up required in spring.",
    },
    {
      id: "MT-2198",
      date: "2023-12-02",
      title: "Gutter Cleaning",
      status: "Completed",
      notes: "Cleared all gutters and installed new guards.",
    },
  ],
  documents: [
    {
      id: "DOC-8841",
      name: "Inspection Report - May 2024.pdf",
      type: "PDF",
      size: "2.1 MB",
      updatedAt: "2024-05-22",
    },
    {
      id: "DOC-8732",
      name: "Solar Performance Summary.csv",
      type: "CSV",
      size: "780 KB",
      updatedAt: "2024-03-18",
    },
    {
      id: "DOC-8510",
      name: "Insurance Policy - 2024.pdf",
      type: "PDF",
      size: "1.4 MB",
      updatedAt: "2024-01-08",
    },
  ],
};

const platformUsers = [
  {id: "USR-001", name: "Amelia Barton", role: "Agent"},
  {id: "USR-002", name: "Marcus Reed", role: "Agent"},
  {id: "USR-003", name: "Olivia Park", role: "Agent"},
  {id: "USR-201", name: "Jordan Lee", role: "Homeowner"},
  {id: "USR-202", name: "Priya Patel", role: "Homeowner"},
  {id: "USR-203", name: "Noah Garcia", role: "Homeowner"},
  {id: "USR-204", name: "Lena Ortiz", role: "Homeowner"},
];

const tabs = [
  {id: "identity", label: "Identity"},
  {id: "systems", label: "Systems"},
  {id: "maintenance", label: "Maintenance"},
  {id: "documents", label: "Documents"},
  {id: "media", label: "Media"},
];

const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const createInitialPropertyState = () => ({
  ...propertyProfile,
  homeownerIds: [...propertyProfile.homeownerIds],
  photos: [...propertyProfile.photos],
  healthHighlights: propertyProfile.healthHighlights.map((highlight) => ({
    ...highlight,
  })),
  maintenanceHistory: propertyProfile.maintenanceHistory.map((item) => ({
    ...item,
  })),
  documents: propertyProfile.documents.map((doc) => ({...doc})),
});

// Mock properties list for navigation (should be replaced with actual properties context/API)
const mockProperties = [
  {id: "HPS-100234", address: "1234 Maplewood Lane"},
  {id: "PROP-1001", address: "123 Main St"},
  {id: "PROP-1002", address: "48 Pine Ridge Rd"},
  {id: "PROP-1003", address: "890 Sunset Blvd"},
  {id: "PROP-1004", address: "221B Baker St"},
  {id: "PROP-1005", address: "742 Evergreen Terrace"},
  {id: "PROP-1006", address: "500 Market St"},
  {id: "PROP-1007", address: "2300 Riverside Dr"},
  {id: "PROP-1008", address: "30 Rockefeller Plaza"},
];

function PropertyFormContainer() {
  const navigate = useNavigate();
  const location = useLocation();
  const {id} = useParams();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const [propertyData, setPropertyData] = useState(createInitialPropertyState);
  const [activeTab, setActiveTab] = useState("identity");
  const [formChanged, setFormChanged] = useState(false);
  const {t} = useTranslation();

  const agentOptions = useMemo(
    () => platformUsers.filter((user) => user.role === "Agent"),
    [],
  );

  const homeownerOptions = useMemo(
    () => platformUsers.filter((user) => user.role === "Homeowner"),
    [],
  );

  const handleInputChange = (event) => {
    const {name, value} = event.target;
    setPropertyData((prev) => ({
      ...prev,
      [name]:
        name === "price" || name === "squareFeet" || name === "rooms"
          ? Number(value)
          : value,
    }));
    setFormChanged(true);
  };

  const handleAgentChange = (event) => {
    const agentId = event.target.value;
    setPropertyData((prev) => ({...prev, agentId}));
    setFormChanged(true);
  };

  const handleHomeownerToggle = (id) => {
    setPropertyData((prev) => {
      const homeownerIds = prev.homeownerIds.includes(id)
        ? prev.homeownerIds.filter((homeownerId) => homeownerId !== id)
        : [...prev.homeownerIds, id];
      return {...prev, homeownerIds};
    });
    setFormChanged(true);
  };

  const handleBackToProperties = () => navigate(`/${accountUrl}/properties`);
  const handleNewProperty = () => navigate(`/${accountUrl}/properties/new`);

  const handleCancelChanges = () => {
    setPropertyData(createInitialPropertyState());
    setFormChanged(false);
  };

  const handleUpdate = () => {
    // Placeholder for future API integration
    setFormChanged(false);
  };

  // Helper function to build navigation state from properties
  const buildNavigationState = (propertyId) => {
    // Sort properties by address (or use the same sorting logic as PropertiesList)
    const sortedProperties = [...mockProperties].sort((a, b) => {
      return a.address.localeCompare(b.address);
    });

    const propertyIndex = sortedProperties.findIndex(
      (property) => property.id === propertyId,
    );

    if (propertyIndex === -1) {
      // If property not found, return null
      return null;
    }

    return {
      currentIndex: propertyIndex + 1,
      totalItems: sortedProperties.length,
      visiblePropertyIds: sortedProperties.map((property) => property.id),
    };
  };

  return (
    <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 pt-1">
      {/* Navigation and Actions */}
      <div className="flex justify-between items-center mb-4">
        <button
          className="btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 mb-2 pl-0 focus:outline-none shadow-none"
          onClick={handleBackToProperties}
        >
          <svg
            className="fill-current shrink-0 mr-1"
            width="18"
            height="18"
            viewBox="0 0 18 18"
          >
            <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z"></path>
          </svg>
          <span className="text-lg">Properties</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
            onClick={handleNewProperty}
          >
            Add Property
          </button>
        </div>
      </div>

      <div className="flex justify-end mb-2">
        {/* Property Navigation */}
        <div className="flex items-center">
          {id &&
            id !== "new" &&
            (() => {
              // Use location.state if available, otherwise build from properties
              const navState = location.state || buildNavigationState(id);

              if (!navState) return null;

              return (
                <>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                    {navState.currentIndex || 1} / {navState.totalItems || 1}
                  </span>
                  <button
                    className="btn shadow-none p-1"
                    title="Previous"
                    onClick={() => {
                      if (
                        navState.visiblePropertyIds &&
                        navState.currentIndex > 1
                      ) {
                        const prevIndex = navState.currentIndex - 2;
                        const prevPropertyId =
                          navState.visiblePropertyIds[prevIndex];
                        const prevNavState =
                          buildNavigationState(prevPropertyId);
                        navigate(`/${accountUrl}/properties/${prevPropertyId}`, {
                          state: prevNavState || {
                            ...navState,
                            currentIndex: navState.currentIndex - 1,
                          },
                        });
                      }
                    }}
                    disabled={
                      !navState.currentIndex || navState.currentIndex <= 1
                    }
                  >
                    <svg
                      className={`fill-current shrink-0 ${
                        !navState.currentIndex || navState.currentIndex <= 1
                          ? "text-gray-200 dark:text-gray-700"
                          : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                      }`}
                      width="24"
                      height="24"
                      viewBox="0 0 18 18"
                    >
                      <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z"></path>
                    </svg>
                  </button>

                  <button
                    className="btn shadow-none p-1"
                    title="Next"
                    onClick={() => {
                      if (
                        navState.visiblePropertyIds &&
                        navState.currentIndex < navState.totalItems
                      ) {
                        const nextIndex = navState.currentIndex;
                        const nextPropertyId =
                          navState.visiblePropertyIds[nextIndex];
                        const nextNavState =
                          buildNavigationState(nextPropertyId);
                        navigate(`/${accountUrl}/properties/${nextPropertyId}`, {
                          state: nextNavState || {
                            ...navState,
                            currentIndex: navState.currentIndex + 1,
                          },
                        });
                      }
                    }}
                    disabled={
                      !navState.currentIndex ||
                      !navState.totalItems ||
                      navState.currentIndex >= navState.totalItems
                    }
                  >
                    <svg
                      className={`fill-current shrink-0 ${
                        !navState.currentIndex ||
                        !navState.totalItems ||
                        navState.currentIndex >= navState.totalItems
                          ? "text-gray-200 dark:text-gray-700"
                          : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                      }`}
                      width="24"
                      height="24"
                      viewBox="0 0 18 18"
                    >
                      <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z"></path>
                    </svg>
                  </button>
                </>
              );
            })()}
        </div>
      </div>

      <div className="space-y-8">
        {/* Property Passport Card */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Passport Header - Modern Sleek Design */}
          <div className="relative bg-gradient-to-br from-[#456564] via-[#3a5548] to-[#2a4241] px-6 py-5 overflow-hidden">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-5">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: "24px 24px",
                }}
              ></div>
            </div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#5a7a78] rounded-full border-2 border-[#2a4241]"></div>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white mb-0.5 tracking-tight">
                    Home Passport
                  </h2>
                  <p className="text-xs text-white/70 font-medium">
                    Digital Property Record
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-white/60 uppercase tracking-wider mb-1">
                    Health Score
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {propertyData.hpsScore || 92}/100
                  </div>
                </div>
                <CircularProgress
                  percentage={propertyData.hpsScore || 92}
                  size={80}
                  strokeWidth={6}
                />
              </div>
            </div>
          </div>

          {/* Passport Body */}
          <div className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Property Image */}
              <div className="w-full lg:w-2/5 flex-shrink-0">
                <div className="relative h-64 lg:h-80 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                  <img
                    src={propertyData.mainPhotoUrl || propertyData.mainPhoto}
                    alt={propertyData.address}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Property Information */}
              <div className="flex-1 space-y-6">
                {/* Property Identity */}
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Property Location
                        </span>
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1.5 leading-tight">
                        {propertyData.address}
                      </h1>
                      <p className="text-base text-gray-600 dark:text-gray-300 font-medium">
                        {propertyData.city}, {propertyData.state}{" "}
                        {propertyData.zip}
                      </p>
                    </div>
                  </div>

                  {/* Passport ID */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Passport ID
                      </span>
                    </div>
                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300 font-semibold">
                      {propertyData.id}
                    </p>
                  </div>
                </div>

                {/* Property Specifications */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Building className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Property Specifications
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bed className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Bedrooms
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {propertyData.rooms}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bath className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Bathrooms
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {propertyData.bathrooms || 3}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Ruler className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Square Feet
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {propertyData.squareFeet.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Year Built
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {propertyData.yearBuilt || 1995}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Property Value */}
                {propertyData.price && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
                          Estimated Value
                        </span>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency.format(propertyData.price)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* HomeOps Team */}
        <HomeOpsTeam
          teamMembers={propertyData.teamMembers}
          propertyId={propertyData.id}
          accountUrl={accountUrl}
        />

        {/* Property Health & Completeness */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Home Passport Health Status
          </h2>

          <div className="flex flex-col lg:flex-row gap-5 items-center lg:items-start">
            {/* Donut Chart */}
            <div className="flex-shrink-0">
              <DonutChart
                percentage={propertyData.hpsScore || 92}
                size={120}
                strokeWidth={10}
              />
            </div>

            {/* Detailed Checklist */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Documents Uploaded */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Documents Uploaded
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {propertyData.healthMetrics?.documentsUploaded.current ||
                        8}
                      /
                      {propertyData.healthMetrics?.documentsUploaded.total ||
                        10}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-400 dark:bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          ((propertyData.healthMetrics?.documentsUploaded
                            .current || 8) /
                            (propertyData.healthMetrics?.documentsUploaded
                              .total || 10)) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Systems Identified */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Systems Identified
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {propertyData.healthMetrics?.systemsIdentified.current ||
                        3}
                      /
                      {propertyData.healthMetrics?.systemsIdentified.total || 6}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-400 dark:bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          ((propertyData.healthMetrics?.systemsIdentified
                            .current || 3) /
                            (propertyData.healthMetrics?.systemsIdentified
                              .total || 6)) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Maintenance Profile Setup */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Maintenance Profile Setup
                    </span>
                    {propertyData.healthMetrics?.maintenanceProfileSetup
                      .complete ? (
                      <div
                        className="flex items-center gap-1.5"
                        style={{color: "#456654"}}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-semibold">Complete</span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Incomplete
                      </span>
                    )}
                  </div>
                  {propertyData.healthMetrics?.maintenanceProfileSetup
                    .complete && (
                    <div className="w-full bg-green-400 dark:bg-green-500 rounded-full h-2"></div>
                  )}
                </div>
              </div>

              {/* CTA Button */}
              <div className="mt-4">
                <button
                  className="btn text-white text-sm py-2 px-4 transition-colors"
                  style={{
                    backgroundColor: "#456654",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "#3a5548";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "#456654";
                  }}
                >
                  Complete Outstanding Tasks
                </button>
              </div>

              {/* Scorecard Section */}
              <ScoreCard propertyData={propertyData} />
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6">
            <nav className="flex flex-wrap gap-1">
              {tabs.map((tab) => {
                const icons = {
                  identity: FileText,
                  systems: Settings,
                  maintenance: Wrench,
                  documents: FileText,
                  media: ImageIcon,
                };
                const Icon = icons[tab.id] || FileText;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-4 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
                      activeTab === tab.id
                        ? "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                    style={
                      activeTab === tab.id
                        ? {
                            borderBottomColor: "#456654",
                            color: "#456654",
                          }
                        : {}
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="p-6">
            {activeTab === "identity" && (
              <IdentityTab
                propertyData={propertyData}
                handleInputChange={handleInputChange}
              />
            )}

            {activeTab === "systems" && (
              <SystemsTab
                propertyData={propertyData}
                handleInputChange={handleInputChange}
              />
            )}

            {activeTab === "maintenance" && (
              <MaintenanceTab propertyData={propertyData} />
            )}

            {activeTab === "media" && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Media Content
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {propertyData.photos.map((photo, index) => (
                      <div
                        key={photo}
                        className="relative overflow-hidden rounded-2xl h-48 bg-gray-100"
                      >
                        <img
                          src={photo}
                          alt={`Property photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "photos" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {propertyData.photos.map((photo, index) => (
                  <div
                    key={photo}
                    className="relative overflow-hidden rounded-2xl h-48 bg-gray-100"
                  >
                    <img
                      src={photo}
                      alt={`Property photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTab === "documents" && (
              <DocumentsTab propertyData={propertyData} />
            )}
          </div>

          {formChanged && (
            <div
              className={`${
                formChanged ? "sticky" : "hidden"
              } bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-2xl transition-all duration-200`}
            >
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
                  onClick={handleCancelChanges}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn text-white transition-colors duration-200 shadow-sm min-w-[100px] ${"bg-[#456564] hover:bg-[#34514f]"}`}
                  onClick={handleUpdate}
                >
                  Update Property
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default PropertyFormContainer;
