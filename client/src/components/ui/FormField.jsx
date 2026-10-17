import React from "react";

/**
 * Apple-style FormField component guaranteeing high-contrast labels (>= 4.5:1),
 * accessible requirement indicators, and clean helper notes.
 */
export function FormField({
  label,
  required = false,
  hint,
  helper,
  error,
  children,
  className = "",
  id,
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={id}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200"
          >
            {label}{" "}
            {required && (
              <span className="text-rose-500 normal-case" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {hint && (
            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-normal">
              {hint}
            </span>
          )}
        </div>
      )}

      {children}

      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-normal animate-in fade-in">
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export default FormField;
