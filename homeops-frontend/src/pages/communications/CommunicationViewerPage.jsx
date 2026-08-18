import React from "react";
import CommunicationViewer from "./CommunicationViewer";

function CommunicationViewerPage() {

  return (
            <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 xxl:px-14 py-8 w-full">
            <CommunicationViewer />
          </div>
        </main>
      
  );
}

export default CommunicationViewerPage;
