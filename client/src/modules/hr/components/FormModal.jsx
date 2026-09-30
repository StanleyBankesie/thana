/**
 * @fileoverview A reusable modal component for displaying forms.
 */

import React from "react";

/**
 * FormModal component
 * Renders a modal overlay with a header, body (children), and footer actions (Cancel/Save).
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible.
 * @param {string} props.title - Modal header title.
 * @param {React.ReactNode} props.children - Form content.
 * @param {Function} props.onClose - Callback when modal is closed.
 * @param {Function} props.onSubmit - Callback when the save button is clicked.
 * @param {boolean} props.submitting - True if the form is currently saving.
 * @returns {JSX.Element|null} The modal element or null if closed.
 */
export default function FormModal({ open, title, children, onClose, onSubmit, submitting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded shadow-lg w-full max-w-2xl">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
