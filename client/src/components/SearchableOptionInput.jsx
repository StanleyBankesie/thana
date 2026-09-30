/**
 * @fileoverview A reusable dropdown input with search capabilities.
 * Designed to filter through options quickly and securely.
 */

import React, { useEffect, useMemo, useState } from "react";
import { filterByPrefix } from "@/utils/searchUtils.js";

/**
 * SearchableOptionInput component
 * Renders an input field that expands into a dropdown menu of searchable options.
 *
 * @param {Object} props
 * @param {string|number} props.value - Currently selected value.
 * @param {Array<{label: string, value: string|number}>} props.options - List of options.
 * @param {Function} props.onSelect - Callback when an option is selected.
 * @param {string} props.placeholder - Input placeholder text.
 * @param {boolean} props.disabled - Whether the input is disabled.
 * @param {boolean} props.required - Whether the input is required.
 * @param {string} props.containerClassName - CSS class for the container.
 * @param {string} props.inputClassName - CSS class for the input element.
 * @param {string} props.dropdownClassName - CSS class for the dropdown container.
 * @param {string} props.optionClassName - CSS class for each option button.
 * @param {Function|null} props.getSearchKeys - Custom search key extractor for filtering.
 * @returns {JSX.Element} The rendered searchable input component.
 */
export default function SearchableOptionInput({
  value,
  options = [],
  onSelect,
  placeholder = "Type to search",
  disabled = false,
  required = false,
  containerClassName = "relative",
  inputClassName = "input",
  dropdownClassName = "absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto",
  optionClassName = "block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm",
  getSearchKeys = null,
}) {
  const normalizedValue = String(value || "");
  const selectedOption = useMemo(
    () =>
      (Array.isArray(options) ? options : []).find(
        (option) => String(option.value) === normalizedValue,
      ) || null,
    [options, normalizedValue],
  );
  const selectedLabel = selectedOption?.label || "";

  const [query, setQuery] = useState(selectedLabel);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel, normalizedValue]);

  const results = useMemo(() => {
    const trimmed = String(query || "").trim();
    if (!showMenu || !trimmed) return [];
    if (normalizedValue && trimmed === String(selectedLabel).trim()) return [];
    return filterByPrefix(Array.isArray(options) ? options : [], {
      query: trimmed,
      getKeys: getSearchKeys || ((option) => [option.label]),
    });
  }, [
    getSearchKeys,
    normalizedValue,
    options,
    query,
    selectedLabel,
    showMenu,
  ]);

  /**
   * Commits the selected option and triggers the callback.
   * @param {Object} option - The selected option object.
   */
  const commitSelection = (option) => {
    setQuery(option?.label || "");
    setShowMenu(false);
    onSelect?.(option?.value || "", option || null);
  };

  return (
    <div className={containerClassName}>
      <input type="hidden" value={normalizedValue} required={required} readOnly />
      <input
        className={inputClassName}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onFocus={() => {
          const trimmed = String(query || "").trim();
          if (trimmed && (!normalizedValue || trimmed !== String(selectedLabel).trim())) {
            setShowMenu(true);
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setShowMenu(Boolean(String(next || "").trim()));
          if (!next && normalizedValue) {
            onSelect?.("", null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length) {
            e.preventDefault();
            commitSelection(results[0]);
          } else if (e.key === "Escape") {
            setShowMenu(false);
            setQuery(selectedLabel);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setShowMenu(false);
            if (normalizedValue && query !== selectedLabel) {
              setQuery(selectedLabel);
            }
          }, 120);
        }}
      />
      {showMenu && results.length ? (
        <div className={dropdownClassName}>
          {results.map((option) => (
            <button
              type="button"
              key={option.value}
              className={optionClassName}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitSelection(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
