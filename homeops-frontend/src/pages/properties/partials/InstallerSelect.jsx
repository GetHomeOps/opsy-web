import React from "react";

function InstallerSelect({
  name,
  value,
  onChange,
  contacts = [],
  className = "",
  placeholder = "Select installer",
}) {
  const contactIds = contacts.map((c) => String(c.id)).filter(Boolean);
  const valueInContacts = value != null && value !== "" && contactIds.includes(String(value));

  return (
    <select
      name={name}
      value={value != null && value !== "" ? String(value) : ""}
      onChange={onChange}
      className={`form-select w-full ${className}`}
    >
      <option value="">{placeholder}</option>
      {value != null && value !== "" && !valueInContacts && (
        <option value={value}>
          {typeof value === "string" && isNaN(Number(value)) ? value : `ID: ${value}`}
        </option>
      )}
      {contacts.map((contact) => (
        <option key={contact.id} value={contact.id}>
          {contact.name || "Unnamed"}
        </option>
      ))}
    </select>
  );
}

export default InstallerSelect;
