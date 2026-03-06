import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || "";
const DEBOUNCE_MS = 300;

/**
 * Parses address components from the new Place class format (addressComponents with longText/shortText).
 * Used when fetching place details via place.fetchFields({ fields: ['addressComponents'] }).
 *
 * @param {Object} place - Place object from the new API
 * @param {string} place.formattedAddress - Full formatted address
 * @param {Array} place.addressComponents - Array of { types, longText, shortText }
 * @returns {{ addressLine1, addressLine2, city, state, zip, county, formattedAddress }}
 */
export function parseAddressFromPlace(place) {
  const result = {
    streetNumber: "",
    route: "",
    city: "",
    state: "",
    zip: "",
    county: "",
    formattedAddress: place.formattedAddress || "",
  };

  const components = place.addressComponents || [];
  for (const component of components) {
    const types = component.types || [];
    const longText = component.longText ?? component.long_name ?? "";
    const shortText = component.shortText ?? component.short_name ?? "";

    if (types.includes("street_number")) {
      result.streetNumber = longText;
    } else if (types.includes("route")) {
      result.route = longText;
    } else if (types.includes("locality")) {
      result.city = longText;
    } else if (types.includes("administrative_area_level_2")) {
      result.county = longText.replace(/ County$/i, "");
    } else if (types.includes("administrative_area_level_1")) {
      result.state = shortText;
    } else if (types.includes("postal_code")) {
      result.zip = longText;
    } else if (types.includes("country")) {
      result.country = shortText;
    } else if (types.includes("subpremise")) {
      result.subpremise = longText;
    }
  }

  const addressLine1 = [result.streetNumber, result.route]
    .filter(Boolean)
    .join(" ");

  return {
    addressLine1,
    addressLine2: result.subpremise || "",
    city: result.city,
    state: result.state,
    zip: result.zip,
    county: result.county,
    formattedAddress: result.formattedAddress,
  };
}

let loaderInitialized = false;

function ensureLoader() {
  if (loaderInitialized) return;
  setOptions({
    key: API_KEY,
    v: "weekly",
  });
  loaderInitialized = true;
}

/**
 * Hook that provides Google Places Autocomplete using the new Autocomplete Data API
 * (AutocompleteSuggestion.fetchAutocompleteSuggestions) instead of the legacy
 * google.maps.places.Autocomplete widget.
 *
 * Keeps the existing input element and renders a custom dropdown that matches
 * the legacy .pac-container styling. No UI/UX changes from the user's perspective.
 *
 * @param {Object} options
 * @param {Function} options.onPlaceSelected - callback with parsed address fields
 * @param {string[]} options.includedPrimaryTypes - place types (default: ["street_address"])
 * @param {string[]} options.includedRegionCodes - country codes (default: ["us"])
 * @returns {{ inputRef, isLoaded, error, AutocompleteWrapper }}
 */
