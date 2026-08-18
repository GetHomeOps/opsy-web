import React from "react";
import {useNavigate} from "react-router-dom";

import ContactFormContainer from "./ContactFormContainer";

function ContactContainer() {
  const navigate = useNavigate();

  const handleReturn = () => {
    navigate("/directory/contacts");
  };

  return (
            <main className="grow">
          <div className="px-2 sm:px-3 py-3 w-full">
            {/* Form */}
            <ContactFormContainer onReturn={handleReturn} />
          </div>
        </main>
      
  );
}

export default ContactContainer;
