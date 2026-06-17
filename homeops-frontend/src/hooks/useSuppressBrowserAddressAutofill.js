import {useCallback, useRef, useState} from "react";

let suppressAutofillCounter = 0;

function nextSuppressAutofillSuffix() {
  suppressAutofillCounter += 1;
  return suppressAutofillCounter.toString(36);
}

/** Touch-first devices: skip the readOnly lock (breaks virtual keyboards on iOS + Android). */
function prefersTouchInput() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

/**
 * Browser autofill (especially Chrome) can ignore `autoComplete="off"` and
 * overlay a native suggestions panel above custom dropdowns. This hook applies
 * a stronger suppression strategy for search/email-like inputs.
 *
 * On touch devices the readOnly toggle is skipped entirely — mobile browsers
 * won't open the keyboard if the field is readonly when tapped, and React
 * re-renders can re-apply readonly before the keyboard appears.
 */
function useSuppressBrowserAddressAutofill(fieldName = "search") {
  const generatedNameRef = useRef(
    `${fieldName}-${nextSuppressAutofillSuffix()}`,
  );
  const skipReadOnlyLockRef = useRef(null);
  if (skipReadOnlyLockRef.current === null) {
    skipReadOnlyLockRef.current = prefersTouchInput();
  }
  const skipReadOnlyLock = skipReadOnlyLockRef.current;

  const [readOnly, setReadOnly] = useState(() => !skipReadOnlyLock);
  const readOnlyRef = useRef(!skipReadOnlyLock);

  const unlockForEditing = useCallback((input) => {
    if (!readOnlyRef.current) return false;
    readOnlyRef.current = false;
    if (input) input.readOnly = false;
    setReadOnly(false);
    return true;
  }, []);

  const lockForAutofillSuppression = useCallback((input) => {
    readOnlyRef.current = true;
    if (input) input.readOnly = true;
    setReadOnly(true);
  }, []);

  const bindInput = useCallback(
    (inputProps = {}) => {
      const {
        onFocus,
        onBlur,
        onPointerDown,
        onTouchStart,
        name,
        autoComplete,
        ...restInputProps
      } = inputProps;

      const baseProps = {
        ...restInputProps,
        name: name || generatedNameRef.current,
        autoComplete:
          autoComplete || (skipReadOnlyLock ? "off" : "new-password"),
        "data-lpignore": "true",
        "data-1p-ignore": "true",
      };

      if (skipReadOnlyLock) {
        return {
          ...baseProps,
          onFocus,
          onBlur,
          onPointerDown,
          onTouchStart,
        };
      }

      return {
        ...baseProps,
        readOnly,
        onPointerDown: (event) => {
          unlockForEditing(event.currentTarget);
          onPointerDown?.(event);
        },
        onTouchStart: (event) => {
          unlockForEditing(event.currentTarget);
          onTouchStart?.(event);
        },
        onFocus: (event) => {
          const input = event.currentTarget;
          const wasLocked = unlockForEditing(input);
          onFocus?.(event);
          if (wasLocked) {
            requestAnimationFrame(() => {
              input.focus({preventScroll: true});
            });
          }
        },
        onBlur: (event) => {
          lockForAutofillSuppression(event.currentTarget);
          onBlur?.(event);
        },
      };
    },
    [readOnly, lockForAutofillSuppression, skipReadOnlyLock, unlockForEditing],
  );

  return bindInput;
}

export default useSuppressBrowserAddressAutofill;
