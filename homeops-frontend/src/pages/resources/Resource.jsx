import React from "react";
import ResourceFormContainer from "./ResourceFormContainer";
import {PAGE_LAYOUT} from "../../constants/layout";

function Resource() {

  return (
            <main className="flex-1 overflow-y-auto">
          <div className="px-3 sm:px-5 lg:px-6 xxl:px-14 py-8 w-full max-w-4xl mx-auto">
            <ResourceFormContainer />
          </div>
        </main>
      
  );
}

export default Resource;
