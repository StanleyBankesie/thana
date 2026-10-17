import React from "react";

/**
 * Apple HIG compliant Button component with prominent, secondary, destructive, and ghost styles.
 * Ensures minimum 44px hit regions on touch devices and tactile active press transitions.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  ...props
}) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-xl select-none transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-white dark:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

  const variantStyles = {
    primary:
      "bg-brand-900 hover:bg-brand-800 active:bg-brand-950 text-white dark:bg-brand-500 dark:hover:bg-brand-600 dark:active:bg-brand-700 shadow-apple-xs focus:ring-brand-500/40",
    secondary:
      "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-apple-xs focus:ring-slate-400/30",
    destructive:
      "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-900 focus:ring-rose-500/30",
    ghost:
      "bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-400/20",
    outline:
      "bg-transparent text-brand-900 dark:text-brand-300 border border-brand-900/30 dark:border-brand-400/40 hover:bg-brand-50 dark:hover:bg-brand-950/30 focus:ring-brand-500/30",
  };

  const sizeStyles = {
    sm: "h-9 px-3.5 text-xs gap-1.5 min-w-[36px]",
    md: "h-11 px-5 text-sm gap-2 min-w-[44px]", // Apple 44pt touch target
    lg: "h-12 px-6 text-base gap-2.5 min-w-[48px]",
    icon: "h-11 w-11 p-0",
  };

  const currentVariant = variantStyles[variant] || variantStyles.primary;
  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${currentVariant} ${currentSize} ${className}`}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon && iconPosition === "left" ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}

      {children && <span className="truncate">{children}</span>}

      {!loading && Icon && iconPosition === "right" && (
        <Icon className="w-4 h-4 shrink-0" />
      )}
    </button>
  );
}

export default Button;
