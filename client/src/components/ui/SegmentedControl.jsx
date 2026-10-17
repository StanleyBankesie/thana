import React from "react";

/**
 * Apple-style Segmented Control for multi-option switching (e.g. view mode, status filter).
 */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  className = "",
  size = "md",
}) {
  const sizeStyles = {
    sm: "p-0.5 text-xs h-8",
    md: "p-1 text-xs h-10",
    lg: "p-1.5 text-sm h-11",
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      role="tablist"
      className={`inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80 ${currentSize} ${className}`}
    >
      {options.map((option) => {
        const optionValue = typeof option === "object" ? option.value : option;
        const optionLabel = typeof option === "object" ? option.label : option;
        const Icon = typeof option === "object" ? option.icon : null;
        const isActive = value === optionValue;

        return (
          <button
            key={optionValue}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(optionValue)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-150 select-none ${
              isActive
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-apple-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{optionLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
