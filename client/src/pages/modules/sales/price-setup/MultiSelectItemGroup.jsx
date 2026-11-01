/**
 * @fileoverview MultiSelectItemGroup component.
 * Allows clicking and selecting multiple item groups with search, Select All / Clear All,
 * removable chip tags, and clicking on a group chip to filter/focus on its items.
 */

import React, { useState, useRef, useEffect } from "react";

export default function MultiSelectItemGroup({
  itemGroups = [],
  selectedIds = [],
  onChange,
  products = [],
  placeholder = "Select Item Groups",
  className = "",
  disabled = false,
  activeGroupId = null,
  onSelectGroup = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedSet = new Set(selectedIds.map(Number));

  const toggleGroup = (id) => {
    const numId = Number(id);
    if (selectedSet.has(numId)) {
      onChange(selectedIds.filter((item) => Number(item) !== numId));
    } else {
      onChange([...selectedIds, numId]);
    }
  };

  const handleSelectAll = () => {
    onChange(itemGroups.map((g) => Number(g.id)));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const filteredGroups = searchQuery.trim()
    ? itemGroups.filter((g) =>
        String(g.group_name || "")
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      )
    : itemGroups;

  // Compute item counts per group if products are supplied
  const countsByGroup = React.useMemo(() => {
    const map = {};
    if (Array.isArray(products)) {
      for (const p of products) {
        if (p.item_group_id) {
          const gid = Number(p.item_group_id);
          map[gid] = (map[gid] || 0) + 1;
        }
      }
    }
    return map;
  }, [products]);

  const selectedCount = selectedIds.length;
  const allSelected =
    itemGroups.length > 0 && selectedCount === itemGroups.length;

  const totalSelectedItems = React.useMemo(() => {
    return selectedIds.reduce(
      (sum, id) => sum + (countsByGroup[Number(id)] || 0),
      0
    );
  }, [selectedIds, countsByGroup]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-[38px] px-3 py-1.5 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand flex items-center justify-between gap-2 text-sm transition-colors hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <div className="flex-1 truncate">
          {selectedCount === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : allSelected ? (
            <span className="font-medium text-slate-800">
              All Item Groups ({itemGroups.length})
            </span>
          ) : (
            <span className="font-medium text-slate-800">
              {selectedCount === 1
                ? itemGroups.find(
                    (g) => Number(g.id) === Number(selectedIds[0])
                  )?.group_name || "1 Group Selected"
                : `${selectedCount} Item Groups Selected`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          {selectedCount > 0 && (
            <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-brand/10 text-brand rounded-full">
              {selectedCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Selected Groups Chip Badges */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {selectedCount > 1 && onSelectGroup && (
            <button
              type="button"
              onClick={() => onSelectGroup(null)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all font-medium cursor-pointer select-none ${
                !activeGroupId || activeGroupId === "all"
                  ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
              }`}
              title="Show items from all selected groups"
            >
              <span>All Selected</span>
              <span className="text-[10px] opacity-80">({totalSelectedItems})</span>
            </button>
          )}

          {selectedIds.map((id) => {
            const group = itemGroups.find(
              (g) => Number(g.id) === Number(id)
            );
            if (!group) return null;
            const count = countsByGroup[Number(id)] || 0;
            const isActive =
              activeGroupId !== null &&
              activeGroupId !== undefined &&
              activeGroupId !== "all" &&
              Number(activeGroupId) === Number(id);

            return (
              <span
                key={id}
                onClick={() => {
                  if (onSelectGroup) {
                    onSelectGroup(isActive ? null : Number(id));
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                  isActive
                    ? "bg-brand text-white border-brand shadow-sm ring-2 ring-brand/20 font-semibold"
                    : "bg-white text-slate-700 border-slate-300 hover:border-brand hover:text-brand hover:bg-brand/5 shadow-2xs"
                }`}
                title={`Click to show only items in ${group.group_name}`}
              >
                <span>{group.group_name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(id);
                    if (isActive && onSelectGroup) {
                      onSelectGroup(null);
                    }
                  }}
                  className={`font-bold ml-0.5 rounded-full p-0.5 focus:outline-none transition-colors ${
                    isActive
                      ? "text-white/80 hover:text-white hover:bg-white/20"
                      : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                  }`}
                  title={`Remove ${group.group_name}`}
                >
                  &times;
                </button>
              </span>
            );
          })}

          {selectedCount > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
                if (onSelectGroup) onSelectGroup(null);
              }}
              className="text-[11px] text-red-500 hover:text-red-700 font-medium underline px-1.5 ml-1 select-none"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden min-w-[280px]">
          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Search item groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Quick select buttons */}
          <div className="px-3 py-1.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-brand hover:underline font-medium"
            >
              Select All ({itemGroups.length})
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-400 hover:text-red-600 font-medium"
            >
              Clear Selection
            </button>
          </div>

          {/* Group Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {filteredGroups.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">
                No matching item groups found
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isChecked = selectedSet.has(Number(g.id));
                const count = countsByGroup[Number(g.id)];
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer select-none transition-colors ${
                      isChecked ? "bg-brand/5" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleGroup(g.id)}
                      className="rounded border-gray-300 text-brand focus:ring-brand h-4 w-4"
                    />
                    <span
                      className={`flex-1 text-xs ${
                        isChecked ? "font-semibold text-brand" : "text-slate-700"
                      }`}
                    >
                      {g.group_name}
                    </span>
                    {count !== undefined && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {count} items
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
