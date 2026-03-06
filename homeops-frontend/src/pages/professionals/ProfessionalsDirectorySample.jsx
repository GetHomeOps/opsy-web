import React, {useState} from "react";
import {useNavigate} from "react-router-dom";
import {ArrowRight, Bookmark, Search} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {LocationBar, CategorySectionRow, ProfessionalCard} from "./components";
import {
  CATEGORY_SECTIONS,
  SERVICE_CATEGORIES,
  MOCK_PROFESSIONALS,
} from "./data/mockData";

function ProfessionalsDirectorySample() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, setLocation] = useState(null);
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";

  const savedPros = MOCK_PROFESSIONALS.filter((p) => p.saved).slice(0, 4);
  const featuredPros = [...MOCK_PROFESSIONALS]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 8);

  const goToMyPros = () => {
    navigate(
      accountUrl
        ? `/${accountUrl}/my-professionals-sample`
        : "/my-professionals-sample",
    );
  };

  const goToSearch = () => {
    const params = new URLSearchParams();
    if (location?.city) params.set("city", location.city);
    if (location?.state) params.set("state", location.state);
    const base = accountUrl
      ? `/${accountUrl}/professionals-sample/search`
      : "/professionals-sample/search";
    navigate(`${base}?${params.toString()}`);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* Hero / Location Bar */}
            <div className="relative mb-10 rounded-2xl overflow-hidden shadow-xl">
              {/* Refined gradient: softer, more organic emerald-to-forest */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-teal-800/95 to-slate-900" />
              {/* Subtle radial glow for depth */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(16,185,129,0.2),transparent)]" />
              {/* Minimal geometric pattern - lighter, more refined */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
                    `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                      <path d="M30 0 L30 60 M0 30 L60 30" stroke="white" stroke-width="0.5" fill="none"/>
                      <path d="M15 15 L45 45 M45 15 L15 45" stroke="white" stroke-width="0.3" fill="none"/>
                    </svg>`,
                  )}")`,
                }}
              />
              <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14">
                <div className="max-w-2xl mx-auto text-center">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-3">
                    Find Home Service Professionals
                  </h1>
                  <p className="text-white/80 text-sm sm:text-base lg:text-lg mb-8 max-w-lg mx-auto leading-relaxed">
                    Browse top-rated local pros for any home project
                  </p>
                  <div className="flex flex-col gap-4 items-center">
                    <LocationBar
                      value={location}
                      onChange={setLocation}
                      className="w-full max-w-md"
                    />
                    <button
                      type="button"
                      onClick={goToSearch}
                      className="inline-flex items-center justify-center gap-2 bg-white text-emerald-900 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-white/95 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-black/10"
                    >
                      <Search className="w-4 h-4" />
                      Browse All Professionals
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* My Professionals teaser — compact horizontal cards, distinct from category sections */}
            {savedPros.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-[#456564]" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      My Professionals
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={goToMyPros}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] transition-colors"
                  >
                    View all
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {savedPros.map((pro) => (
                    <ProfessionalCard
                      key={pro.id}
                      professional={pro}
                      variant="directory-teaser"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Featured Professionals — top-rated from mock data */}
            {featuredPros.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Featured Professionals
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Top-rated pros in your area
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToSearch}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] transition-colors"
                  >
                    View all
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {featuredPros.map((pro) => (
                    <ProfessionalCard
                      key={pro.id}
                      professional={pro}
                      variant="grid"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Service Categories — Houzz-style sections with photos */}
            <section>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Browse by Service
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Select a category to find specialists in your area
                </p>
              </div>
              {CATEGORY_SECTIONS.map((section) => {
                const categories = section.categoryIds
                  .map((id) => SERVICE_CATEGORIES.find((c) => c.id === id))
                  .filter(Boolean);
                return (
                  <CategorySectionRow
                    key={section.id}
                    title={section.title}
                    categories={categories}
                    location={location}
                    searchBasePath="professionals-sample/search"
                  />
                );
              })}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ProfessionalsDirectorySample;
