import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";

export default function VehicleComplianceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id && id !== "new";

  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [setupData, setSetupData] = useState({ ISSUING_AUTHORITY: [], POLICY_TYPE: [], INSURANCE_COMPANY: [] });
  
  const [formData, setFormData] = useState({
    vehicle_id: "",
    compliance_type: "",
    document_no: "",
    issue_date: "",
    expiry_date: "",
    reminder_days: 30,
    issuing_authority: "",
    policy_type: "",
    insurance_company: "",
    policy_no: "",
    premium_amount: 0,
    coverage_amount: 0,
    amount_fee: 0,
    payment_date: "",
    payment_reference: "",
    attachment_url: "",
    receipt_url: "",
    notes: "",
  });

  useEffect(() => {
    // Fetch vehicles
    api.get("/transport/vehicles").then(res => {
      const items = res.data?.data?.items || res.data?.items || [];
      setVehicles(items);
    }).catch(() => toast.error("Failed to load vehicles"));

    // Fetch setup items
    api.get("/transport/setup").then(res => {
      const items = res.data?.data?.items || [];
      const grouped = { ISSUING_AUTHORITY: [], POLICY_TYPE: [], INSURANCE_COMPANY: [] };
      items.forEach(item => {
        if (item.is_active && grouped[item.setup_type]) {
          grouped[item.setup_type].push(item);
        }
      });
      setSetupData(grouped);
    }).catch(console.error);
    
    if (isEdit) {
      setLoading(true);
      api.get(`/transport/compliance/${id}`).then(res => {
        const item = res.data?.item || res.data;
        if (item) {
          setFormData({
            vehicle_id: item.vehicle_id || "",
            compliance_type: item.compliance_type || "",
            document_no: item.document_no || "",
            issue_date: item.issue_date ? item.issue_date.split("T")[0] : "",
            expiry_date: item.expiry_date ? item.expiry_date.split("T")[0] : "",
            reminder_days: item.reminder_days || 30,
            issuing_authority: item.issuing_authority || "",
            policy_type: item.policy_type || "",
            insurance_company: item.insurance_company || "",
            policy_no: item.policy_no || "",
            premium_amount: item.premium_amount || 0,
            coverage_amount: item.coverage_amount || 0,
            amount_fee: item.amount_fee || 0,
            payment_date: item.payment_date ? item.payment_date.split("T")[0] : "",
            payment_reference: item.payment_reference || "",
            attachment_url: item.attachment_url || "",
            receipt_url: item.receipt_url || "",
            notes: item.notes || "",
          });
        }
      }).catch(() => {
        toast.error("Failed to load compliance record");
      }).finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "number" ? (value ? Number(value) : "") : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.issue_date && formData.expiry_date && new Date(formData.expiry_date) <= new Date(formData.issue_date)) {
      toast.error("Expiry date must be later than Issue date");
      return;
    }
    
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/transport/compliance/${id}`, formData);
        toast.success("Record updated successfully");
      } else {
        await api.post("/transport/compliance", formData);
        toast.success("Record created successfully");
      }
      navigate("/transport/compliance");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save record");
    } finally {
      setLoading(false);
    }
  };

  const isInsurance = formData.compliance_type === "Insurance";

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white flex items-center gap-4 rounded-t-lg">
          <button onClick={() => navigate("/transport/compliance")} className="btn btn-sm btn-secondary">
            <ArrowLeftOutlined /> Back
          </button>
          <div>
            <h2 className="text-xl font-bold">{isEdit ? "Edit" : "New"} Vehicle Compliance</h2>
            <p className="text-sm opacity-80">
              {isEdit ? "Update compliance details" : "Add a new compliance record"}
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* General Info */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-brand-700">General Information</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label required">Vehicle</label>
              <select name="vehicle_id" value={formData.vehicle_id} onChange={handleChange} required className="input">
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.reg_number} ({v.make} {v.model})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label required">Compliance Type</label>
              <select name="compliance_type" value={formData.compliance_type} onChange={handleChange} required className="input">
                <option value="">-- Select Type --</option>
                <option value="Insurance">Insurance</option>
                <option value="Roadworthy">Roadworthy</option>
                <option value="District Assembly License">District Assembly License</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Document Number</label>
              <input type="text" name="document_no" value={formData.document_no} onChange={handleChange} className="input" placeholder="e.g. DOC-12345" />
            </div>
            
            {!isInsurance && (
              <div className="form-group">
                <label className="form-label">Issuing Authority</label>
                <select
                  name="issuing_authority"
                  value={formData.issuing_authority}
                  onChange={handleChange}
                  className="input input-bordered w-full"
                >
                  <option value="">-- Select Authority --</option>
                  {setupData.ISSUING_AUTHORITY.map(opt => (
                    <option key={opt.id} value={opt.setup_value}>{opt.setup_value}</option>
                  ))}
                  {formData.issuing_authority && !setupData.ISSUING_AUTHORITY.find(o => o.setup_value === formData.issuing_authority) && (
                    <option value={formData.issuing_authority}>{formData.issuing_authority}</option>
                  )}
                </select>
              </div>
            )}

            {/* Issuance & Validity */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-brand-700">Issuance & Validity</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Issue Date</label>
              <input type="date" name="issue_date" value={formData.issue_date} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Renewal Reminder (Days)</label>
              <input type="number" name="reminder_days" value={formData.reminder_days} onChange={handleChange} className="input" />
            </div>

            {/* Insurance Information */}
            {isInsurance && (
              <>
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-brand-700">Insurance Information</h3>
                </div>
                <div className="form-group">
                  <label className="form-label">Policy Type</label>
                  <select name="policy_type" value={formData.policy_type} onChange={handleChange} className="input">
                    <option value="">-- Select Policy --</option>
                    {setupData.POLICY_TYPE.map(opt => (
                      <option key={opt.id} value={opt.setup_value}>{opt.setup_value}</option>
                    ))}
                    {formData.policy_type && !setupData.POLICY_TYPE.find(o => o.setup_value === formData.policy_type) && (
                      <option value={formData.policy_type}>{formData.policy_type}</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Insurance Company</label>
                  <select name="insurance_company" value={formData.insurance_company} onChange={handleChange} className="input">
                    <option value="">-- Select Insurance Company --</option>
                    {setupData.INSURANCE_COMPANY.map(opt => (
                      <option key={opt.id} value={opt.setup_value}>{opt.setup_value}</option>
                    ))}
                    {formData.insurance_company && !setupData.INSURANCE_COMPANY.find(o => o.setup_value === formData.insurance_company) && (
                      <option value={formData.insurance_company}>{formData.insurance_company}</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Policy Number</label>
                  <input type="text" name="policy_no" value={formData.policy_no} onChange={handleChange} className="input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Premium Amount</label>
                  <input type="number" step="0.01" name="premium_amount" value={formData.premium_amount} onChange={handleChange} className="input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Coverage Amount</label>
                  <input type="number" step="0.01" name="coverage_amount" value={formData.coverage_amount} onChange={handleChange} className="input" />
                </div>
              </>
            )}

            {/* Additional Info */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-brand-700">Additional Information</h3>
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label">Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="input h-24" placeholder="Any additional notes..."></textarea>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={() => navigate("/transport/compliance")} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              <SaveOutlined /> {loading ? "Saving..." : "Save Compliance Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
