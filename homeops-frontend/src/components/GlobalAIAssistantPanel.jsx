import React, {useState, useEffect, useContext} from "react";
import {X, Sparkles} from "lucide-react";
import Transition from "../utils/Transition";
import PropertyContext from "../context/PropertyContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import AppApi from "../api/api";
import AIAssistantSidebar from "../pages/properties/partials/AIAssistantSidebar";
function GlobalAIAssistantPanel({isOpen, onClose}) {
  const {properties, refreshProperties, getSystemsByPropertyId} = useContext(PropertyContext);
  const {currentAccount} = useCurrentAccount();
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [systemContext, setSystemContext] = useState(null);
  const [propertySystems, setPropertySystems] = useState([]);

  useEffect(() => {
    if (isOpen && properties?.length === 0) {
      refreshProperties?.();
    }
  }, [isOpen, properties?.length, refreshProperties]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPropertyId(null);
      setSystemContext(null);
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
                <Sparkles className="w-5 h-5 text-[#456564]" />
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
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a property to chat with the AI assistant about maintenance
                and systems.
              </p>
              <div className="space-y-1">
                {(properties || []).map((p) => (
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
              </div>
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
