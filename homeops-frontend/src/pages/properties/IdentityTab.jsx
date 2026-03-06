import React from "react";
import {
  Home,
  User,
  Building2,
  Ruler,
  Bed,
  Flame,
  School,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import {usStates} from "../../data/states";
import {
  IDENTITY_SECTIONS,
  getSectionProgress,
} from "./constants/identitySections";
import Tooltip from "../../utils/Tooltip";

// Stable subcomponents; defined at module level so inputs don't remount on every keystroke.
function Field({
  label,
  name,
  value,
  placeholder,
  type = "text",
  inputClassName = "form-input w-full",
  onChange,
  required = false,
  error,
  inputRef,
  hint,
  infoTooltip,
  uncontrolled = false,
  readOnly = false,
}) {
  const errorClasses = error
    ? "border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500 dark:focus:border-red-500 dark:focus:ring-red-500"
    : "";
  const readOnlyClasses = readOnly
    ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed"
    : "";
  const inputProps = uncontrolled
    ? {defaultValue: value ?? "", autoComplete: "off"}
    : {value: value ?? "", onChange: readOnly ? undefined : onChange};

  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {infoTooltip && (
          <Tooltip content={infoTooltip} position="top">
            <Info className="w-4 h-4 ml-0.5 inline-block align-middle text-gray-400 dark:text-gray-500 cursor-help" />
          </Tooltip>
        )}
        {hint && (
          <span className="ml-2 text-emerald-500 text-[10px] font-normal">
            {hint}
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        type={type}
        name={name}
        placeholder={placeholder}
        className={`${inputClassName} ${errorClasses} ${readOnlyClasses}`}
        required={required}
        readOnly={readOnly}
        {...inputProps}
      />
      {error && (
        <div className="mt-1 flex items-center text-sm text-red-500">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  onChange,
  required = false,
  error,
  infoTooltip,
  readOnly = false,
}) {
  const errorClasses = error
    ? "border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500 dark:focus:border-red-500 dark:focus:ring-red-500"
    : "";
  const readOnlyClasses = readOnly
    ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed"
    : "";

  if (readOnly) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
          {infoTooltip && (
            <Tooltip content={infoTooltip} position="top">
              <Info className="w-4 h-4 ml-0.5 inline-block align-middle text-gray-400 dark:text-gray-500 cursor-help" />
            </Tooltip>
          )}
        </label>
        <div
          className={`form-input w-full min-h-[2.5rem] ${errorClasses} ${readOnlyClasses} py-2.5 flex items-center`}
          aria-readonly
        >
          {value ?? ""}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {infoTooltip && (
          <Tooltip content={infoTooltip} position="top">
            <Info className="w-4 h-4 ml-0.5 inline-block align-middle text-gray-400 dark:text-gray-500 cursor-help" />
          </Tooltip>
        )}
      </label>
      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        className={`form-select w-full ${errorClasses}`}
        required={required}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && (
        <div className="mt-1 flex items-center text-sm text-red-500">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function SectionWithProgress({
  sectionId,
  label,
  icon: Icon,
  propertyData,
  children,
}) {
  const section = IDENTITY_SECTIONS.find((s) => s.id === sectionId);
  const {percent, filled, total} = section
    ? getSectionProgress(propertyData, section)
    : {percent: 0, filled: 0, total: 1};
  const isComplete = percent >= 100;

  return (
    <div
      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden relative"
      data-section-id={sectionId}
    >
      <style>{`
        @keyframes identityCheckPop {
          from {
            opacity: 0;
            transform: scale(0.5) translate(12px, -12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translate(0, 0);
          }
        }
      `}</style>

      {/* Progress bar - compresses (hides) when complete */}
      <div
        className="absolute top-0 left-0 right-0 overflow-hidden bg-gray-200 dark:bg-gray-600"
        style={{
          height: isComplete ? 0 : 3,
          opacity: isComplete ? 0 : 1,
          transition: "height 0.35s ease-out, opacity 0.25s ease-out",
        }}
      >
        <div
          className="h-full bg-emerald-400 dark:bg-emerald-400/90 transition-all duration-500 ease-out"
          style={{width: `${percent}%`}}
        />
      </div>

      {/* Checkmark - pops in top-right when complete */}
      {isComplete && (
        <div
          className="absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-full bg-emerald-400/20 dark:bg-emerald-400/25 text-emerald-600 dark:text-emerald-400"
          style={{
            animation:
              "identityCheckPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          <Check className="w-4 h-4" strokeWidth={2.25} />
        </div>
      )}

      <div className="p-6 pt-7">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 pr-10">
          <Icon className="h-5 w-5 text-[#456654] flex-shrink-0" />
          {label}
          {!isComplete && total > 0 && (
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
              ({filled}/{total})
            </span>
          )}
        </h3>
        {children}
      </div>
    </div>
  );
}

function IdentityTab({
  propertyData,
  handleInputChange,
  errors = {},
  addressInputRef,
  placesLoaded,
  placesError,
  AutocompleteWrapper,
}) {
  return (
    <div className="space-y-4">
      {/* Identity + Address */}
      <SectionWithProgress
        sectionId="identity_address"
        label="Identity & Address"
        icon={Home}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-3">
            <Field
              onChange={handleInputChange}
              label="Property Name"
              name="propertyName"
              value={propertyData.propertyName}
              placeholder="e.g. Lakewood Estate, My Home"
            />
          </div>

          <div className="md:col-span-3">
            {AutocompleteWrapper ? (
              <AutocompleteWrapper>
                <Field
                  inputRef={addressInputRef}
                  uncontrolled
                  label="Address"
                  name="address"
                  value={
                    propertyData.address ||
                    propertyData.fullAddress ||
                    [
                      propertyData.address,
                      propertyData.city,
                      propertyData.state,
                      propertyData.zip,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                    ""
                  }
                  placeholder="Start typing an address to search..."
                  required
                  error={errors.address || placesError}
                  hint={placesLoaded ? "Autocomplete active" : undefined}
                />
              </AutocompleteWrapper>
            ) : (
              <Field
                inputRef={addressInputRef}
                uncontrolled
                label="Address"
                name="address"
                value={
                  propertyData.address ||
                  propertyData.fullAddress ||
                  [
                    propertyData.address,
                    propertyData.city,
                    propertyData.state,
                    propertyData.zip,
                  ]
                    .filter(Boolean)
                    .join(", ") ||
                  ""
                }
                placeholder="Start typing an address to search..."
                required
                error={errors.address || placesError}
                hint={placesLoaded ? "Autocomplete active" : undefined}
              />
            )}
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Field
                onChange={handleInputChange}
                label="Address Line 1"
                name="addressLine1"
                value={propertyData.addressLine1}
                placeholder="e.g. 123 Main St"
                readOnly
                infoTooltip="Auto-populated when you select an address"
              />
            </div>
            <Field
              onChange={handleInputChange}
              label="Address Line 2"
              name="addressLine2"
              value={propertyData.addressLine2}
              placeholder="e.g. Apt 4, Suite 200"
            />

            <Field
              onChange={handleInputChange}
              label="City"
              name="city"
              value={propertyData.city}
              required
              error={errors.city}
              readOnly
              infoTooltip="Auto-populated when you select an address"
            />
            <SelectField
              onChange={handleInputChange}
              label="State"
              name="state"
              value={propertyData.state}
              options={usStates.map((s) => s.code)}
              required
              error={errors.state}
              readOnly
              infoTooltip="Auto-populated when you select an address"
            />
            <Field
              onChange={handleInputChange}
              label="ZIP"
              name="zip"
              value={propertyData.zip}
              required
              error={errors.zip}
              readOnly
              infoTooltip="Auto-populated when you select an address"
            />

            <Field
              onChange={handleInputChange}
              label="County"
              name="county"
              value={propertyData.county}
              placeholder="e.g. King"
              readOnly={!!propertyData.addressLine1}
              infoTooltip={
                propertyData.addressLine1
                  ? "Auto-populated when you select an address"
                  : undefined
              }
            />
            <Field
              onChange={handleInputChange}
              label="Tax / Parcel ID"
              name="taxId"
              value={propertyData.taxId || propertyData.parcelTaxId}
              placeholder="e.g. 9278300025"
            />
          </div>
        </div>
      </SectionWithProgress>

      {/* Ownership & Occupancy */}
      <SectionWithProgress
        sectionId="ownership_occupancy"
        label="Ownership & Occupancy"
        icon={User}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Owner Name"
            name="ownerName"
            value={propertyData.ownerName}
          />
          <Field
            onChange={handleInputChange}
            label="Owner Name 2"
            name="ownerName2"
            value={propertyData.ownerName2}
          />
          <Field
            onChange={handleInputChange}
            label="Owner City"
            name="ownerCity"
            value={propertyData.ownerCity}
            placeholder="e.g. Seattle WA"
          />

          <Field
            onChange={handleInputChange}
            label="Occupant Name"
            name="occupantName"
            value={propertyData.occupantName}
          />
          <SelectField
            onChange={handleInputChange}
            label="Occupant Type"
            name="occupantType"
            value={propertyData.occupantType}
            options={["Owner", "Tenant", "Vacant", "Unknown"]}
          />
          <div className="hidden md:block" />

          <Field
            onChange={handleInputChange}
            label="Owner Phone"
            name="ownerPhone"
            value={propertyData.ownerPhone}
            placeholder="(000) 000-0000"
          />
        </div>
      </SectionWithProgress>

      {/* General Property Info */}
      <SectionWithProgress
        sectionId="general_info"
        label="General Information"
        icon={Building2}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SelectField
            onChange={handleInputChange}
            label="Property Type"
            name="propertyType"
            value={propertyData.propertyType}
            options={[
              "Single Family",
              "Townhouse",
              "Condo",
              "Multi-Family",
              "Manufactured",
              "Land",
              "Other",
            ]}
          />
          <Field
            onChange={handleInputChange}
            label="Sub Type"
            name="subType"
            value={propertyData.subType}
            placeholder="e.g. Residential"
          />
          <Field
            onChange={handleInputChange}
            label="Roof"
            name="roofType"
            value={propertyData.roofType}
            placeholder="e.g. Composition"
          />

          <Field
            onChange={handleInputChange}
            label="Year Built"
            name="yearBuilt"
            type="number"
            value={propertyData.yearBuilt}
          />
        </div>
      </SectionWithProgress>

      {/* Size & Lot */}
      <SectionWithProgress
        sectionId="size_lot"
        label="Size & Lot"
        icon={Ruler}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Total (ft²)"
            name="sqFtTotal"
            type="number"
            value={propertyData.sqFtTotal || propertyData.squareFeet}
          />
          <Field
            onChange={handleInputChange}
            label="Finished (ft²)"
            name="sqFtFinished"
            type="number"
            value={propertyData.sqFtFinished}
          />

          <Field
            onChange={handleInputChange}
            label="Garage (ft²)"
            name="garageSqFt"
            type="number"
            value={propertyData.garageSqFt}
          />
          <Field
            onChange={handleInputChange}
            label="Total Dwelling (ft²)"
            name="totalDwellingSqFt"
            type="number"
            value={propertyData.totalDwellingSqFt}
          />

          <Field
            onChange={handleInputChange}
            label="Lot Size"
            name="lotSize"
            value={propertyData.lotSize}
            placeholder="e.g. .200 ac / 8,700 sf"
          />
          <Field
            onChange={handleInputChange}
            label="Lot Dim"
            name="lotDim"
            value={propertyData.lotDim}
            placeholder="Optional"
          />

          <Field
            onChange={handleInputChange}
            label="Price / (ft²)"
            name="pricePerSqFt"
            value={propertyData.pricePerSqFt}
            placeholder="e.g. $602.41"
          />
          <Field
            onChange={handleInputChange}
            label="Total Price / (ft²)"
            name="totalPricePerSqFt"
            value={propertyData.totalPricePerSqFt}
            placeholder="e.g. $602.41"
          />
        </div>
      </SectionWithProgress>

      {/* Rooms & Baths */}
      <SectionWithProgress
        sectionId="rooms_baths"
        label="Rooms & Baths"
        icon={Bed}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Bedrooms"
            name="bedCount"
            type="number"
            value={propertyData.bedCount || propertyData.rooms}
          />
          <Field
            onChange={handleInputChange}
            label="Bathrooms"
            name="bathCount"
            type="number"
            value={propertyData.bathCount || propertyData.bathrooms}
          />
          <div className="hidden md:block" />

          <Field
            onChange={handleInputChange}
            label="Full Baths"
            name="fullBaths"
            type="number"
            value={propertyData.fullBaths}
          />
          <Field
            onChange={handleInputChange}
            label="3/4 Baths"
            name="threeQuarterBaths"
            type="number"
            value={propertyData.threeQuarterBaths}
          />
          <Field
            onChange={handleInputChange}
            label="Half Baths"
            name="halfBaths"
            type="number"
            value={propertyData.halfBaths}
          />

          <Field
            onChange={handleInputChange}
            label="Number of Showers"
            name="numberOfShowers"
            type="number"
            value={propertyData.numberOfShowers}
          />
          <Field
            onChange={handleInputChange}
            label="Number of Bathtubs"
            name="numberOfBathtubs"
            type="number"
            value={propertyData.numberOfBathtubs}
          />
        </div>
      </SectionWithProgress>

      {/* Features & Parking */}
      <SectionWithProgress
        sectionId="features_parking"
        label="Features & Parking"
        icon={Flame}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Fireplaces"
            name="fireplaces"
            type="number"
            value={propertyData.fireplaces}
          />
          <Field
            onChange={handleInputChange}
            label="Fireplace Type(s)"
            name="fireplaceTypes"
            value={propertyData.fireplaceTypes}
            placeholder="e.g. Gas"
          />
          <Field
            onChange={handleInputChange}
            label="Basement"
            name="basement"
            value={propertyData.basement}
            placeholder="e.g. Daylight, Fully Finished"
          />

          <Field
            onChange={handleInputChange}
            label="Parking Type"
            name="parkingType"
            value={propertyData.parkingType}
            placeholder="e.g. Driveway Parking"
          />
          <Field
            onChange={handleInputChange}
            label="Total Covered Parking"
            name="totalCoveredParking"
            type="number"
            value={propertyData.totalCoveredParking}
          />
          <Field
            onChange={handleInputChange}
            label="Total Uncovered Parking"
            name="totalUncoveredParking"
            type="number"
            value={propertyData.totalUncoveredParking}
          />
        </div>
      </SectionWithProgress>

      {/* Schools */}
      <SectionWithProgress
        sectionId="schools"
        label="Schools"
        icon={School}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="School District"
            name="schoolDistrict"
            value={propertyData.schoolDistrict}
            placeholder="e.g. Seattle"
          />
          <Field
            onChange={handleInputChange}
            label="Elementary"
            name="elementarySchool"
            value={propertyData.elementarySchool}
          />
          <Field
            onChange={handleInputChange}
            label="Junior High"
            name="juniorHighSchool"
            value={propertyData.juniorHighSchool}
          />
          <Field
            onChange={handleInputChange}
            label="Senior High"
            name="seniorHighSchool"
            value={propertyData.seniorHighSchool}
          />
        </div>
      </SectionWithProgress>
    </div>
  );
}

export default IdentityTab;
