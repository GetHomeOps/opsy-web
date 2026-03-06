import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
import useCurrentAccount from "../../../hooks/useCurrentAccount";

function CategorySectionRow({ title, categories, location, searchBasePath = "professionals/search" }) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const step = 280;
    scrollRef.current.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const handleClick = (category) => {
    const params = new URLSearchParams();
    params.set("category", category.id);
    if (location?.city) params.set("city", location.city);
    if (location?.state) params.set("state", location.state);
    const base = accountUrl ? `/${accountUrl}/${searchBasePath}` : `/${searchBasePath}`;
    navigate(`${base}?${params.toString()}`);
  };

  if (!categories.length) return null;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        {title}
      </h2>
      <div className="relative group/row">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleClick(category)}
              className="flex-shrink-0 w-[180px] sm:w-[200px] rounded-xl border border-gray-200/60 dark:border-gray-700/50 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-[#456564]/30 dark:hover:border-[#456564]/30 transition-all duration-200 overflow-hidden text-left group/card"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={category.imageUrl || PLACEHOLDER_IMG}
                  alt=""
                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover/card:text-[#456564] dark:group-hover/card:text-[#7aa3a2] transition-colors line-clamp-2">
                  {category.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {category.proCount} professionals
                </p>
              </div>
            </button>
          ))}
        </div>
        {categories.length > 4 && (
          <button
            type="button"
            onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-md flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-[#456564] hover:border-[#456564]/40 opacity-0 group-hover/row:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </section>
  );
}

export default CategorySectionRow;