export default function useGooglePlacesAutocomplete({
  onPlaceSelected,
  includedPrimaryTypes = ["street_address"],
  includedRegionCodes = ["us"],
} = {}) {
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const callbackRef = useRef(onPlaceSelected);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [inputElement, setInputElement] = useState(null);
  const sessionTokenRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const suggestionsRef = useRef([]);
  const highlightedIndexRef = useRef(-1);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const dropdownPositionRef = useRef(null);

  callbackRef.current = onPlaceSelected;
  dropdownPositionRef.current = dropdownPosition;
  suggestionsRef.current = suggestions;
  highlightedIndexRef.current = highlightedIndex;

  const inputRefCallback = useCallback((node) => {
    inputRef.current = node;
    setInputElement(node);
  }, []);

  useEffect(() => {
    if (!API_KEY) {
      setError("Google Places API key not configured");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        ensureLoader();
        await importLibrary("places");
        if (!cancelled) setIsLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load Google Maps");
          console.warn(
            "[useGooglePlacesAutocomplete] Google Maps failed to load:",
            err?.message
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSuggestions = useCallback(
    async (input) => {
      if (!input?.trim() || !window.google?.maps?.places) return;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } =
          await importLibrary("places");

        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const request = {
          input: input.trim(),
          sessionToken: sessionTokenRef.current,
          includedPrimaryTypes,
          includedRegionCodes,
          language: "en-US",
          region: "us",
        };

        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        setSuggestions(results || []);
        setHighlightedIndex(-1);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.warn(
          "[useGooglePlacesAutocomplete] fetchAutocompleteSuggestions failed:",
          err?.message
        );
        setSuggestions([]);
      }
    },
    [includedPrimaryTypes, includedRegionCodes]
  );

  const selectSuggestion = useCallback(
    async (suggestion) => {
      if (!suggestion?.placePrediction) return;

      const inputEl = inputRef.current;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: [
            "formattedAddress",
            "addressComponents",
            "location",
            "viewport",
          ],
        });

        const parsed = parseAddressFromPlace(place);
        callbackRef.current?.(parsed);

        if (inputEl) {
          inputEl.value = parsed.formattedAddress;
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        }

        sessionTokenRef.current = null;
        setSuggestions([]);
        setHighlightedIndex(-1);
      } catch (err) {
        console.warn(
          "[useGooglePlacesAutocomplete] Failed to fetch place details:",
          err?.message
        );
      }
    },
    []
  );

  useEffect(() => {
    if (!inputElement || !isLoaded) return;

    const handleInput = (e) => {
      const value = e.target.value;
      clearTimeout(debounceTimerRef.current);
      if (!value.trim()) {
        setSuggestions([]);
        return;
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, DEBOUNCE_MS);
    };

    const handleKeyDown = (e) => {
      const currentSuggestions = suggestionsRef.current;
      const currentHighlighted = highlightedIndexRef.current;
      if (currentSuggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) =>
          i < currentSuggestions.length - 1 ? i + 1 : i
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : -1));
      } else if (e.key === "Enter" && currentHighlighted >= 0) {
        e.preventDefault();
        selectSuggestion(currentSuggestions[currentHighlighted]);
      } else if (e.key === "Escape") {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    };

    const handleBlur = () => {
      setTimeout(() => {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }, 200);
    };

    inputElement.addEventListener("input", handleInput);
    inputElement.addEventListener("keydown", handleKeyDown);
    inputElement.addEventListener("blur", handleBlur);

    return () => {
      inputElement.removeEventListener("input", handleInput);
      inputElement.removeEventListener("keydown", handleKeyDown);
      inputElement.removeEventListener("blur", handleBlur);
      clearTimeout(debounceTimerRef.current);
    };
  }, [inputElement, isLoaded, fetchSuggestions, selectSuggestion]);

  const updateDropdownPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el || suggestionsRef.current.length === 0) return;
    const rect = el.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (suggestionsRef.current.length === 0) {
      setDropdownPosition(null);
      return;
    }
    updateDropdownPosition();
    const scrollParent = inputRef.current?.closest?.(".overflow-auto");
    const handleScrollOrResize = () => updateDropdownPosition();
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    if (scrollParent) {
      scrollParent.addEventListener("scroll", handleScrollOrResize);
    }
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      scrollParent?.removeEventListener("scroll", handleScrollOrResize);
    };
  }, [suggestions, updateDropdownPosition]);

  const AutocompleteWrapper = useCallback(
    ({ children }) => {
      const currentSuggestions = suggestionsRef.current;
      const currentHighlighted = highlightedIndexRef.current;
      const pos = dropdownPositionRef.current;
      const showDropdown = currentSuggestions.length > 0 && pos !== null;

      const dropdown =
        showDropdown &&
        createPortal(
          <ul
            className="places-autocomplete-dropdown places-autocomplete-dropdown-portal"
            role="listbox"
            aria-label="Address suggestions"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
            }}
          >
            {currentSuggestions.map((suggestion, i) => {
              const pred = suggestion.placePrediction;
              const text =
                pred?.text?.toString?.() ?? String(pred?.text ?? "");
              return (
                <li
                  key={i}
                  role="option"
                  aria-selected={i === currentHighlighted}
                  className={`places-autocomplete-item ${
                    i === currentHighlighted
                      ? "places-autocomplete-item-active"
                      : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  {text}
                </li>
              );
            })}
          </ul>,
          document.body
        );

      return (
        <div ref={containerRef} className="relative">
          {children}
          {dropdown}
        </div>
      );
    },
    [selectSuggestion]
  );

  return {
    inputRef: inputRefCallback,
    isLoaded,
    error,
    AutocompleteWrapper,
  };
}
