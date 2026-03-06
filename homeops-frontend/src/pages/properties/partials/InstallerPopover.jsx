import React from "react";
import {User, Mail, Phone, MapPin, X} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";

function InstallerPopover({installer, isOpen, onOpenChange, trigger}) {
  if (!installer) return trigger;

  const initials = (installer.name || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="w-72 p-0 rounded-xl border-gray-200/80 dark:border-gray-700"
        style={{
          boxShadow:
            "0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 4px 16px -4px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="p-4">
          {/* Header with gradient accent */}
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #456654 0%, #5a8a6a 100%)",
              }}
            >
              {installer.image ? (
                <img
                  src={installer.image}
                  alt={installer.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                initials || <User className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {installer.name || "Unknown"}
              </h4>
              {installer.job_position && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {installer.job_position}
                </p>
              )}
            </div>
            <button
              onClick={() => onOpenChange?.(false)}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contact details */}
          <div className="space-y-2.5">
            {installer.email && (
              <a
                href={`mailto:${installer.email}`}
                className="flex items-center gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  {installer.email}
                </span>
              </a>
            )}
            {installer.phone && (
              <a
                href={`tel:${installer.phone}`}
                className="flex items-center gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  {installer.phone}
                </span>
              </a>
            )}
            {(installer.street1 || installer.city) && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {[installer.street1, installer.city, installer.state]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
          </div>

          {!installer.email && !installer.phone && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
              No contact information available
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default InstallerPopover;
