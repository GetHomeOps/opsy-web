import React, {useState, useEffect, useContext, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {X, ArrowUpCircle, Loader2, Search} from "lucide-react";
import opsyAiIcon from "../images/opsy_ai.png";
import Transition from "../utils/Transition";
import PropertyContext from "../context/PropertyContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import useBillingStatus from "../hooks/useBillingStatus";
import AIAssistantSidebar from "../pages/properties/partials/AIAssistantSidebar";

const FREE_PLAN_CODES = ["homeowner_free", "agent_free"];

function GlobalAIAssistantPanel({isOpen, onClose}) {
  const navigate = useNavigate();
  const {properties, refreshProperties, getSystemsByPropertyId} = useContext(PropertyContext);
  const {currentAccount} = useCurrentAccount();
  const {plan, loading: billingLoading, isAdmin} = useBillingStatus();

  const accountUrl = currentAccount?.url || "";
  const isPaidUser =
    isAdmin || (plan?.code && !FREE_PLAN_CODES.includes(plan.code));
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [systemContext, setSystemContext] = useState(null);
  const [propertySystems, setPropertySystems] = useState([]);
  const [propertySearch, setPropertySearch] = useState("");

  const filteredProperties = useMemo(() => {
    const list = properties || [];
    const q = propertySearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const label = (
        p.nickname ||
        p.address ||
        p.street_address ||
        ""
      ).toLowerCase();
      const idStr = String(p.property_uid ?? p.uid ?? p.id ?? "").toLowerCase();
      return label.includes(q) || idStr.includes(q);
    });
  }, [properties, propertySearch]);

  useEffect(() => {
    if (isOpen && properties?.length === 0) {
      refreshProperties?.();
    }
  }, [isOpen, properties?.length, refreshProperties]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPropertyId(null);
      setSystemContext(null);
      setPropertySearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPropertyId || !isOpen) {
      setSystemContext(null);
      setPropertySystems([]);
      return;
    }
    getSystemsByPropertyId?.(selectedPropertyId)
      .then((systemsRes) => {
        const systemsArr = systemsRes?.systems ?? (Array.isArray(systemsRes) ? systemsRes : []);
        setPropertySystems(systemsArr);
      })
      .catch(() => setPropertySystems([]));
    setSystemContext(null);
  }, [selectedPropertyId, isOpen, getSystemsByPropertyId]);

  return (
    <Transition
      show={isOpen}
      enter="transition ease-out duration-200"
      enterStart="opacity-0"
      enterEnd="opacity-100"
      leave="transition ease-in duration-150"
      leaveStart="opacity-100"
      leaveEnd="opacity-0"
    >
      <div className="fixed inset-y-0 right-0 w-full max-w-md h-screen bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col overflow-hidden">
        {!selectedPropertyId ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-2">
                <img
                  src={opsyAiIcon}
                  alt=""
                  className="w-5 h-5 object-contain shrink-0"
                />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  AI Assistant
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {billingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#456564] animate-spin" />
                </div>
              ) : !isPaidUser ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                    <ArrowUpCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    AI Assistant not included
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-xs">
                    Your plan does not include AI assistance. Upgrade to get AI-powered maintenance and property insights.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Not now
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(accountUrl ? `/${accountUrl}/settings/upgrade` : "/settings/upgrade");
                      }}
                      className="rounded-full px-4 py-2 text-sm font-medium bg-[#456564] text-white hover:bg-[#3a5554] dark:bg-teal-600 dark:hover:bg-teal-500"
                    >
                      Upgrade plan
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Select a property to chat with the AI assistant about maintenance
                    and systems.
                  </p>
                  <div className="relative mb-3">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      placeholder="Search properties..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564]"
                      aria-label="Search properties"
                    />
                  </div>
                  <div className="space-y-1">
                    {filteredProperties.map((p) => (
                      <button
                        key={p.property_uid ?? p.id ?? p.uid}
                        onClick={() => setSelectedPropertyId(p.property_uid ?? p.uid ?? p.id)}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                      >
                        {p.nickname || p.address || p.street_address || `Property ${p.id}`}
                      </button>
                    ))}
                    {(!properties || properties.length === 0) && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No properties found. Add a property first.
                      </p>
                    )}
                    {properties?.length > 0 && filteredProperties.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No properties match your search.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <AIAssistantSidebar
            isOpen={true}
            onClose={onClose}
            propertyId={selectedPropertyId}
            systemContext={systemContext}
            propertySystems={propertySystems}
            contacts={[]}
            embedded={true}
            onBack={() => setSelectedPropertyId(null)}
          />
        )}
      </div>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-[-1]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </Transition>
  );
}

export default GlobalAIAssistantPanel;
