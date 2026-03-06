import React, {useState, useRef, useEffect} from "react";
import {ChevronDown, ExternalLink, X} from "lucide-react";

function SelectDropdown({
  options = [],
  value = "",
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  name = "",
  id = "",
  required = false,
  error = false,
  linkTarget = "_blank", // Where to open links
  showLinkIcon = true, // Whether to show link icon for link options
  clearable = true, // Whether to show clear button when option is selected
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const dropdownRef = useRef(null);

  // Helper function to get option value and label
  const getOptionValue = (option) => {
    return option.value !== undefined ? option.value : option.id;
  };

  const getOptionLabel = (option) => {
    return option.label !== undefined ? option.label : option.name;
  };

  // Find the selected option based on value
  useEffect(() => {
    const option = options.find((opt) => getOptionValue(opt) === value);
    setSelectedOption(option || null);
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option) => {
    if (option.link) {
      // If it's a link option, open the link and don't update the form value
      window.open(option.link, linkTarget);
      setIsOpen(false);
      return;
    }

    // Regular option selection
    setSelectedOption(option);
    onChange?.(getOptionValue(option));
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation(); // Prevent dropdown from opening
    setSelectedOption(null);
    onChange?.(""); // Pass empty string to clear the selection
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(!isOpen);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Match exact height of native select elements
  const baseClasses = "form-select w-full relative cursor-pointer py-2 px-3";
  const errorClasses = error
    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
    : "";
  const disabledClasses = disabled
    ? "bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed opacity-75"
    : "";
  const focusClasses = isOpen ? "border-gray-300 dark:border-gray-600" : "";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`${baseClasses} ${errorClasses} ${disabledClasses} ${focusClasses}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={id}
      >
        <div className="flex items-center justify-between h-full">
          <span
            className={`block truncate text-sm leading-5 ${
              !selectedOption ? "text-gray-400 dark:text-gray-500" : ""
            }`}
          >
            {selectedOption ? getOptionLabel(selectedOption) : placeholder}
          </span>
        </div>

        {/* Clear button (only show when option is selected and clearable is true) */}
        {selectedOption && clearable && !disabled && (
          <button
            type="button"
            className="absolute inset-y-0 right-8 flex items-center pr-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
            onClick={handleClear}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
        )}

        {/* Arrow positioned exactly like native select */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Hidden select for form compatibility */}
      <select
        name={name}
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="sr-only"
        required={required}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={getOptionValue(option)} value={getOptionValue(option)}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-2xl max-h-35 overflow-auto">
          <ul className="py-1" role="listbox">
            {options.map((option, index) => (
              <li
                key={getOptionValue(option)}
                className={`
                  relative cursor-pointer select-none py-2 px-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm pl-8
                  ${
                    selectedOption &&
                    getOptionValue(selectedOption) === getOptionValue(option)
                      ? "text-violet-500"
                      : "text-gray-900 dark:text-gray-100"
                  }
                  ${option.link ? "flex items-center justify-between" : ""}
                `}
                onClick={() => handleOptionClick(option)}
                role="option"
                aria-selected={
                  selectedOption &&
                  getOptionValue(selectedOption) === getOptionValue(option)
                }
              >
                <span
                  className={`block truncate ${
                    option.link
                      ? "text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                      : ""
                  }`}
                >
                  {getOptionLabel(option)}
                </span>
                {option.link && showLinkIcon && (
                  <ExternalLink className="h-4 w-4 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 ml-2 shrink-0" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error message */}
      {error && <div className="mt-1 text-sm text-red-500">{error}</div>}
    </div>
  );
}

export default SelectDropdown;
