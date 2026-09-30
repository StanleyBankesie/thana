/**
 * @fileoverview CampaignForm component.
 * Provides functionality for CampaignForm.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import "./DiscountSchemeList.css";
import { usePermission } from "@/auth/PermissionContext.jsx";

const initialFormState = {
  scheme_code: "",
  scheme_name: "",
  discount_type: "",
  discount_value: "",
  effective_from: "",
  effective_to: "",
  min_quantity: "",
  max_quantity: "",
  description: "",
  status: "ACTIVE",
  itemIds: [],
};

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CampaignForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [items, setItems] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [itemsRes, groupsRes] = await Promise.all([
        api.get("/inventory/items"),
        api.get("/inventory/item-groups"),
      ]);
      setItems(itemsRes.data.items || []);
      setItemGroups(groupsRes.data?.items || []);

      if (isEdit) {
        const res = await api.get(`/sales/discount-schemes/${id}`);
        const data = res.data;
        setFormData({
          scheme_code: data.scheme_code,
          scheme_name: data.scheme_name,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          effective_from: data.effective_from
            ? data.effective_from.split("T")[0]
            : "",
          effective_to: data.effective_to
            ? data.effective_to.split("T")[0]
            : "",
          min_quantity: data.min_quantity || "",
          max_quantity: data.max_quantity || "",
          description: data.description || "",
          status: data.is_active ? "ACTIVE" : "INACTIVE",
          itemIds: data.items ? data.items.map((i) => i.id) : [],
        });
      } else {
        const autoCode = "DSC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
        setFormData((p) => ({ ...p, scheme_code: autoCode }));
      }
    } catch (err) {
      toast.error("Failed to load data");
      if (isEdit) navigate("/sales/discount-schemes/discount");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const toggleItem = (itemId) => {
    setFormData((p) => {
      const current = p.itemIds || [];
      if (current.includes(itemId)) {
        return { ...p, itemIds: current.filter((id) => id !== itemId) };
      } else {
        return { ...p, itemIds: [...current, itemId] };
      }
    });
  };

  const filteredItems = useMemo(() => {
    const groupId = Number(selectedGroupId);
    const groupFiltered = groupId
      ? items.filter((p) => Number(p.item_group_id) === groupId)
      : [];
    if (!itemSearch) return groupFiltered;
    const lower = itemSearch.toLowerCase();
    return groupFiltered.filter(
      (i) =>
        i.item_code.toLowerCase().includes(lower) ||
        i.item_name.toLowerCase().includes(lower),
    );
  }, [items, itemSearch, selectedGroupId]);

  useEffect(() => {
    if (selectAll && filteredItems.length) {
      setFormData((p) => ({
        ...p,
        itemIds: Array.from(new Set([...p.itemIds, ...filteredItems.map((i) => i.id)])),
      }));
    } else if (!selectAll) {
      setFormData((p) => ({
        ...p,
        itemIds: p.itemIds.filter((id) => !filteredItems.some((i) => i.id === id)),
      }));
    }
  }, [selectAll, filteredItems]);

  useEffect(() => {
    setSelectAll(false);
  }, [selectedGroupId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...formData,
        is_active: formData.status === "ACTIVE" ? 1 : 0,
      };

      if (isEdit) {
        await api.put(`/sales/discount-schemes/${id}`, payload);
        toast.success("Campaign updated");
      } else {
        await api.post("/sales/discount-schemes/discount", payload);
        toast.success("Campaign created");
      }
      navigate("/sales/discount-schemes/discount");
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
            <h1>{isEdit ? "Edit Campaign" : "New Campaign"}</h1>
            <p>{isEdit ? "Update campaign details" : "Create a new promotional campaign"}</p>
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
              <input
                name="scheme_name"
                value={formData.scheme_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="ds-form-row">
            <div className="ds-form-group">
              <label>Discount Type *</label>
              <select
                name="discount_type"
                value={formData.discount_type}
                onChange={handleChange}
                required
              >
                <option value="">Select Type</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>
            <div className="ds-form-group">
              <label>Discount Value *</label>
              <input
                type="number"
                name="discount_value"
                value={formData.discount_value}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div className="ds-form-row">
            <div className="ds-form-group">
              <label>Valid From *</label>
              <input
                type="date"
                name="effective_from"
                value={formData.effective_from}
                onChange={handleChange}
                required
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div className="ds-form-group">
              <label>Valid To</label>
              <input
                type="date"
                name="effective_to"
                value={formData.effective_to}
                onChange={handleChange}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>

          <div className="ds-form-row">
            <div className="ds-form-group">
              <label>Min Quantity</label>
              <input
                type="number"
                name="min_quantity"
                value={formData.min_quantity}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
            <div className="ds-form-group">
              <label>Max Quantity</label>
              <input
                type="number"
                name="max_quantity"
                value={formData.max_quantity}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div className="ds-form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
            ></textarea>
          </div>

          <div className="ds-form-group">
            <label>Status *</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="ds-form-group">
            <label>Item Group</label>
            <select
              value={selectedGroupId}
              onChange={(e) => { setSelectedGroupId(e.target.value); setItemSearch(""); }}
            >
              <option value="">Select Group</option>
              {itemGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.group_name}</option>
              ))}
            </select>
          </div>

          <div className="ds-form-group">
            <label>Linked Items</label>
            {selectedGroupId ? (
              <>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="mb-2"
                />
                <label className="ds-select-all">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => setSelectAll(e.target.checked)}
                  />
                  Select All ({filteredItems.length} items)
                </label>
                <div className="ds-item-selection">
                  {filteredItems.length === 0 ? (
                    <div className="p-2 text-gray-500 italic">No items in this group</div>
                  ) : (
                    filteredItems.slice(0, 100).map((item) => (
                      <div key={item.id} className="ds-item-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.itemIds.includes(item.id)}
                          onChange={() => { toggleItem(item.id); setSelectAll(false); }}
                        />
                        <span>
                          {item.item_code} - {item.item_name}
                        </span>
                      </div>
                    ))
                  )}
                  {filteredItems.length > 100 && (
                    <div className="p-2 text-gray-500 italic">
                      Showing first 100 matches...
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Selected: {formData.itemIds.length} items
                </div>
              </>
            ) : (
              <div className="p-2 text-gray-500 italic">Select an Item Group to view and select items</div>
            )}
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
