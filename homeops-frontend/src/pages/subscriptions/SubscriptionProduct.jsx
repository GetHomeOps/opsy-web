import React from "react";


import SubscriptionProductFormContainer from "./SubscriptionProductFormContainer";

function SubscriptionProduct() {

  return (
            <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* Form */}
            <SubscriptionProductFormContainer />
          </div>
        </main>
      
  );
}

export default SubscriptionProduct;
