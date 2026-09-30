/**
 * @fileoverview RequestForQuotationForm component.
 * Provides functionality for RequestForQuotationForm.
 */

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { format } from "date-fns";
import { Printer, Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RequestForQuotationForm() {
  // Form State
  const [formData, setFormData] = useState({
    rfq_no: "",
    rfq_date: format(new Date(), "yyyy-MM-dd"),
    expiry_date: "",
    status: "DRAFT",
    delivery_terms: "FOB",
    terms_conditions:
      "1. Price validity: 30 days from quote date\n2. Delivery: As per agreed schedule\n3. Payment terms: Net 30 days\n4. Quality standards must be met\n5. All prices should be quoted in GHS",
  });

  const [items, setItems] = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);

  // Data State
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [itemQueries, setItemQueries] = useState({});

  // Modal State
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const pdfRef = useRef(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    if (isEdit) {
      loadRfq();
    }
  }, [id, isEdit]);

  // Populate RFQ number when form is opened (for new records)
  useEffect(() => {
    if (isEdit) return;

    api
      .get("/purchase/rfqs/next-no")
      .then((res) => {
        if (res.data?.nextNo) {
          setFormData((prev) => ({ ...prev, rfq_no: res.data.nextNo }));
        }
      })
      .catch((err) => console.error("Failed to load next RFQ number", err));
  }, [isEdit]);

  const loadDependencies = async () => {
    try {
      const [suppliersRes, itemsRes, uomsRes] = await Promise.all([
        api.get("/purchase/suppliers?active=true"),
        api.get("/inventory/items"),
        api.get("/inventory/uoms"),
      ]);
      setAllSuppliers(suppliersRes.data.items || []);
      setAllItems(itemsRes.data.items || []);
      setUoms(uomsRes.data.items || []);
    } catch (err) {
      console.error("Failed to load dependencies", err);
    }
  };

  const loadRfq = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/purchase/rfqs/${id}`);
      const { item, items: rfqItems, suppliers: rfqSuppliers } = res.data;

      setFormData({
        rfq_no: item.rfq_no,
        rfq_date: item.rfq_date
          ? format(new Date(item.rfq_date), "yyyy-MM-dd")
          : "",
        expiry_date: item.expiry_date
          ? format(new Date(item.expiry_date), "yyyy-MM-dd")
          : "",
        status: item.status,
        delivery_terms: item.delivery_terms || "FOB",
        terms_conditions: item.terms_conditions || "",
      });

      setItems(
        rfqItems.map((i) => ({
          ...i,
          required_date: i.required_date
            ? format(new Date(i.required_date), "yyyy-MM-dd")
            : "",
        })),
      );

      setSelectedSuppliers(
        rfqSuppliers.map((s) => ({
          id: s.supplier_id,
          supplier_name: s.supplier_name,
          email: s.email,
          phone: s.phone,
        })),
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load RFQ");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleItemSelect = (index, itemId) => {
    const selectedItem = allItems.find((i) => i.id === Number(itemId));
    if (selectedItem) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        item_id: selectedItem.id,
        item_name: selectedItem.item_name,
        uom: selectedItem.uom || "PCS",
      };
      setItems(newItems);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        item_name: "",
        qty: 0,
        uom: "PCS",
        required_date: "",
        specifications: "",
      },
    ]);
  };

  const deleteItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const toggleSupplier = (supplier) => {
    const exists = selectedSuppliers.find((s) => s.id === supplier.id);
    if (exists) {
      setSelectedSuppliers(
        selectedSuppliers.filter((s) => s.id !== supplier.id),
      );
    } else {
      setSelectedSuppliers([...selectedSuppliers, supplier]);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return allSuppliers;
    return allSuppliers.filter(
      (s) =>
        s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        (s.email &&
          s.email.toLowerCase().includes(supplierSearch.toLowerCase())),
    );
  }, [allSuppliers, supplierSearch]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const el = pdfRef.current;
    if (!el) return;
    const original = el.style.cssText;
    el.style.cssText =
      original +
      ";position:fixed;left:-10000px;top:0;display:block;z-index:-1;background:white;width:794px;padding:32px;";
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let rendered = 0;
      while (rendered < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -rendered, imgWidth, imgHeight);
        rendered += pageHeight;
        if (rendered < imgHeight) pdf.addPage();
      }
      const fname =
        "RFQ_" +
        (formData.rfq_no || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      el.style.cssText = original;
    }
  };

  const handleSubmit = async (newStatus = null) => {
    if (!formData.rfq_date) {
      alert("RFQ Date is required");
      return;
    }

    if (items.length === 0) {
      alert("Please add at least one item to the RFQ");
      return;
    }

    const invalidItems = items.filter(
      (item) => !item.item_name || !item.qty || Number(item.qty) <= 0,
    );

    if (invalidItems.length > 0) {
      alert("All items must have a name and quantity greater than 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        rfq_no: formData.rfq_no || null,
        status: newStatus || formData.status,
        items: items,
        supplier_ids: selectedSuppliers.map((s) => s.id),
      };

      if (isEdit) {
        await api.put(`/purchase/rfqs/${id}`, payload);
      } else {
        const res = await api.post("/purchase/rfqs", payload);
        if (res.data.id && !isEdit) {
          // continue to inline success then redirect to list
        }
      }

      if (newStatus) {
        setFormData((prev) => ({ ...prev, status: newStatus }));
      }

      setSuccessMessage("RFQ Saved Successfully");
      setTimeout(() => {
        navigate("/purchase/rfqs");
      }, 1000);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to save RFQ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="print:hidden">
        {successMessage && (
          <div className="mb-3 p-3 rounded border border-green-300 bg-green-100 text-green-700">
            {successMessage}
          </div>
        )}
        <div className="bg-gradient-to-r from-[#0E3646] to-[#1a5570] p-6 rounded-xl text-white shadow-lg">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span>📨</span> Request for Quotation (RFQ)
          </h1>
          <p className="opacity-90 text-sm mt-1">
            Create and send RFQs to suppliers for competitive bidding
          </p>
        </div>

        <div className="flex flex-wrap gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <button
            onClick={() => navigate("/purchase/rfqs")}
            className="px-4 py-2  text-white rounded transition flex items-center gap-2 ml-auto btn-success"
          >
            Back
          </button>
          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* RFQ Information */}
          <section>
            <div className="flex items-center gap-2 border-b-2 border-[#0E3646] pb-2 mb-4">
              <h2 className="text-lg font-semibold text-[#0E3646]">
                📋 RFQ Information
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-[#0E3646]">
                  RFQ Number
                </label>
                <input
                  type="text"
                  value={formData.rfq_no}
                  readOnly
                  className="p-2 border border-gray-300 rounded bg-gray-100 text-gray-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-[#0E3646] after:content-['*'] after:text-red-500">
                  RFQ Date
                </label>
                <input
                  type="date"
                  id="rfq_date"
                  value={formData.rfq_date}
                  onChange={handleInputChange}
                  className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0E3646] focus:border-transparent outline-none"
                
                  disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-[#0E3646]">
                  Expiry Date
                </label>
                <input
                  type="date"
                  id="expiry_date"
                  value={formData.expiry_date}
                  onChange={handleInputChange}
                  className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0E3646] focus:border-transparent outline-none"
                
                  disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-[#0E3646]">
                  Status
                </label>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold w-fit ${
                    formData.status === "SENT"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {formData.status}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-[#0E3646]">
                  Delivery Terms
                </label>
                <select
                  id="delivery_terms"
                  value={formData.delivery_terms}
                  onChange={handleInputChange}
                  className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0E3646] focus:border-transparent outline-none"
                >
                  <option value="FOB">FOB - Free on Board</option>
                  <option value="CIF">CIF - Cost, Insurance & Freight</option>
                  <option value="EXW">EXW - Ex Works</option>
                  <option value="DDP">DDP - Delivered Duty Paid</option>
                </select>
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-2 flex flex-col gap-1">
                <label className="text-sm font-semibold text-[#0E3646]">
                  Terms & Conditions
                </label>
                <textarea
                  id="terms_conditions"
                  value={formData.terms_conditions}
                  onChange={handleInputChange}
                  rows="3"
                  className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0E3646] focus:border-transparent outline-none"
                  placeholder="Enter terms and conditions..."
                />
              </div>
            </div>
          </section>

          {/* Selected Suppliers */}
          <section>
            <div className="flex items-center justify-between border-b-2 border-[#0E3646] pb-2 mb-4">
              <h2 className="text-lg font-semibold text-[#0E3646]">
                👥 Selected Suppliers ({selectedSuppliers.length})
              </h2>
              <div className="flex items-center gap-3">
                <select 
                  className="p-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#0E3646] outline-none"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const supplier = allSuppliers.find((s) => String(s.id) === val);
                    if (supplier && !selectedSuppliers.find((s) => s.id === supplier.id)) {
                      toggleSupplier(supplier);
                    }
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Quick Add Supplier...</option>
                  {allSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name} {s.supplier_code ? `(${s.supplier_code})` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-400">or</span>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="px-3 py-1.5 bg-[#17a2b8] text-white text-sm rounded hover:bg-cyan-700 transition flex items-center gap-2"
                >
                  Browse Directory
                </button>
              </div>
            </div>

            {selectedSuppliers.length === 0 ? (
              <div className="text-center p-8 bg-gray-50 rounded border border-dashed border-gray-300 text-gray-500">
                No suppliers selected. Click "Select Suppliers" to add.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedSuppliers.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white border-2 border-gray-200 rounded p-4 relative hover:border-[#0E3646] transition group"
                  >
                    <button
                      onClick={() => toggleSupplier(s)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                    <div className="font-semibold text-[#0E3646]">
                      {s.supplier_name}
                      {s.supplier_code && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({s.supplier_code})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      {s.contact_person && (
                        <div className="flex items-center gap-2">
                          👤 {s.contact_person}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        📧 {s.email || "N/A"}
                      </div>
                      <div className="flex items-center gap-2">
                        📞 {s.phone || "N/A"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Items Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[#0E3646]">
                  📦 RFQ Items
                </h2>
              </div>
              <button
                onClick={addItem}
                className="px-3 py-1 bg-[#0E3646] text-white text-sm rounded hover:bg-[#082330] transition"
              >
                ➕ Add Item
              </button>
            </div>

            <div
              className="border border-gray-200 rounded-lg"
              style={{ overflow: "visible" }}
            >
              <table className="w-full text-sm text-left">
                <thead className="bg-[#0E3646] text-white">
                  <tr>
                    <th className="p-3 w-12">#</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3 w-32">Quantity</th>
                    <th className="p-3 w-24">UOM</th>
                    <th className="p-3 w-40">Required Date</th>
                    <th className="p-3 w-64">Specifications</th>
                    <th className="p-3 w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-500">
                        No items added. Click "Add Item" to start.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="p-3">{idx + 1}</td>
                        <td className="p-3">
                          <div className="relative">
                            <input
                              id={`rfq-item-search-${idx}`} autoComplete="off"
                              className="w-full p-1 border border-gray-300 rounded focus:ring-2 focus:ring-[#0E3646] focus:border-transparent outline-none"
                              placeholder="Scan barcode or type item name"
                              value={itemQueries[idx] !== undefined ? itemQueries[idx] : (item.item_name || "")}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemQueries((prev) => ({
                                  ...prev,
                                  [idx]: val,
                                }));
                                if (item.item_id) {
                                  const newItems = [...items];
                                  newItems[idx] = {
                                    ...newItems[idx],
                                    item_id: "",
                                    item_name: "",
                                    uom: "PCS",
                                  };
                                  setItems(newItems);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const query = (itemQueries[idx] || "").trim();
                                  const results = query
                                    ? filterByPrefix(allItems, {
                                        query,
                                        searchFields: [
                                          "item_code",
                                          "item_name",
                                          "barcode",
                                        ],
                                      })
                                    : [];
                                  if (!query || !results.length) return;
                                  handleItemSelect(idx, String(results[0].id));
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [idx]: results[0].item_name,
                                  }));
                                }
                              }}
                            />
                            {(() => {
                              const query = (itemQueries[idx] || "").trim();
                              const results = query
                                ? filterByPrefix(allItems, {
                                    query,
                                    searchFields: [
                                      "item_code",
                                      "item_name",
                                      "barcode",
                                    ],
                                  })
                                : [];
                              return results.length && !item.item_id ? (
                                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto">
                                  {results.map((o) => (
                                    <button
                                      type="button"
                                      key={o.id}
                                      className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                      onClick={() => {
                                        handleItemSelect(idx, String(o.id));
                                        setItemQueries((prev) => ({
                                          ...prev,
                                          [idx]: o.item_name,
                                        }));
                                      }}
                                    >
                                      {o.item_code} - {o.item_name}
                                    </button>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) =>
                              handleItemChange(idx, "qty", e.target.value)
                            }
                            className="w-full p-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={item.uom || ""}
                            onChange={(e) =>
                              handleItemChange(idx, "uom", e.target.value)
                            }
                            className="w-full p-1 border border-gray-300 rounded focus:ring-2 focus:ring-[#0E3646] focus:border-transparent outline-none"
                          >
                            <option value="">Select UOM</option>
                            {uoms.map((u) => (
                              <option key={u.id} value={u.uom_code}>
                                {u.uom_name} ({u.uom_code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="date"
                            value={item.required_date || ""}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "required_date",
                                e.target.value,
                              )
                            }
                            className="w-full p-1 border border-gray-300 rounded"
                          
                            disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.specifications || ""}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "specifications",
                                e.target.value,
                              )
                            }
                            className="w-full p-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => deleteItem(idx)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded transition"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (
                  window.confirm("Are you sure? Unsaved changes will be lost.")
                ) {
                  setItems([]);
                  setSelectedSuppliers([]);
                  setFormData((prev) => ({ ...prev, terms_conditions: "" }));
                }
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              🔄 Clear
            </button>
            <button
              onClick={() => handleSubmit("DRAFT")}
              disabled={saving}
              className="px-4 py-2 bg-[#0E3646] text-white rounded hover:bg-[#082330] transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "💾 Save as Draft"}
            </button>
            <button
              onClick={() => handleSubmit("SENT")}
              disabled={saving}
              className="px-4 py-2 bg-[#28a745] text-white rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              {saving ? "Sending..." : "📤 Send RFQ to Suppliers"}
            </button>
          </div>
        </div>

        {/* Supplier Selection Modal */}
        {showSupplierModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-6 bg-[#0E3646] text-white rounded-t-xl flex justify-between items-center">
                <h3 className="text-xl font-bold">Select Suppliers</h3>
                <button
                  onClick={() => setShowSupplierModal(false)}
                  className="text-white hover:bg-white/10 w-8 h-8 rounded flex items-center justify-center text-xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="🔍 Search suppliers..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E3646] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSuppliers.map((supplier) => {
                    const isSelected = selectedSuppliers.some(
                      (s) => s.id === supplier.id,
                    );
                    return (
                      <div
                        key={supplier.id}
                        onClick={() => toggleSupplier(supplier)}
                        className={`
                        border-2 rounded-lg p-4 cursor-pointer transition
                        ${
                          isSelected
                            ? "border-[#0E3646] bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }
                      `}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`
                          w-5 h-5 rounded border flex items-center justify-center mt-1
                          ${
                            isSelected
                              ? "bg-[#0E3646] border-[#0E3646]"
                              : "border-gray-400 bg-white"
                          }
                        `}
                          >
                            {isSelected && (
                              <span className="text-white text-xs">✓</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-[#0E3646]">
                              {supplier.supplier_name}
                              {supplier.supplier_code && (
                                <span className="text-xs text-gray-500 ml-2 font-normal">
                                  ({supplier.supplier_code})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1 space-y-1">
                              {supplier.contact_person && (
                                <div className="flex items-center gap-2">
                                  👤 {supplier.contact_person}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                📧 {supplier.email || "N/A"}
                              </div>
                              <div className="flex items-center gap-2">
                                📞 {supplier.phone || "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredSuppliers.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No suppliers found matching "{supplierSearch}"
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => setShowSupplierModal(false)}
                  className="px-6 py-2 bg-[#0E3646] text-white rounded hover:bg-[#082330] transition font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="hidden print:block p-8 max-w-[19cm] mx-auto bg-white border border-gray-300">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xl font-semibold text-[#0E3646]">
              Request for Quotation
            </div>
            <div className="text-sm text-gray-600">
              RFQ Number: {formData.rfq_no || ""}
            </div>
          </div>
          <div className="text-right text-sm text-gray-700">
            <div>Date: {formData.rfq_date || ""}</div>
            <div>Expiry Date: {formData.expiry_date || ""}</div>
            <div>Status: {formData.status}</div>
            <div>Delivery Terms: {formData.delivery_terms}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="font-semibold text-[#0E3646] mb-2">
            Selected Suppliers
          </div>
          {selectedSuppliers.length === 0 ? (
            <div className="text-sm text-gray-600">No suppliers selected.</div>
          ) : (
            <table className="w-full text-xs border border-gray-400">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Supplier
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Email
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedSuppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="border border-gray-400 px-2 py-1">
                      {s.supplier_name}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {s.email || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {s.phone || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mb-6">
          <div className="font-semibold text-[#0E3646] mb-2">RFQ Items</div>
          {items.length === 0 ? (
            <div className="text-sm text-gray-600">No items added.</div>
          ) : (
            <table className="w-full text-xs border border-gray-400">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    #
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Item
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-right">
                    Qty
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    UOM
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Required Date
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Specifications
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-400 px-2 py-1">
                      {idx + 1}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.item_name || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-right">
                      {item.qty || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.uom || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.required_date || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.specifications || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="font-semibold text-[#0E3646] mb-2">
            Terms and Conditions
          </div>
          <div className="text-sm whitespace-pre-line">
            {formData.terms_conditions || "None"}
          </div>
        </div>
      </div>

      <div
        ref={pdfRef}
        className="hidden p-8 bg-white"
        style={{ width: "794px", maxWidth: "794px" }}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xl font-semibold text-[#0E3646]">
              Request for Quotation
            </div>
            <div className="text-sm text-gray-600">
              RFQ Number: {formData.rfq_no || ""}
            </div>
          </div>
          <div className="text-right text-sm text-gray-700">
            <div>Date: {formData.rfq_date || ""}</div>
            <div>Expiry Date: {formData.expiry_date || ""}</div>
            <div>Status: {formData.status}</div>
            <div>Delivery Terms: {formData.delivery_terms}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="font-semibold text-[#0E3646] mb-2">
            Selected Suppliers
          </div>
          {selectedSuppliers.length === 0 ? (
            <div className="text-sm text-gray-600">No suppliers selected.</div>
          ) : (
            <table className="w-full text-xs border border-gray-400">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Supplier
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Email
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedSuppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="border border-gray-400 px-2 py-1">
                      {s.supplier_name}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {s.email || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {s.phone || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mb-6">
          <div className="font-semibold text-[#0E3646] mb-2">RFQ Items</div>
          {items.length === 0 ? (
            <div className="text-sm text-gray-600">No items added.</div>
          ) : (
            <table className="w-full text-xs border border-gray-400">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    #
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Item
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-right">
                    Qty
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    UOM
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Required Date
                  </th>
                  <th className="border border-gray-400 px-2 py-1 text-left">
                    Specifications
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-400 px-2 py-1">
                      {idx + 1}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.item_name || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-right">
                      {item.qty || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.uom || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.required_date || ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {item.specifications || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="font-semibold text-[#0E3646] mb-2">
            Terms and Conditions
          </div>
          <div className="text-sm whitespace-pre-line">
            {formData.terms_conditions || "None"}
          </div>
        </div>
      </div>
    </div>
  );
}
