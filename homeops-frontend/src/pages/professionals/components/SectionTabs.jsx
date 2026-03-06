import React from "react";

const TABS = [
  { id: "about", label: "About" },
  { id: "photos", label: "Photos" },
  { id: "credentials", label: "Credentials" },
  { id: "reviews", label: "Reviews" },
];

function SectionTabs({ activeTab, onTabClick, sectionRefs, scrollToSection }) {
  const handleTabClick = (tabId) => {
    if (scrollToSection) {
      scrollToSection(tabId);
    } else {
      const el = sectionRefs?.current?.[tabId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        onTabClick(tabId);
      }
    }
  };

  return (
    <nav
      className="sticky top-16 z-20 bg-gray-50 dark:bg-gray-950 border-b border-gray-200/60 dark:border-gray-800"
      aria-label="Section navigation"
    >
      <div className="flex gap-1 overflow-x-auto no-scrollbar px-0 sm:px-4 lg:px-5 xxl:px-12 max-w-6xl mx-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            className={`py-3 px-4 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-[#456564] text-[#456564] dark:border-[#7aa3a2] dark:text-[#7aa3a2]"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default SectionTabs;
export { TABS };
