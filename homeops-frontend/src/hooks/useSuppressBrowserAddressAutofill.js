import {useCallback, useRef, useState} from "react";

let suppressAutofillCounter = 0;

function nextSuppressAutofillSuffix() {
  suppressAutofillCounter += 1;
  return suppressAutofillCounter.toString(36);
}

/**
 * Browser autofill (especially Chrome) can ignore `autoComplete="off"` and
 * overlay a native suggestions panel above custom dropdowns. This hook applies
 * a stronger suppression strategy for search/email-like inputs.
 */
function useSuppressBrowserAddressAutofill(fieldName = "search") {
  const generatedNameRef = useRef(
    `${fieldName}-${nextSuppressAutofillSuffix()}`,
  );
  const [readOnly, setReadOnly] = useState(true);

  const bindInput = useCallback(
    (inputProps = {}) => {
      const {onFocus, onBlur, name, autoComplete, ...restInputProps} =
        inputProps;

      return {
        ...restInputProps,
        name: name || generatedNameRef.current,
        autoComplete: autoComplete || "new-password",
        readOnly,
        "data-lpignore": "true",
        "data-1p-ignore": "true",
        onFocus: (event) => {
          if (readOnly) setReadOnly(false);
          onFocus?.(event);
        },
        onBlur: (event) => {
          setReadOnly(true);
          onBlur?.(event);
        },
      };
    },
    [readOnly],
  );

  return bindInput;
}

export default useSuppressBrowserAddressAutofill;
