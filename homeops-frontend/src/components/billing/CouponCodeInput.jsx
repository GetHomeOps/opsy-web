import React, { useState, useCallback } from "react";
import { Tag, X, Loader2, CheckCircle2 } from "lucide-react";
import AppApi from "../../api/api";

/**
 * Collapsible coupon code input with validation and discount preview.
 *
 * Props:
 *  - planCode: string — the plan code to validate against
 *  - onCouponApplied: (coupon | null) => void — called when coupon is applied or cleared
 *  - className: optional wrapper class
 */
function CouponCodeInput({ planCode, onCouponApplied, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const handleApply = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setIsValidating(true);
    setError("");

    try {
      const result = await AppApi.validateCoupon(trimmed, planCode);
      if (result.valid) {
        setAppliedCoupon(result.coupon);
        onCouponApplied?.(result.coupon);
      } else {
        setError(result.reason || "Invalid coupon code.");
        setAppliedCoupon(null);
        onCouponApplied?.(null);
      }
    } catch (err) {
      setError(err.message || "Could not validate coupon.");
      setAppliedCoupon(null);
      onCouponApplied?.(null);
    } finally {
      setIsValidating(false);
    }
  }, [code, planCode, onCouponApplied]);

  function handleRemove() {
    setCode("");
    setAppliedCoupon(null);
    setError("");
    onCouponApplied?.(null);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  }

  function formatDiscount(coupon) {
    const val = Number(coupon.discountValue);
    const amount = coupon.discountType === "percent"
      ? `${val}% off`
      : `$${val % 1 === 0 ? val : val.toFixed(2)} off`;

    if (coupon.duration === "once") return `${amount} (first invoice)`;
    if (coupon.duration === "forever") return `${amount} (forever)`;
    if (coupon.duration === "repeating") return `${amount} for ${coupon.durationInMonths} months`;
    return amount;
  }

  if (appliedCoupon) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-green-800 dark:text-green-200 text-sm tracking-wide">
                {appliedCoupon.code}
              </span>
              {appliedCoupon.name && (
                <span className="text-green-600 dark:text-green-400 text-xs">
                  — {appliedCoupon.name}
                </span>
              )}
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
              {formatDiscount(appliedCoupon)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-800/40 text-green-500 transition-colors"
            title="Remove coupon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        >
          <Tag className="w-4 h-4" />
          Have a coupon code?
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter coupon code"
              className="form-input flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 rounded-lg text-sm font-mono uppercase tracking-wider"
              autoFocus
              disabled={isValidating}
              maxLength={50}
            />
            <button
              type="button"
              onClick={handleApply}
              disabled={isValidating || !code.trim()}
              className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white text-sm disabled:opacity-50"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setCode("");
                setError("");
              }}
              className="btn border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 text-sm"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default CouponCodeInput;
