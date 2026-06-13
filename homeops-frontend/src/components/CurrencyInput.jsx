import React, {useCallback, useEffect, useRef, useState} from "react";
import {cn} from "../lib/utils";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseCurrencyInput(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function sanitizeCurrencyDraft(raw) {
  let text = String(raw ?? "").replace(/[^\d.]/g, "");
  const dotIndex = text.indexOf(".");
  if (dotIndex !== -1) {
    const whole = text.slice(0, dotIndex);
    const fraction = text.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2);
    text = `${whole}.${fraction}`;
  }
  return text;
}

function formatCurrencyLive(sanitized) {
  const cleaned = sanitizeCurrencyDraft(sanitized);
  if (!cleaned) return "";
  if (cleaned === ".") return "$0.";

  const [wholePart, fractionPart] = cleaned.split(".");
  const wholeDigits = wholePart.replace(/^0+(?=\d)/, "") || "0";
  const wholeFormatted = Number(wholeDigits).toLocaleString("en-US");

  if (fractionPart !== undefined) {
    return `$${wholeFormatted}.${fractionPart}`;
  }
  return `$${wholeFormatted}`;
}

function formatCurrencyFinal(value) {
  const parsed = parseCurrencyInput(value);
  return parsed != null ? currencyFormatter.format(parsed) : "";
}

function countDigitsBefore(str, index) {
  let count = 0;
  for (let i = 0; i < index && i < str.length; i++) {
    if (/\d/.test(str[i])) count++;
  }
  return count;
}

function digitIndexToCursor(formatted, digitIndex) {
  if (digitIndex <= 0) {
    return formatted.startsWith("$") ? 1 : 0;
  }
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      count++;
      if (count === digitIndex) return i + 1;
    }
  }
  return formatted.length;
}

/**
 * Currency text input with live USD formatting while typing.
 * Emits numeric strings via onChange (same shape as native inputs).
 */
function CurrencyInput({
  name,
  value,
  onChange,
  className = "form-input w-full",
  placeholder = "0.00",
  disabled = false,
  ...rest
}) {
  const inputRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(() => formatCurrencyFinal(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDisplayValue(formatCurrencyFinal(value));
    }
  }, [value, focused]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setDisplayValue(formatCurrencyLive(String(value ?? "")));
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseCurrencyInput(displayValue);
    const normalized = parsed != null ? String(parsed) : "";
    onChange?.({target: {name, value: normalized}});
    setDisplayValue(formatCurrencyFinal(normalized));
  }, [displayValue, name, onChange]);

  const handleChange = useCallback(
    (e) => {
      const input = e.target;
      const cursor = input.selectionStart ?? input.value.length;
      const digitsBefore = countDigitsBefore(input.value, cursor);

      const sanitized = sanitizeCurrencyDraft(input.value);
      const nextDisplay = formatCurrencyLive(sanitized);

      setDisplayValue(nextDisplay);
      onChange?.({target: {name, value: sanitized}});

      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        const nextCursor = digitIndexToCursor(nextDisplay, digitsBefore);
        el.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [name, onChange],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      name={name}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(className)}
      {...rest}
    />
  );
}

export default CurrencyInput;
