import React from "react";
import { FileCheck } from "lucide-react";
import SectionCard from "../passport/SectionCard";
import DatePickerInput from "../../../../components/DatePickerInput";
import { INSPECTION_TOGGLE_FIELDS } from "../../constants/systemFieldConfig";

/**
 * Inspections system — yes/no toggles with optional date and link fields.
 */
export function SystemInspectionsFormCards({ propertyData, handleInputChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard flat title="Property Inspections" icon={FileCheck} className="md:col-span-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INSPECTION_TOGGLE_FIELDS.map(({ toggle, date, link, label }) => (
            <div key={toggle}>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                {label}
              </label>
              <div className="flex gap-3 items-center flex-wrap">
                <select
                  name={toggle}
                  value={propertyData?.[toggle] || ""}
                  onChange={handleInputChange}
                  className="form-select w-24"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {propertyData?.[toggle] === "yes" && (
                  <>
                    <DatePickerInput
                      name={date}
                      value={propertyData?.[date] || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1 min-w-[8rem]"
                      placeholder="Date"
                    />
                    <input
                      type="text"
                      name={link}
                      value={propertyData?.[link] || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1 min-w-[8rem]"
                      placeholder="Upload link"
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
