import React from "react";

/**
 * Apple-style Sticky Bottom Action Dock with translucent blur backdrop,
 * subtle border, and responsive action placement.
 */
export function ActionDock({
  children,
  left,
  right,
  className = "",
  containerClassName = "",
}) {
  return (
    <div
      className={`sticky bottom-4 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-apple-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-150 ${className}`}
    >
      <div className="w-full sm:w-auto flex items-center gap-2">
        {left}
      </div>

      <div className={`w-full sm:w-auto flex items-center gap-3 justify-end ${containerClassName}`}>
        {right || children}
      </div>
    </div>
  );
}

export default ActionDock;
