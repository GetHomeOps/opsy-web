import React from "react";
import {Search, X} from "lucide-react";

const DEFAULT_INPUT_CLASS =
  "form-input w-full pl-10 pr-9 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm text-sm";

function SearchIconSvg({className = "shrink-0 fill-current text-gray-400 dark:text-gray-500 ml-1"}) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M7 14c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zM7 2C4.243 2 2 4.243 2 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
      <path d="M15.707 14.293L13.314 11.9a8.019 8.019 0 01-1.414 1.414l2.393 2.393a.997.997 0 001.414 0 .999.999 0 000-1.414z" />
    </svg>
  );
}

function SearchInput({
  value = "",
  onChange,
  onClear,
  placeholder,
  className = "relative flex-1 min-w-0",
  inputClassName = DEFAULT_INPUT_CLASS,
  icon = "svg",
  clearAriaLabel = "Clear search",
  inputRef,
  rightSlot,
  ...inputProps
}) {
  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    onChange?.({target: {value: ""}});
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={inputClassName}
        {...inputProps}
      />
      {icon === "lucide" ? (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      ) : (
        <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
          <SearchIconSvg />
        </div>
      )}
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className={`absolute top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors ${
            rightSlot ? "right-9" : "right-3"
          }`}
          aria-label={clearAriaLabel}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {rightSlot ? (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
}

export default SearchInput;
