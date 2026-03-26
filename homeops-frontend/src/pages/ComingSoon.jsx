import React, {useCallback, useState} from "react";

import Sidebar from "../partials/Sidebar";
import Header from "../partials/Header";
import {ChevronDown, ChevronRight, Clock} from "lucide-react";

const UPCOMING_FEATURES = [
  {
    id: "closing-pack",
    title: '"1-Click Closing Pack." by Opsy',
    description:
      "Never scramble for documents again. This feature allows users (both homeowners and Real Estate Agents) to generate professional, branded PDF \"Passports\" of their home's entire history—maintenance records, warranties, and receipts—ready for tax season, refinancing, or the eventual sale. Make your next milestone seamless.",
  },
  {
    id: "project-management",
    title: "Project Management by Opsy",
    description:
      "Your Digital Foreman. Stop managing renovations with sticky notes and broken email threads. Our Project Management suite allows you to set timelines, track budgets, and store before-and-after photos for every upgrade. Whether it's a bathroom remodel or a roof replacement, Opsy keeps the project on track and the data archived.",
  },
  {
    id: "equity-manager",
    title: "EquityManager by HomeOps",
    description:
      'Your Net Worth, Unlocked. A home isn\'t just a place to live; it\'s your largest financial asset. EquityManager integrates with your mortgage data to provide real-time insights into your "Wealth-in-Walls." Track your loan-to-value ratio and see exactly how much cash you\'ve "unlocked" through market appreciation and principal pay-down.',
  },
  {
    id: "home-value-attom",
    title: "Home Value powered by Attom Data",
    description:
      'Institutional-Grade Insights. Forget the "Zestimate" guesswork. By partnering with Attom Data coupled with your existing database, Opsy provides institutional-grade Automated Valuation Models (AVMs). See your home\'s market value based on the same data used by banks and hedge funds, updated in real-time.',
  },
  {
    id: "contractor-bidding",
    title: "In-App Contractor Bidding & Invoicing",
    description:
      "The Marketplace of Trust. Find the help you need without the headache. Request bids from local, verified pros directly within Opsy. Once the job is done, pay your invoice securely in-app. The best part? The receipt and warranty are automatically archived to your property's Digital Passport the second you pay, making your manual lift completely disappear.",
  },
  {
    id: "utility-vault",
    title: "Utility Vault & Energy Audit",
    description:
      "Homeowners sync their utility accounts (Electric, Gas, Water) to Opsy. The app tracks the impact of home improvements (like new windows or insulation) on monthly bills.",
  },
  {
    id: "predictive-alerts",
    title: 'Predictive "Check Engine" Alerts',
    description:
      "Based on the installation dates of appliances in the Passport, Opsy sends proactive maintenance alerts.",
  },
  {
    id: "digital-curb-appeal",
    title: '"Digital Curb Appeal" by HomeOps',
    description:
      "Using the photos and data in the vault, Opsy's AI suggests the Top 3 High-ROI Improvements based on current neighborhood and industry trends.",
  },
  {
    id: "policy-pulse",
    title: "Policy Pulse by Opsy",
    description:
      'Most homeowners overpay for insurance because their carriers don\'t know they just spent $20k on a new roof or $15k on a seismic retrofit. This feature uses the "Digital Passport" data to automatically generate an Insurance Audit Report.',
  },
];

function FeatureCollapsible({id, title, description, isOpen, onToggle}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        className="w-full px-4 py-4 sm:px-5 sm:py-4 flex items-start justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors group"
      >
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 pr-2 leading-snug">
          {title}
        </h2>
        <span className="shrink-0 mt-0.5 text-gray-500 dark:text-gray-400 group-hover:text-[#456564] dark:group-hover:text-[#5a7d7c] transition-colors">
          {isOpen ? (
            <ChevronDown className="w-5 h-5" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-5 h-5" strokeWidth={2} />
          )}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700/80">
          <p className="text-sm sm:text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed pt-4">
            {description}
          </p>
        </div>
      )}
    </div>
  );
}

function ComingSoon() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openIds, setOpenIds] = useState(() => ({}));

  const toggle = useCallback((id) => {
    setOpenIds((prev) => ({...prev, [id]: !prev[id]}));
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-col items-center text-center mb-10 sm:mb-12">
                <div className="w-16 h-16 rounded-full bg-[#456564]/10 flex items-center justify-center mb-6">
                  <Clock
                    className="w-8 h-8 text-[#456564]"
                    strokeWidth={1.5}
                  />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Coming Soon
                </h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-md leading-relaxed">
                  These features are currently under development and will be
                  available soon.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4 px-4 sm:px-0">
                {UPCOMING_FEATURES.map((feature) => (
                  <FeatureCollapsible
                    key={feature.id}
                    id={feature.id}
                    title={feature.title}
                    description={feature.description}
                    isOpen={!!openIds[feature.id]}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ComingSoon;
