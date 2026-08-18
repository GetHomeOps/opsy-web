import React from "react";
import {useNavigate, useParams} from "react-router-dom";


import ContactFormContainer from "./UserFormContainer";

function UserContainer() {
  const navigate = useNavigate();
  const {accountUrl} = useParams();

  const handleReturn = () => {
    navigate(`/${accountUrl}/users`);
  };

  return (
            <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto">
            {/* Form */}
            <ContactFormContainer onReturn={handleReturn} />
          </div>
        </main>
      
  );
}

export default UserContainer;
