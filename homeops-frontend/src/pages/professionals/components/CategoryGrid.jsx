import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Hammer, Trees, PaintBucket, Plug, Wrench, Ruler,
  Armchair, Droplets, Home, Wind, CookingPot, Pencil,
} from "lucide-react";
import useCurrentAccount from "../../../hooks/useCurrentAccount";

const CATEGORY_ICONS = {
  cabinets: Armchair,
  "hardwood-flooring": Ruler,
  "general-contractors": Hammer,
  "interior-designers": Pencil,
  electricians: Plug,
  plumbers: Droplets,
  painters: PaintBucket,
  landscapers: Trees,
  roofers: Home,
  hvac: Wind,
  "kitchen-bath": CookingPot,
  architects: Wrench,
};

const CATEGORY_COLORS = {
  cabinets: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  "hardwood-flooring": "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
  "general-contractors": "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  "interior-designers": "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400",
  electricians: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
  plumbers: "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400",
  painters: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
  landscapers: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  roofers: "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400",
  hvac: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400",
  "kitchen-bath": "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
  architects: "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400",
};

function CategoryGrid({ categories, location }) {
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";

  const handleClick = (category) => {
    const params = new URLSearchParams();
    params.set("category", category.id);
    if (location?.city) params.set("city", location.city);
    if (location?.state) params.set("state", location.state);

    const base = accountUrl
      ? `/${accountUrl}/professionals/search`
      : "/professionals/search";
    navigate(`${base}?${params.toString()}`);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {categories.map((category) => {
        const Icon = CATEGORY_ICONS[category.id] || Hammer;
        const colorClasses = CATEGORY_COLORS[category.id] || "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400";

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => handleClick(category)}
            className="group flex flex-col items-center gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm hover:shadow-md hover:border-[#456564]/30 dark:hover:border-[#456564]/30 transition-all duration-200 text-center"
          >
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorClasses} group-hover:scale-110 transition-transform duration-200`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#456564] dark:group-hover:text-[#7aa3a2] transition-colors">
                {category.name}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {category.proCount} professionals
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default CategoryGrid;
