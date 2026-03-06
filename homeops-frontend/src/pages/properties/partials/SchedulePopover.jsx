import React, {useState} from "react";
import {Calendar, X, CheckCircle2} from "lucide-react";
import DatePickerInput from "../../../components/DatePickerInput";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";

function SchedulePopover({
  isOpen,
  onOpenChange,
  trigger,
  systemLabel,
  onSchedule,
}) {
  const [inspectionDate, setInspectionDate] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSchedule = () => {
    if (inspectionDate && onSchedule) {
      onSchedule(inspectionDate);
      setShowSuccess(true);
      setInspectionDate("");
      setTimeout(() => {
        setShowSuccess(false);
        onOpenChange?.(false);
      }, 1200);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="w-72 p-0 rounded-xl border-gray-200/80 dark:border-gray-700"
        style={{
          boxShadow:
            "0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 4px 16px -4px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="p-4 relative">
          {/* Success overlay with animation */}
          {showSuccess && (
            <>
              <style>{`
                @keyframes schedulePopoverFadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                @keyframes schedulePopoverScaleIn {
                  from { opacity: 0; transform: scale(0.85); }
                  to { opacity: 1; transform: scale(1); }
                }
              `}</style>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-800/95 rounded-xl z-10"
                style={{
                  animation: "schedulePopoverFadeIn 0.2s ease-out forwards",
                }}
              >
                <div
                  className="flex flex-col items-center gap-2"
                  style={{
                    animation:
                      "schedulePopoverScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s forwards",
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Inspection scheduled!
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-200 dark:bg-emerald-700/60 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-emerald-800 dark:text-emerald-100" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Schedule Inspection
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {systemLabel}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange?.(false)}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Next Inspection Date
            </label>
            <DatePickerInput
              name="inspectionDate"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              showOffsetControl
            />
          </div>

          {/* Action */}
          <button
            onClick={handleSchedule}
            disabled={!inspectionDate}
            className="w-full py-2 rounded-lg text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Schedule
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default SchedulePopover;
