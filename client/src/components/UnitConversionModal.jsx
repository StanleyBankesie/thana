/**
 * @fileoverview Modal component for unit of measurement (UOM) conversions.
 * Fetches conversion rules and calculates equivalent values for inventory operations.
 */

import React, { useEffect, useMemo, useState } from "react";
import { api } from "api/client";

/**
 * UnitConversionModal component
 * Provides an interface to convert quantities between different units of measurement based on active conversion rules.
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open.
 * @param {Function} props.onClose - Callback to close the modal.
 * @param {number|string} props.itemId - The inventory item ID for targeted conversions.
 * @param {string} props.defaultUom - Default target unit of measurement.
 * @param {string} props.currentUom - Currently selected unit of measurement.
 * @param {Array|null} props.conversions - Preloaded array of conversion rules (optional).
 * @param {Function} props.onApply - Callback when conversion is confirmed.
 * @returns {JSX.Element|null} The modal element or null if closed.
 */
export default function UnitConversionModal({
  open,
  onClose,
  itemId,
  defaultUom = "",
  currentUom = "",
  conversions = null,
  onApply,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [convList, setConvList] = useState(
    Array.isArray(conversions) ? conversions : [],
  );
  const [valueToConvert, setValueToConvert] = useState("");
  const [fromUom, setFromUom] = useState(currentUom || "");
  const [toUom, setToUom] = useState(defaultUom || "");

  useEffect(() => {
    setError("");
    setValueToConvert("");
    setFromUom(currentUom || "");
    setToUom(defaultUom || "");
  }, [itemId, currentUom, defaultUom, open]);

  useEffect(() => {
    if (!open) return;
    if (Array.isArray(conversions)) {
      setConvList(conversions);
      return;
    }
    let mounted = true;
    setLoading(true);
    api
      .get("/inventory/unit-conversions")
      .then((res) => {
        if (!mounted) return;
        setConvList(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load conversions");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, conversions]);

  const itemConversions = useMemo(() => {
    const id = itemId ? Number(itemId) : null;
    const list = Array.isArray(convList) ? convList : [];
    return id ? list.filter((c) => Number(c.item_id) === id) : [];
  }, [convList, itemId]);

  const fromOptions = useMemo(() => {
    const s = new Set();
    for (const c of itemConversions) {
      if (Number(c.is_active)) s.add(String(c.from_uom));
    }
    return Array.from(s);
  }, [itemConversions]);

  const toOptions = useMemo(() => {
    const s = new Set();
    for (const c of itemConversions) {
      if (Number(c.is_active)) s.add(String(c.to_uom));
    }
    return Array.from(s);
  }, [itemConversions]);

  const factor = useMemo(() => {
    const c = itemConversions.find(
      (x) =>
        Number(x.is_active) &&
        String(x.from_uom) === String(fromUom || "") &&
        String(x.to_uom) === String(toUom || ""),
    );
    const f = Number(c?.conversion_factor || 0);
    return Number.isFinite(f) && f > 0 ? f : null;
  }, [itemConversions, fromUom, toUom]);

  const result = useMemo(() => {
    const v = Number(valueToConvert);
    if (!Number.isFinite(v) || v <= 0 || !factor) return null;
    return v * factor;
  }, [valueToConvert, factor]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow max-w-xl w-full">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Unit Conversion</h2>
          <button className="btn-outline" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="p-5">
          {error ? (
            <div className="text-sm text-red-600 mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">From Unit</label>
              <select
                className="input"
                value={fromUom}
                onChange={(e) => setFromUom(e.target.value)}
              >
                <option value="">Select unit</option>
                {fromOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">To Unit</label>
              <select
                className="input"
                value={toUom}
                onChange={(e) => setToUom(e.target.value)}
              >
                <option value="">Select unit</option>
                {toOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Factor</label>
              <input
                type="text"
                className="input"
                value={factor != null ? String(factor) : ""}
                readOnly
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">Value to Convert</label>
              <input
                type="number"
                step="0.000001"
                className="input"
                value={valueToConvert}
                onChange={(e) => setValueToConvert(e.target.value)}
              />
              <div className="text-xs text-slate-500 mt-1">
                {factor
                  ? `1 ${fromUom || ""} = ${factor} ${toUom || ""}`
                  : "Select valid From and To units"}
              </div>
            </div>
            <div className="flex items-end">
              <div className="w-full">
                <div className="label">Result</div>
                <div className="p-3 border-2 rounded text-center text-lg font-semibold">
                  {result != null
                    ? `${valueToConvert || 0} ${fromUom || ""} = ${result} ${toUom || ""}`
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>
            Close
          </button>
          <button
            className="btn-success"
            disabled={
              !onApply ||
              !factor ||
              !Number.isFinite(Number(valueToConvert)) ||
              Number(valueToConvert) <= 0
            }
            onClick={() => {
              if (!onApply) return;
              onApply({
                item_id: itemId,
                from_uom: fromUom,
                to_uom: toUom,
                input_qty: valueToConvert,
                converted_qty: result,
              });
              onClose && onClose();
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
