import React from "react";
import DatePickerInput from "../../../../components/DatePickerInput";
import InstallerSelect from "../InstallerSelect";
import Tooltip from "../../../../utils/Tooltip";
import { Info } from "lucide-react";

/**
 * Renders a single system form field for the detail overview cards.
 */
export function SystemEditableField({
  fieldName,
  definition,
  propertyData,
  handleInputChange,
  contacts,
  disabled = false,
}) {
  const value = propertyData?.[fieldName] ?? "";
  const label = definition?.label ?? fieldName;

  const labelEl = (
    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
      {label}
      {definition?.disableWhenNewInstall && (
        <>
          {" "}
          <Tooltip content="Disabled when marked as new installation" position="right">
            <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
          </Tooltip>
        </>
      )}
    </label>
  );

  if (definition?.type === "select") {
    return (
      <div className={definition.fullWidth ? "md:col-span-2" : ""}>
        {labelEl}
        <select
          name={fieldName}
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          className="form-select w-full"
        >
          <option value="">
            {fieldName.includes("Condition") ? "Select condition" : "Select…"}
          </option>
          {(definition.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (definition?.type === "warranty-select") {
    return (
      <div>
        {labelEl}
        <select
          name={fieldName}
          value={value}
          onChange={handleInputChange}
          className="form-select w-full"
        >
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
    );
  }

  if (definition?.type === "date") {
    return (
      <div>
        {labelEl}
        <DatePickerInput
          name={fieldName}
          value={value}
          onChange={handleInputChange}
          disabled={disabled && definition.disableWhenNewInstall}
        />
      </div>
    );
  }

  if (definition?.type === "installer") {
    return (
      <div>
        {labelEl}
        <InstallerSelect
          name={fieldName}
          value={value}
          onChange={handleInputChange}
          contacts={contacts}
        />
      </div>
    );
  }

  if (definition?.type === "textarea") {
    return (
      <div className="md:col-span-2">
        {labelEl}
        <textarea
          name={fieldName}
          value={value}
          onChange={handleInputChange}
          className="form-input w-full min-h-[80px]"
        />
      </div>
    );
  }

  return (
    <div className={definition?.fullWidth ? "md:col-span-2" : ""}>
      {labelEl}
      <input
        type="text"
        name={fieldName}
        value={value}
        onChange={handleInputChange}
        className="form-input w-full"
      />
    </div>
  );
}
