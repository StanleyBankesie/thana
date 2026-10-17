import React from "react";

/**
 * Apple-style accessible Toggle Switch component with full keyboard support,
 * ARIA roles, tactile feedback, and optional policy badge.
 */
export function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  badge,
  className = "",
  id,
}) {
  return (
    <div
      role="switch"
      id={id}
      aria-checked={Boolean(checked)}
      aria-label={typeof label === "string" ? label : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange && onChange(!checked)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onChange && onChange(!checked);
        }
      }}
      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 select-none ${
        disabled
          ? "opacity-60 bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 cursor-not-allowed"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer shadow-apple-xs"
      } ${className}`}
    >
      <div className="flex-1 pr-3 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand-900 dark:group-hover:text-brand-300 transition-colors">
            {label}
          </span>
          {badge && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <div
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
          checked
            ? "bg-emerald-600 dark:bg-emerald-500"
            : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

export default ToggleSwitch;
