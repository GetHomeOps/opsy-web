import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpCircle, X } from "lucide-react";
import { onTierLimit } from "../utils/tierLimitNotifier";

const AUTO_DISMISS_MS = 8000;

export default function TierLimitBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    return onTierLimit(({ message: msg }) => {
      setMessage(msg || "You've reached a limit on your current plan.");
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    });
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg px-4 transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-3 pointer-events-none"
      }`}
    >
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-gray-900/90 dark:bg-black/85 backdrop-blur-md shadow-2xl px-4 py-3">
        <ArrowUpCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            Plan limit reached
          </p>
          <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
            {message}
          </p>
          <button
            type="button"
            onClick={() => {
              dismiss();
              navigate("settings/upgrade");
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-gray-700/80 hover:bg-gray-600/90 text-gray-200 transition-colors"
          >
            Upgrade plan &rarr;
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-gray-500 hover:text-gray-300 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
