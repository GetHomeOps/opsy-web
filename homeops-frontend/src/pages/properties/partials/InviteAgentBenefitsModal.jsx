import React from "react";
import {
  Briefcase,
  ClipboardList,
  FileText,
  Shield,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";

const BENEFITS = [
  {
    icon: ClipboardList,
    title: "Maintenance coordination",
    description:
      "Your agent can schedule, track, and manage maintenance tasks on your behalf.",
  },
  {
    icon: FileText,
    title: "Document management",
    description:
      "Share inspection reports, warranties, and property documents seamlessly.",
  },
  {
    icon: Shield,
    title: "Professional oversight",
    description:
      "Get expert guidance on home systems, repairs, and preventive care.",
  },
  {
    icon: TrendingUp,
    title: "Property value protection",
    description:
      "Proactive maintenance helps preserve and grow your home's value over time.",
  },
];

function InviteAgentBenefitsModal({modalOpen, setModalOpen, onInviteAgent}) {
  return (
    <ModalBlank
      id="invite-agent-benefits-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-lg"
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-[#456564]/15 dark:bg-[#5a7a78]/25 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-[#456564] dark:text-[#5a7a78]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Why invite an agent?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Unlock the full potential of your property management
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#456564]/10 dark:bg-[#5a7a78]/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4.5 h-4.5 text-[#456564] dark:text-[#5a7a78]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {b.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {b.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => {
              setModalOpen(false);
              onInviteAgent?.();
            }}
            className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white flex items-center gap-2"
          >
            Invite an agent
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

export default InviteAgentBenefitsModal;
