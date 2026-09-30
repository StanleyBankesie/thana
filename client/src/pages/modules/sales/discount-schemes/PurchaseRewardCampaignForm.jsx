/**
 * @fileoverview PurchaseRewardCampaignForm component.
 * Provides functionality for PurchaseRewardCampaignForm.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import { filterByPrefix } from "../../../../utils/searchUtils";
import "./DiscountSchemeList.css";
import { usePermission } from "@/auth/PermissionContext.jsx";

function ItemPicker({ items, selectedIds, onChange, label }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(
    () => filterByPrefix(items, { query: search.trim(), searchFields: ["item_code", "item_name"] }),
    [items, search],
  );

  const sel = useMemo(
    () => new Set(selectedIds.map((id) => String(id).trim()).filter(Boolean)),
    [selectedIds],
  );

  const toggle = useCallback(
    (id) => {
      const strId = String(id);
      const next = new Set(sel);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      onChange(Array.from(next).join(","));
    },
    [sel, onChange],
  );

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const rect = open && results.length > 0 ? inputRef.current?.getBoundingClientRect() : null;

  return (
    <div ref={ref} className="ds-autocomplete-picker">
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        placeholder={`Search ${label.toLowerCase()}...`}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length > 0) {
            e.preventDefault();
            toggle(results[0].id);
            setSearch("");
            inputRef.current?.focus();
          }
        }}
      />
      {open && results.length > 0 && rect && (
        <div
          className="ds-autocomplete-dropdown"
          style={{ position: "fixed", top: `${rect.bottom + 4}px`, left: `${rect.left}px`, width: `${rect.width}px`, zIndex: 9999 }}
        >
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ds-autocomplete-item ${sel.has(String(item.id)) ? "ds-autocomplete-item-selected" : ""}`}
              onClick={() => { toggle(item.id); setSearch(""); inputRef.current?.focus(); }}
            >
              <span className="ds-autocomplete-check">
                {sel.has(String(item.id)) ? "✓" : ""}
              </span>
              <span>{item.item_code} - {item.item_name}</span>
            </button>
          ))}
        </div>
      )}
      {sel.size > 0 && (
        <div className="ds-selected-chips">
          {Array.from(sel).map((id) => {
            const item = items.find((i) => String(i.id) === id);
            return (
              <span key={id} className="ds-chip">
                {item ? `${item.item_code} - ${item.item_name}` : `#${id}`}
                <button type="button" className="ds-chip-remove" onClick={() => toggle(id)}>&times;</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PurchaseRewardCampaignForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [formData, setFormData] = useState({
    campaign_name: "",
    campaign_qty: "",
    effective_from: "",
    effective_to: "",
    status: "ACTIVE",
    rows: [{ item_ids: "", item_qty: "", free_item_ids: "", free_qty: "" }],
  });

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const itemsRes = await api.get("/inventory/items");
      setAllItems(itemsRes.data.items || []);

      if (isEdit) {
        const res = await api.get(`/sales/purchase-reward-campaigns/${id}`);
        const data = res.data;
        setFormData({
          campaign_name: data.campaign_name,
          campaign_qty: data.campaign_qty || "",
          effective_from: data.effective_from ? data.effective_from.split("T")[0] : "",
          effective_to: data.effective_to ? data.effective_to.split("T")[0] : "",
          status: data.is_active ? "ACTIVE" : "INACTIVE",
          rows: data.rows?.length
            ? data.rows.map((r) => ({
                item_ids: r.item_ids || "",
                item_qty: r.item_qty || "",
                free_item_ids: r.free_item_ids || "",
                free_qty: r.free_qty || "",
              }))
            : [{ item_ids: "", item_qty: "", free_item_ids: "", free_qty: "" }],
        });
      }
    } catch (err) {
      toast.error("Failed to load data");
      if (isEdit) navigate("/sales/discount-schemes/purchase-reward");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleRowChange = (index, field, value) => {
    setFormData((p) => {
      const rows = [...p.rows];
      rows[index] = { ...rows[index], [field]: value };
      return { ...p, rows };
    });
  };

  const addRow = () => {
    setFormData((p) => ({
      ...p,
      rows: [...p.rows, { item_ids: "", item_qty: "", free_item_ids: "", free_qty: "" }],
    }));
  };

  const removeRow = (index) => {
    setFormData((p) => ({
      ...p,
      rows: p.rows.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...formData,
        is_active: formData.status === "ACTIVE" ? 1 : 0,
      };

      if (isEdit) {
        await api.put(`/sales/purchase-reward-campaigns/${id}`, payload);
        toast.success("Purchase reward campaign updated");
      } else {
        await api.post("/sales/purchase-reward-campaigns", payload);
        toast.success("Purchase reward campaign created");
      }
      navigate("/sales/discount-schemes/purchase-reward");
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="promo-campaign-container">
      <header className="ds-header">
        <div className="ds-header-top">
          <div>
            <h1>{isEdit ? "Edit Purchase Reward Campaign" : "New Purchase Reward Campaign"}</h1>
            <p>Buy X items, get the same or another item free as a reward</p>
          </div>
          <div className="ds-header-actions">
            <button onClick={() => window.history.back()} className="ds-btn ds-btn-secondary">
              Back to Campaigns
            </button>
          </div>
        </div>
      </header>

      <div className="ds-card">
        <form onSubmit={handleSubmit}>
          <div className="ds-form-row">
            <div className="ds-form-group">
              <label>Campaign Name *</label>
              <input name="campaign_name" value={formData.campaign_name} onChange={handleChange} required />
            </div>
            <div className="ds-form-group">
              <label>Campaign Qty *</label>
              <input type="number" name="campaign_qty" value={formData.campaign_qty} onChange={handleChange} step="0.01" min="0" required />
            </div>
          </div>

          <div className="ds-form-row">
            <div className="ds-form-group">
              <label>Valid From *</label>
              <input type="date" name="effective_from" value={formData.effective_from} onChange={handleChange} required 
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div className="ds-form-group">
              <label>Valid To</label>
              <input type="date" name="effective_to" value={formData.effective_to} onChange={handleChange} 
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>

          <div className="ds-form-group">
            <label>Status *</label>
            <select name="status" value={formData.status} onChange={handleChange} required>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="ds-form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <label style={{ margin: 0 }}>Campaign Items</label>
              <button type="button" className="ds-btn ds-btn-primary" onClick={addRow}>
                + Add Row
              </button>
            </div>
            {formData.rows.map((row, index) => (
              <div key={index} className="ds-purchase-reward-row">
                <div className="ds-purchase-reward-row-inner">
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Purchase Items</label>
                    <ItemPicker
                      items={allItems}
                      selectedIds={row.item_ids ? row.item_ids.split(",").filter(Boolean) : []}
                      onChange={(val) => handleRowChange(index, "item_ids", val)}
                      label="Purchase Items"
                    />
                  </div>
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Purchase Qty</label>
                    <input type="number" value={row.item_qty} onChange={(e) => handleRowChange(index, "item_qty", e.target.value)} step="0.01" min="0" required />
                  </div>
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Free Items</label>
                    <ItemPicker
                      items={allItems}
                      selectedIds={row.free_item_ids ? row.free_item_ids.split(",").filter(Boolean) : []}
                      onChange={(val) => handleRowChange(index, "free_item_ids", val)}
                      label="Free Items"
                    />
                  </div>
                  <div className="ds-form-group" style={{ marginBottom: 0 }}>
                    <label>Free Qty</label>
                    <input type="number" value={row.free_qty} onChange={(e) => handleRowChange(index, "free_qty", e.target.value)} step="0.01" min="0" required />
                  </div>
                  <button
                    type="button"
                    className="ds-btn ds-btn-danger"
                    style={{ alignSelf: "flex-end", padding: "8px 12px" }}
                    onClick={() => removeRow(index)}
                    disabled={formData.rows.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="ds-action-buttons">
            <button type="submit" className="ds-btn ds-btn-success" disabled={saving}>
              {saving ? "Saving..." : "💾 Save Campaign"}
            </button>
            <button onClick={() => window.history.back()} className="ds-btn ds-btn-secondary">
              ✖ Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
