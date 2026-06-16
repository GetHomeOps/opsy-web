import React, {useState} from "react";
import {useNavigate} from "react-router-dom";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import ContactFormContainer from "./ContactFormContainer";

function ContactContainer() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleReturn = () => {
    navigate("/directory/contacts");
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Content area */}
      <div className="relative flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-2 sm:px-3 py-3 w-full">
            {/* Form */}
            <ContactFormContainer onReturn={handleReturn} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default ContactContainer;
