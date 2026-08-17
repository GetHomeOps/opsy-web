import React from "react";
import ContactLinkIcon from "./ContactLinkIcon";
import {findContactForInstaller, findContactForContractor} from "../helpers/contactNavigation";

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
  const linkedContact =
    findContactForInstaller(value, contacts) ||
    findContactForContractor({contractor: value}, contacts);

  return (
    <div className="flex items-center gap-1.5">
      <select
        name={name}
        value={value != null && value !== "" ? String(value) : ""}
        onChange={onChange}
        className={`form-select w-full min-w-0 flex-1 ${className}`}
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
      {linkedContact?.id != null && <ContactLinkIcon contactId={linkedContact.id} />}
    </div>
  );
}

export default InstallerSelect;
