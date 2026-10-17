import React from "react";

/**
 * Apple-style Badge component for status indicators, counts, and classification tags.
 */
export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
  size = "md",
}) {
  const variantStyles = {
    neutral:
      "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    success:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    warning:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    error:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    brand:
      "bg-brand-50 dark:bg-brand-950/50 text-brand-900 dark:text-brand-300 border-brand-200 dark:border-brand-800",
    info:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  };

  const dotColors = {
    neutral: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-rose-500",
    brand: "bg-brand-500",
    info: "bg-blue-500",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  const currentVariant = variantStyles[variant] || variantStyles.neutral;
  const currentDot = dotColors[variant] || dotColors.neutral;
  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${currentVariant} ${currentSize} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${currentDot}`} />}
      {children}
    </span>
  );
}

export default Badge;
