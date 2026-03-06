import React, {useState} from "react";
import SelectDropdown from "./SelectDropdown";

function SelectDropdownExample() {
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedPaymentTerm, setSelectedPaymentTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

  // Example options with some having links
  const countryOptions = [
    {value: "usa", label: "United States"},
    {value: "canada", label: "Canada"},
    {value: "uk", label: "United Kingdom"},
    {value: "germany", label: "Germany"},
    {value: "france", label: "France"},
    {
      value: "more_countries",
      label: "View more countries...",
      link: "https://example.com/countries",
    },
  ];

  const paymentTermOptions = [
    {value: "net30", label: "Net 30"},
    {value: "net60", label: "Net 60"},
    {value: "net90", label: "Net 90"},
    {value: "immediate", label: "Immediate"},
    {
      value: "custom_terms",
      label: "Custom payment terms",
      link: "/settings/payment-terms",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        SelectDropdown Component Examples
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Country Selection (Clearable)
          </label>
          <SelectDropdown
            options={countryOptions}
            value={selectedValue}
            onChange={setSelectedValue}
            placeholder="Select a country"
            name="country"
            id="country-select"
            clearable={true}
          />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Selected: {selectedValue || "None"}
            {selectedValue && (
              <span className="ml-2 text-gray-500">(Click the X to clear)</span>
            )}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Payment Terms (Required - No Clear)
          </label>
          <SelectDropdown
            options={paymentTermOptions}
            value={selectedPaymentTerm}
            onChange={setSelectedPaymentTerm}
            placeholder="Select payment terms"
            name="paymentTerms"
            id="payment-terms-select"
            required
            clearable={false}
          />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Selected: {selectedPaymentTerm || "None"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Optional Country (Clearable)
          </label>
          <SelectDropdown
            options={countryOptions}
            value={selectedCountry}
            onChange={setSelectedCountry}
            placeholder="Select a country (optional)"
            name="optionalCountry"
            id="optional-country-select"
            clearable={true}
          />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Selected: {selectedCountry || "None"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Disabled Dropdown
          </label>
          <SelectDropdown
            options={countryOptions}
            value=""
            onChange={() => {}}
            placeholder="This dropdown is disabled"
            disabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Dropdown with Error
          </label>
          <SelectDropdown
            options={countryOptions}
            value=""
            onChange={() => {}}
            placeholder="This dropdown has an error"
            error="This field is required"
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
          Key Features:
        </h2>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>• Looks exactly like a native select input</li>
          <li>• No empty option required - uses placeholder instead</li>
          <li>• Supports links that open in new tabs when clicked</li>
          <li>• Clear button (X) to deselect options when clearable=true</li>
          <li>• Matches text-sm size of native select elements</li>
          <li>• Fully accessible with keyboard navigation</li>
          <li>• Form compatible with hidden native select</li>
          <li>• Error state support</li>
          <li>• Disabled state support</li>
          <li>• Dark mode support</li>
        </ul>
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="text-md font-semibold mb-2 text-blue-800 dark:text-blue-200">
          How to Manage Optional Selection:
        </h3>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p>
            <strong>For Required Fields:</strong> Set{" "}
            <code>clearable={false}</code> and <code>required={true}</code>
          </p>
          <p>
            <strong>For Optional Fields:</strong> Set{" "}
            <code>clearable={true}</code> and handle empty string values in your
            form validation
          </p>
          <p>
            <strong>State Management:</strong> The component passes empty string{" "}
            <code>""</code> when cleared, so you can check{" "}
            <code>if (value === "")</code> in your validation
          </p>
        </div>
      </div>
    </div>
  );
}

export default SelectDropdownExample;
