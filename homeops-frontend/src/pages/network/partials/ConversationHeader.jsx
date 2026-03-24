import React from "react";
import {useParams, Link} from "react-router-dom";
import {MapPin, ArrowLeft} from "lucide-react";

function ConversationHeader({
  conversation,
  msgSidebarOpen,
  setMsgSidebarOpen,
  forHomeowner = false,
}) {
  const {accountUrl} = useParams();
  const conv = conversation;
  const primaryName = forHomeowner
    ? conv.agentName || "Agent"
    : conv.homeownerName || "Homeowner";
  const primaryInitial = (primaryName || "?").charAt(0).toUpperCase();

  return (
    <div className="sticky top-16">
      <div className="flex items-center justify-between before:absolute before:inset-0 before:backdrop-blur-md before:bg-gray-50/90 dark:before:bg-[#151D2C]/90 before:-z-10 border-b border-gray-200 dark:border-gray-700/60 px-4 sm:px-6 md:px-5 h-16">
        <div className="flex items-center gap-3">
          {/* Back button (mobile) */}
          <button
            className="md:hidden text-gray-400 hover:text-gray-500"
            onClick={() => setMsgSidebarOpen(!msgSidebarOpen)}
            aria-controls="messages-sidebar"
            aria-expanded={msgSidebarOpen}
          >
            <span className="sr-only">Open sidebar</span>
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#456564] to-[#6fb5b4] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">
              {primaryInitial}
            </span>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {primaryName}
            </h2>
            <div className="flex items-center gap-2">
              {conv.address && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{conv.address}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conv.propertyUid && (
            <Link
              to={`/${accountUrl}/properties/${conv.propertyUid}`}
              className="text-xs font-medium text-[#456564] dark:text-[#6fb5b4] hover:underline"
            >
              View property
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversationHeader;
