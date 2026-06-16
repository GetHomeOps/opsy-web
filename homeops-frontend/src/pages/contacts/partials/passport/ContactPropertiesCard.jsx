import React from "react";
import {Home, MapPin, ChevronRight} from "lucide-react";
import SectionCard from "../../../properties/partials/passport/SectionCard";
import EmptyStateCard from "../../../properties/partials/passport/EmptyStateCard";
import {StatusBadge} from "../../../properties/partials/passport/StatusBadge";
import CardListPagination, {
  usePaginatedList,
} from "../../../properties/partials/passport/CardListPagination";

/**
 * Lists properties associated with this contact. Falls back to a polished empty
 * state when no relationships exist yet.
 */
function ContactPropertiesCard({properties = [], onViewProperty}) {
  const {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    pageCount,
    rangeStart,
    rangeEnd,
  } = usePaginatedList(properties);

  return (
    <SectionCard flat title="Associated Properties" icon={Home}>
      {properties.length > 0 ? (
        <>
          <ul className="space-y-2">
            {pageItems.map((property) => (
              <li key={property.id}>
                <button
                  type="button"
                  onClick={() => onViewProperty?.(property)}
                  className="w-full flex items-center gap-3 text-left rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 bg-neutral-50/60 dark:bg-neutral-800/40 px-3 py-2.5 group hover:border-[#456564]/50 transition-colors"
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    {property.image_url || property.image ? (
                      <img
                        src={property.image_url || property.image}
                        alt={property.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Home className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                      {property.name || property.propertyName || "Property"}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {property.address || property.fullAddress || "—"}
                    </p>
                  </div>
                  {property.relationship && (
                    <StatusBadge tone="neutral" className="shrink-0">
                      {property.relationship}
                    </StatusBadge>
                  )}
                  <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-[#456564] dark:group-hover:text-[#7fa3a1] shrink-0 transition-colors" />
                </button>
              </li>
            ))}
          </ul>
          <CardListPagination
            totalItems={totalItems}
            page={page}
            pageSize={pageSize}
            pageCount={pageCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="property"
          />
        </>
      ) : (
        <EmptyStateCard
          icon={Home}
          title="No associated properties"
          description="Properties connected to this contact will appear here once relationships are added."
        />
      )}
    </SectionCard>
  );
}

export default ContactPropertiesCard;
