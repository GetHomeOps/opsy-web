import React from "react";
import {Sparkles} from "lucide-react";
import ModalBlank from "./ModalBlank";

function ComingSoonModal({modalOpen, setModalOpen}) {
  return (
    <ModalBlank
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-md"
    >
      <div className="p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[#456564]/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-[#456564]" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Coming Soon
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
          These features are currently under development and will be available
          soon.
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(false)}
          className="mt-6 px-4 py-2 bg-[#456564] hover:bg-[#3a5655] text-white text-sm font-medium rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </ModalBlank>
  );
}

export default ComingSoonModal;
