/**
 * @fileoverview Reusable page header component for HR module pages.
 */

import React from "react";

/**
 * PageHeader component
 * Displays a standard page title, an optional back button, and supplementary action elements.
 * 
 * @param {Object} props
 * @param {string} props.title - The main title of the page.
 * @param {React.ReactNode} props.children - Optional action buttons to display on the right.
 * @param {Function} [props.onBack] - Optional callback for navigating backwards.
 * @param {string} [props.backLabel="Back to Menu"] - Custom label for the back button.
 * @returns {JSX.Element} The page header layout.
 */
export default function PageHeader({ title, children, onBack, backLabel = "Back to Menu" }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button type="button" className="btn-outline" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
