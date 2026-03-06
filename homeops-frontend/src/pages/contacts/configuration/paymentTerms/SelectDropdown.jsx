import React, {useState, useRef, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";

function SelectDropdown({paymentTerms, onCreateNew}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const dropdownRef = useRef();
  const navigate = useNavigate();

  const {t} = useTranslation();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (term) => {
    if (term === "create-new") {
      onCreateNew();
    } else {
      setSelected(term);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative w-64" ref={dropdownRef}>
      <label className="block mb-1 font-medium">{t("paymentTerms")}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-3 py-2 border rounded shadow-sm bg-white"
      >
        {selected ? selected.name : t("selectPaymentTerm")}
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 border rounded bg-white shadow-md">
          {paymentTerms.map((term) => (
            <div
              key={term.id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelect(term)}
            >
              {term.name}
            </div>
          ))}
          <div className="border-t my-1"></div>
          <div
            className="px-3 py-2 text-blue-600 font-medium hover:bg-gray-100 cursor-pointer"
            onClick={() => handleSelect("create-new")}
          >
            ➕ {t("createPaymentTerm")}
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectDropdown;
