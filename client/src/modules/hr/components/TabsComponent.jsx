/**
 * @fileoverview A reusable tabbed navigation container component.
 */

import React from "react";

/**
 * TabsComponent
 * Renders a row of clickable tabs and displays the content associated with the active tab.
 * 
 * @param {Object} props
 * @param {Array<{value: string, label: string, content: React.ReactNode}>} props.tabs - Array of tab definitions.
 * @param {string} props.value - The currently active tab value.
 * @param {Function} props.onChange - Callback fired when a tab is clicked.
 * @returns {JSX.Element} The tabbed view.
 */
export default function TabsComponent({ tabs, value, onChange }) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b mb-3">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`px-3 py-2 text-sm ${value === t.value ? "border-b-2 border-brand-600" : ""}`}
            onClick={() => onChange?.(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs.find((t) => t.value === value)?.content}</div>
    </div>
  );
}
