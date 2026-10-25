import React, { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

/**
 * Universal Standard Modal Component
 * Conforms to the Project Management module modal design specifications:
 * - Backdrop: bg-black/60 backdrop-blur-sm
 * - Container: rounded-2xl border shadow-2xl bg-white dark:bg-slate-900
 * - Header: clean white/dark surface, squircle icon badge, bold title, subtitle, clean close button
 * - Content: clean padded body
 * - Footer: clean white/dark surface with standard ERP buttons
 */
export default function Modal({
  open,
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  maxWidth = 'max-w-2xl lg:max-w-3xl',
  onSubmit,
  footer,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitting = false,
  loading = false,
  showFooter = true,
  className = '',
  zIndex = 'z-50',
  headerExtra,
}) {
  const isVisible = open !== undefined ? open : isOpen;
  const isBusy = submitting || loading;

  // Prevent background scroll when open
  useEffect(() => {
    if (isVisible) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isVisible]);

  // Handle ESC key press
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose && !isBusy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose, isBusy]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndex} overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn`}
      onClick={() => {
        if (onClose && !isBusy) onClose();
      }}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full ${maxWidth} shadow-2xl overflow-hidden my-auto sm:my-8 transition-all ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-400 flex items-center justify-center font-bold flex-shrink-0 border border-brand-200/50 dark:border-brand-800/50">
                {typeof Icon === 'function' ? <Icon size={20} /> : Icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerExtra}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {onSubmit ? (
          <form onSubmit={onSubmit} className="p-6 space-y-4 text-sm">
            {children}
            {showFooter && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 -mx-6 -mb-6 p-4">
                {footer ? (
                  footer
                ) : (
                  <>
                    {onClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={isBusy}
                        className="btn btn-secondary px-4 py-2 text-sm font-medium"
                      >
                        {cancelLabel}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="btn btn-primary px-5 py-2 text-sm font-medium inline-flex items-center gap-2"
                    >
                      {isBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                      {submitLabel}
                    </button>
                  </>
                )}
              </div>
            )}
          </form>
        ) : (
          <div className="p-6 space-y-4 text-sm">
            {children}
            {showFooter && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 -mx-6 -mb-6 p-4">
                {footer ? (
                  footer
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary px-4 py-2 text-sm font-medium"
                  >
                    Close
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
