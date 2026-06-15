import React from "react";

export const PASSPORT_CARD_SHADOW =
  "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";

/**
 * Standard passport surface card: title, optional description, optional
 * header action, compact padding. Purely presentational.
 */
function SectionCard({
  title,
  description,
  icon: Icon,
  iconClassName,
  action,
  badge,
  children,
  className = "",
  bodyClassName = "",
  flat = false,
  ...rest
}) {
  return (
    <section
      className={`rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 ${className}`}
      style={flat ? undefined : {boxShadow: PASSPORT_CARD_SHADOW}}
      {...rest}
    >
      {(title || action) && (
        <div className="px-4 md:px-5 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {Icon && (
                  <Icon
                    className={`w-4 h-4 shrink-0 ${iconClassName ?? "text-neutral-400 dark:text-neutral-500"}`}
                  />
                )}
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                  {title}
                </h3>
                {badge}
              </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}
      <div className={`px-4 md:px-5 pb-4 ${title ? "" : "pt-4"} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}

export default SectionCard;
