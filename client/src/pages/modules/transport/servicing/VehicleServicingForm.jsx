import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";

const SERVICES_LIST = [
  "Engine Oil Change",
  "Oil Filter Replacement",
  "Air Filter Replacement",
  "Fuel Filter Replacement",
  "Brake Inspection",
  "Brake Pad Replacement",
  "Wheel Alignment",
  "Wheel Balancing",
  "Tire Rotation",
  "Tire Replacement",
  "Battery Replacement",
  "Coolant Replacement",
  "Transmission Service",
  "Suspension Inspection",
  "General Inspection",
  "Other"
];

export default function VehicleServicingForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id && id !== "new";

  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  const [formData, setFormData] = useState({
    vehicle_id: "",
    service_type: "Routine",
    service_date: "",
    next_service_date: "",
    reminder_days: 30,
    current_service_mileage: 0,
    next_service_mileage: 0,
    odometer_reading: 0,
    service_status: "Completed",
    provider_garage: "",
    provider_mechanic: "",
    provider_contact_person: "",
    provider_contact_number: "",
    labour_cost: 0,
    parts_cost: 0,
    other_charges: 0,
    payment_status: "Pending",
    payment_reference: "",
    services_performed: [],
    parts_replaced: [],
    invoice_url: "",
    receipt_url: "",
    report_url: "",
    support_doc_url: "",
    notes: "",
    completion_date: "",
  });

  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    api.get("/transport/vehicles").then(res => {
      const items = res.data?.data?.items || res.data?.items || [];
      setVehicles(items);
    }).catch(() => toast.error("Failed to load vehicles"));

    api.get("/purchase/suppliers").then(res => {
      const items = res.data?.items || [];
      setSuppliers(items);
    }).catch(() => toast.error("Failed to load suppliers"));
    
    if (isEdit) {
      setLoading(true);
      api.get(`/transport/servicing/${id}`).then(res => {
        const item = res.data?.item || res.data;
        if (item) {
          setFormData({
            vehicle_id: item.vehicle_id || "",
            service_type: item.service_type || "Routine",
            service_date: item.service_date ? item.service_date.split("T")[0] : "",
            next_service_date: item.next_service_date ? item.next_service_date.split("T")[0] : "",
            reminder_days: item.reminder_days || 30,
            current_service_mileage: item.current_service_mileage || 0,
            next_service_mileage: item.next_service_mileage || 0,
            odometer_reading: item.odometer_reading || 0,
            service_status: item.service_status || "Completed",
            provider_garage: item.provider_garage || "",
            provider_mechanic: item.provider_mechanic || "",
            provider_contact_person: item.provider_contact_person || "",
            provider_contact_number: item.provider_contact_number || "",
            labour_cost: item.labour_cost || 0,
            parts_cost: item.parts_cost || 0,
            other_charges: item.other_charges || 0,
            payment_status: item.payment_status || "Pending",
            payment_reference: item.payment_reference || "",
            services_performed: item.services_performed || [],
            parts_replaced: item.parts_replaced || [],
            invoice_url: item.invoice_url || "",
            receipt_url: item.receipt_url || "",
            report_url: item.report_url || "",
            support_doc_url: item.support_doc_url || "",
            notes: item.notes || "",
            completion_date: item.completion_date ? item.completion_date.split("T")[0] : "",
          });
        }
      }).catch(() => {
        toast.error("Failed to load servicing record");
      }).finally(() => setLoading(false));
    }
  }, [id, isEdit]);


  // Handle vehicle selection specifically to auto-populate some fields
  const handleVehicleChange = (e) => {
    const vId = e.target.value;
    const vehicle = vehicles.find(v => String(v.id) === String(vId));
    setSelectedVehicle(vehicle);
    
    setFormData(prev => ({
      ...prev,
      vehicle_id: vId,
      current_service_mileage: vehicle ? vehicle.current_odometer : prev.current_service_mileage
    }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "number" ? (value ? Number(value) : "") : value
    }));
  };

  const toggleService = (service) => {
    setFormData(prev => {
      const exists = prev.services_performed.includes(service);
      if (exists) {
        return { ...prev, services_performed: prev.services_performed.filter(s => s !== service) };
      }
      return { ...prev, services_performed: [...prev.services_performed, service] };
    });
  };

  const addPart = () => {
    setFormData(prev => ({
      ...prev,
      parts_replaced: [...prev.parts_replaced, { name: "", quantity: 1, unit_cost: "", total_cost: 0 }]
    }));
  };

  const updatePart = (index, field, value) => {
    setFormData(prev => {
      const parts = [...prev.parts_replaced];
      const val = (field === "quantity" || field === "unit_cost") ? (value === "" ? "" : Number(value)) : value;
      parts[index][field] = val;
      
      if (field === "quantity" || field === "unit_cost") {
        parts[index].total_cost = ((parts[index].quantity || 0) * (parts[index].unit_cost || 0));
      }
      
      const partsTotal = parts.reduce((acc, p) => acc + (Number(p.total_cost) || 0), 0);
      return { ...prev, parts_replaced: parts, parts_cost: partsTotal };
    });
  };

  const removePart = (index) => {
    setFormData(prev => {
      const parts = prev.parts_replaced.filter((_, i) => i !== index);
      const partsTotal = parts.reduce((acc, p) => acc + (Number(p.total_cost) || 0), 0);
      return { ...prev, parts_replaced: parts, parts_cost: partsTotal };
    });
  };

  const totalCost = (Number(formData.labour_cost) || 0) + (Number(formData.parts_cost) || 0) + (Number(formData.other_charges) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedVehicle && formData.current_service_mileage < selectedVehicle.current_odometer) {
       toast.error("Current Mileage cannot be less than the vehicle's last recorded mileage");
       return;
    }
    
    if (formData.next_service_mileage > 0 && formData.next_service_mileage <= formData.current_service_mileage) {
      toast.error("Next Service Mileage must be greater than Current Service Mileage");
      return;
    }
    
    if (formData.service_status === "Completed" && !formData.next_service_date) {
      toast.error("Next Service Date is required for Completed services");
      return;
    }

    if (formData.service_date && formData.next_service_date && new Date(formData.next_service_date) <= new Date(formData.service_date)) {
      toast.error("Next Service Date must be later than Service Date");
      return;
    }
    
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/transport/servicing/${id}`, formData);
        toast.success("Record updated successfully");
      } else {
        await api.post("/transport/servicing", formData);
        toast.success("Record created successfully");
      }
      navigate("/transport/servicing");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white flex items-center gap-4 rounded-t-lg">
          <button onClick={() => navigate("/transport/servicing")} className="btn btn-sm btn-secondary">
            <ArrowLeftOutlined /> Back
          </button>
          <div>
            <h2 className="text-xl font-bold">{isEdit ? "Edit" : "New"} Vehicle Servicing Record</h2>
            <p className="text-sm opacity-80">
              {isEdit ? "Update service details" : "Add a new service record"}
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="card-body">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            {/* Vehicle Information */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Vehicle Information</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label required">Vehicle</label>
              <select name="vehicle_id" value={formData.vehicle_id} onChange={handleVehicleChange} required className="input">
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.reg_number} ({v.make} {v.model})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Registration Number</label>
              <input type="text" readOnly className="input bg-slate-100" value={selectedVehicle ? selectedVehicle.reg_number : ""} />
            </div>

            <div className="form-group">
              <label className="form-label">Vehicle Brand/Make</label>
              <input type="text" readOnly className="input bg-slate-100" value={selectedVehicle ? `${selectedVehicle.make || ""} ${selectedVehicle.model || ""}` : ""} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Current Vehicle Odometer</label>
              <input type="text" readOnly className="input bg-slate-100" value={selectedVehicle ? selectedVehicle.current_odometer : ""} />
            </div>

            {/* Service Information */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Service Information</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label required">Service Type</label>
              <select name="service_type" value={formData.service_type} onChange={handleChange} required className="input">
                <option value="Routine">Routine</option>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
                <option value="Preventive">Preventive</option>
                <option value="Corrective">Corrective</option>
                <option value="Emergency">Emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group hidden">
              <label className="form-label">Service Status</label>
              <select name="service_status" value={formData.service_status} onChange={handleChange} className="input">
                <option value="Upcoming">Upcoming</option>
                <option value="Due">Due</option>
                <option value="Overdue">Overdue</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Service Date</label>
              <input type="date" name="service_date" value={formData.service_date} onChange={handleChange} required className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Next Service Date</label>
              <input type="date" name="next_service_date" value={formData.next_service_date} onChange={handleChange} className="input" />
            </div>

            <div className="form-group">
              <label className="form-label">Current Service Mileage</label>
              <input type="number" step="0.01" name="current_service_mileage" value={formData.current_service_mileage} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Next Service Mileage</label>
              <input type="number" step="0.01" name="next_service_mileage" value={formData.next_service_mileage} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Service Reminder (Days)</label>
              <input type="number" className="input" name="reminder_days" value={formData.reminder_days} onChange={handleChange} />
            </div>
            
            {/* Removed Completion Date field as requested */}

            {/* Provider Information */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Service Provider</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Garage / Workshop</label>
              <select name="provider_garage" value={formData.provider_garage} onChange={handleChange} className="input">
                <option value="">Select Garage / Workshop</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Mechanic / Technician</label>
              <input type="text" name="provider_mechanic" value={formData.provider_mechanic} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input type="text" name="provider_contact_person" value={formData.provider_contact_person} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Contact Number</label>
              <input type="text" name="provider_contact_number" value={formData.provider_contact_number} onChange={handleChange} className="input" />
            </div>

            {/* Work Performed */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Work Performed</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                {SERVICES_LIST.map(service => (
                  <label key={service} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-2 rounded border border-transparent hover:border-slate-200">
                    <input 
                      type="checkbox" 
                      checked={formData.services_performed.includes(service)}
                      onChange={() => toggleService(service)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {service}
                  </label>
                ))}
              </div>
            </div>

            {/* Parts Replaced */}
            <div className="md:col-span-2 mt-4">
              <div className="flex justify-between items-end border-b pb-2 mb-4">
                <h3 className="text-lg font-semibold text-brand-700">Parts Replaced</h3>
                <button type="button" onClick={addPart} className="btn btn-outline btn-sm">
                  <PlusOutlined /> Add Part
                </button>
              </div>
              
              {formData.parts_replaced.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-brand-700 w-1/2">Part Name</th>
                        <th className="px-4 py-2 font-semibold w-24 text-brand-700">Quantity</th>
                        <th className="px-4 py-2 font-semibold w-32 text-brand-700">Unit Cost</th>
                        <th className="px-4 py-2 font-semibold w-32 text-brand-700">Total Cost</th>
                        <th className="px-4 py-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.parts_replaced.map((part, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">
                            <input type="text" className="input form-control-sm text-brand-700" value={part.name} onChange={e => updatePart(index, "name", e.target.value)} placeholder="Part description..." />
                          </td>
                          <td className="p-2">
                            <input type="number" className="input form-control-sm text-brand-700" value={part.quantity} onChange={e => updatePart(index, "quantity", e.target.value)} min="1" />
                          </td>
                          <td className="p-2">
                            <input type="number" className="input form-control-sm text-brand-700" value={part.unit_cost} onChange={e => updatePart(index, "unit_cost", e.target.value)} min="0" step="0.01" />
                          </td>
                          <td className="p-2 text-right font-bold text-brand-700 bg-slate-50">
                            {Number(part.total_cost).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => removePart(index)} className="text-red-500 hover:text-red-700 p-1">
                              <DeleteOutlined />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded text-slate-500 text-sm italic">
                  No parts replaced. Click "Add Part" to record replacements.
                </div>
              )}
            </div>

            {/* Cost Information */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Cost Information</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Labour Cost</label>
              <input type="number" step="0.01" name="labour_cost" value={formData.labour_cost} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Parts Cost</label>
              <input type="number" step="0.01" readOnly className="input bg-slate-100" value={formData.parts_cost} />
              <p className="text-xs text-slate-500 mt-1">Calculated from Parts Replaced table</p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Other Charges</label>
              <input type="number" step="0.01" name="other_charges" value={formData.other_charges} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label font-bold text-brand-700">Total Service Cost</label>
              <input type="text" readOnly className="input bg-brand-50 font-bold text-lg text-brand-800" value={totalCost.toFixed(2)} />
            </div>

            {/* Removed Payment Status and Payment Reference as requested */}

            {/* Additional Info */}
            <div className="md:col-span-2 mt-4 border-t pt-6">
              <div className="form-group">
                <label className="form-label">Remarks / Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} className="input h-24" placeholder="Any additional notes about this service..."></textarea>
              </div>
            </div>

          </div>
          
          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={() => navigate("/transport/servicing")} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              <SaveOutlined /> {loading ? "Saving..." : "Save Service Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
