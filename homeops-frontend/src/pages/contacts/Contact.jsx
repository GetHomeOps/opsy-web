import React, {useState} from "react";
import {useNavigate} from "react-router-dom";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import { PAGE_LAYOUT } from "../../constants/layout";
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
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className={PAGE_LAYOUT.form}>
            {/* Form */}
            <ContactFormContainer onReturn={handleReturn} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default ContactContainer;
