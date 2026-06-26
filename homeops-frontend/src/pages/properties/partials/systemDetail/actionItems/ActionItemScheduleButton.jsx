import React from "react";
import { Calendar } from "lucide-react";

export default function ActionItemScheduleButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#456564] hover:bg-[#34514f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium shadow-sm transition-colors whitespace-nowrap"
      title="Schedule maintenance for this item"
    >
      <Calendar className="w-3.5 h-3.5" />
      Schedule
    </button>
  );
}
