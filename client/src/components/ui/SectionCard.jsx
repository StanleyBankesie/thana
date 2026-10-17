import React from "react";

/**
 * Apple-style Grouped Section Card with subtle border, ambient occlusion shadow,
 * refined header spacing, and optional icon badge / actions.
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  badge,
  action,
  children,
  className = "",
  headerClassName = "",
  bodyClassName = "",
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-apple-xs overflow-hidden transition-all duration-150 ${className}`}
    >
      {(title || Icon || action || badge) && (
        <div
          className={`px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4 ${headerClassName}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-300 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {badge && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {badge}
              </span>
            )}
            {action}
          </div>
        </div>
      )}

      <div className={`p-6 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

export default SectionCard;
