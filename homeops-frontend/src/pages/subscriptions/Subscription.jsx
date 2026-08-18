import React from "react";


import SubscriptionFormContainer from "./SubscriptionFormContainer";

function Subscription() {

  return (
            <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto">
            {/* Form */}
            <SubscriptionFormContainer />
          </div>
        </main>
      
  );
}

export default Subscription;
