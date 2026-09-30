import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { SaveOutlined, ArrowLeftOutlined, CheckCircleOutlined } from "@ant-design/icons";
import AddressMapPicker from "../../../../components/common/AddressMapPicker.jsx";

export default function LogbookForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  
  const isEdit = !!id && id !== "new";
  const isCompleteMode = searchParams.get("complete") === "true";

  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [uom, setUom] = useState("KM");
  
  const [formData, setFormData] = useState({
    vehicle_id: "",
    driver_id: "",
    trip_date: new Date().toISOString().split("T")[0],
    department: "",
    purpose: "",
    origin: "",
    destination: "",
    planned_route: "",
    departure_time: "",
    expected_return_time: "",
    actual_return_time: "",
    trip_status: "Planned",
    beginning_mileage: 0,
    ending_mileage: 0,
    fuel_level_departure: "",
    fuel_level_return: "",
    fuel_issued: 0,
    fuel_cost: 0,
    fuel_station: "",
    num_passengers: 0,
    passenger_names: "",
    driver_remarks: "",
    incident_report: "",
    traffic_offence: "",
    breakdown_details: "",
    requested_by: "",
    approved_by: "",
    approval_status: "Pending",
  });

  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/transport/vehicles"),
      api.get("/transport/drivers"),
      api.get("/admin/departments").catch(() => ({ data: { items: [] } }))
    ]).then(([vRes, dRes, depRes]) => {
      const vItems = vRes.data?.data?.items || vRes.data?.items || [];
      const dItems = dRes.data?.data?.items || dRes.data?.items || [];
      const depItems = depRes.data?.items || [];
      setVehicles(vItems);
      setDrivers(dItems);
      setDepartments(depItems);
    }).catch(() => toast.error("Failed to load initial data"));
    
    if (isEdit) {
      setLoading(true);
      api.get(`/transport/logbooks/${id}`).then(res => {
        const item = res.data?.item || res.data;
        if (item) {
          // Find vehicle for selected state
          const v = vehicles.find(vec => String(vec.id) === String(item.vehicle_id));
          if (v) setSelectedVehicle(v);

          const fmtDate = (d) => d ? new Date(d).toISOString().slice(0,16) : ""; // YYYY-MM-DDTHH:mm

          setFormData({
            vehicle_id: item.vehicle_id || "",
            driver_id: item.driver_id || "",
            trip_date: item.trip_date ? item.trip_date.split("T")[0] : "",
            department: item.department || "",
            purpose: item.purpose || "",
            origin: item.origin || "",
            destination: item.destination || "",
            planned_route: item.planned_route || "",
            departure_time: fmtDate(item.departure_time),
            expected_return_time: fmtDate(item.expected_return_time),
            actual_return_time: fmtDate(item.actual_return_time),
            trip_status: isCompleteMode ? "Completed" : (item.trip_status || "Planned"),
            beginning_mileage: item.beginning_mileage || 0,
            ending_mileage: item.ending_mileage || 0,
            fuel_level_departure: item.fuel_level_departure || "",
            fuel_level_return: item.fuel_level_return || "",
            fuel_issued: item.fuel_issued || 0,
            fuel_cost: item.fuel_cost || 0,
            fuel_station: item.fuel_station || "",
            num_passengers: item.num_passengers || 0,
            passenger_names: item.passenger_names || "",
            driver_remarks: item.driver_remarks || "",
            incident_report: item.incident_report || "",
            traffic_offence: item.traffic_offence || "",
            breakdown_details: item.breakdown_details || "",
            requested_by: item.requested_by || "",
            approved_by: item.approved_by || "",
            approval_status: item.approval_status || "Pending",
          });
          
          if (isCompleteMode && !item.actual_return_time) {
            setFormData(p => ({ ...p, actual_return_time: fmtDate(new Date()) }));
          }
        }
      }).catch(() => {
        toast.error("Failed to load logbook record");
      }).finally(() => setLoading(false));
    }
  }, [id, isEdit, isCompleteMode]); // Removed vehicles from deps to avoid loop

  // Handle vehicle selection for auto-population
  const handleVehicleChange = (e) => {
    const vId = e.target.value;
    const vehicle = vehicles.find(v => String(v.id) === String(vId));
    setSelectedVehicle(vehicle);
    
    setFormData(prev => ({
      ...prev,
      vehicle_id: vId,
      beginning_mileage: vehicle ? vehicle.current_odometer : prev.beginning_mileage
    }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "number" ? (value ? Number(value) : "") : value
    }));
  };

  const distanceTravelled = (Number(formData.ending_mileage) || 0) >= (Number(formData.beginning_mileage) || 0)
    ? (Number(formData.ending_mileage) || 0) - (Number(formData.beginning_mileage) || 0)
    : 0;

  const handleSubmit = async (e, forceStatus = null) => {
    if (e) e.preventDefault();
    
    const submitData = { ...formData };
    if (forceStatus) {
      submitData.trip_status = forceStatus;
    } else if (submitData.trip_status !== "Completed") {
      submitData.trip_status = "Started";
    }
    
    if (submitData.ending_mileage > 0 && submitData.ending_mileage < submitData.beginning_mileage) {
       toast.error("Ending Mileage must be greater than or equal to Beginning Mileage");
       return;
    }
    
    if (submitData.actual_return_time && submitData.departure_time && new Date(submitData.actual_return_time) < new Date(submitData.departure_time)) {
      toast.error("Actual Return Time cannot be earlier than Departure Time");
      return;
    }
    
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/transport/logbooks/${id}`, submitData);
        toast.success(isCompleteMode || forceStatus === "Completed" ? "Trip completed successfully" : "Record updated successfully");
      } else {
        await api.post("/transport/logbooks", submitData);
        toast.success("Trip record created successfully");
      }
      navigate("/transport/logbooks");
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
          <button type="button" onClick={() => navigate("/transport/logbooks")} className="btn btn-sm btn-secondary">
            <ArrowLeftOutlined /> Back
          </button>
          <div>
            <h2 className="text-xl font-bold">
              {isCompleteMode ? "Complete Trip" : isEdit ? "Edit Trip Record" : "New Trip Record"}
            </h2>
            <p className="text-sm opacity-80">
              {isCompleteMode ? "Record return information and complete this trip" : "Provide detailed information about the trip"}
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            {/* General Info */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">General Information</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label required">Driver</label>
              <select name="driver_id" value={formData.driver_id} onChange={handleChange} required className="input">
                <option value="">-- Select Driver --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.employee_name || `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Unknown Driver"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Vehicle</label>
              <select name="vehicle_id" value={formData.vehicle_id} onChange={handleVehicleChange} required className="input">
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Registration Number</label>
              <input type="text" readOnly className="input bg-slate-100" value={selectedVehicle ? selectedVehicle.reg_number : ""} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Trip Date</label>
              <input type="date" name="trip_date" value={formData.trip_date} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Department</label>
              <select name="department" value={formData.department} onChange={handleChange} className="input">
                <option value="">-- Select Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Purpose of Trip</label>
              <input type="text" name="purpose" value={formData.purpose} onChange={handleChange} className="input" />
            </div>

            {/* Trip Info */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Trip Details</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Origin</label>
              <AddressMapPicker 
                value={formData.origin}
                onChange={(val) => {
                  setFormData(p => {
                    const newOrigin = val.name;
                    return {
                      ...p, 
                      origin: newOrigin, 
                      planned_route: (newOrigin && p.destination) ? `${newOrigin} -> ${p.destination}` : p.planned_route
                    };
                  });
                }}
                placeholder="Enter origin manually or pick on map"
                layout="vertical"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Destination</label>
              <AddressMapPicker 
                value={formData.destination}
                onChange={(val) => {
                  setFormData(p => {
                    const newDest = val.name;
                    return {
                      ...p, 
                      destination: newDest, 
                      planned_route: (p.origin && newDest) ? `${p.origin} -> ${newDest}` : p.planned_route
                    };
                  });
                }}
                placeholder="Enter destination manually or pick on map"
                layout="vertical"
              />
            </div>

            <div className="form-group md:col-span-2">
              <label className="form-label">Planned Route</label>
              <input type="text" name="planned_route" value={formData.planned_route} onChange={handleChange} className="input" placeholder="e.g. Highway N1 -> Highway N4" />
            </div>

            <div className="form-group">
              <label className="form-label">Departure Date & Time</label>
              <input type="datetime-local" name="departure_time" value={formData.departure_time} onChange={handleChange} className="input" />
            </div>

            <div className="form-group hidden">
              <label className="form-label">Expected Return Date & Time</label>
              <input type="datetime-local" name="expected_return_time" value={formData.expected_return_time} onChange={handleChange} className="input" />
            </div>

            <div className="form-group">
              <label className="form-label text-brand-700 font-semibold">Actual Return Date & Time</label>
              <input type="datetime-local" name="actual_return_time" value={formData.actual_return_time} onChange={handleChange} className="input border-brand-500 focus:ring-brand-500" />
            </div>

            <div className="form-group hidden">
              <label className="form-label">Trip Status</label>
              <select name="trip_status" value={formData.trip_status} onChange={handleChange} className="input">
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Mileage Info */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Mileage Information</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Beginning Mileage</label>
              <div className="flex">
                <input type="number" step="0.01" name="beginning_mileage" value={formData.beginning_mileage} onChange={handleChange} className="input rounded-r-none border-r-0 flex-1" />
                <select value={uom} onChange={e => setUom(e.target.value)} className="select bg-slate-100 rounded-l-none border-l border-slate-300 w-24">
                  <option value="KM">KM</option>
                  <option value="Miles">Miles</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label font-bold text-brand-700">Ending Mileage</label>
              <div className="flex">
                <input type="number" step="0.01" name="ending_mileage" value={formData.ending_mileage} onChange={handleChange} className="input border-brand-500 focus:ring-brand-500 rounded-r-none border-r-0 flex-1" />
                <select value={uom} onChange={e => setUom(e.target.value)} className="select bg-slate-100 rounded-l-none border-l border-brand-500 w-24">
                  <option value="KM">KM</option>
                  <option value="Miles">Miles</option>
                </select>
              </div>
            </div>
            
            <div className="form-group md:col-span-2">
              <label className="form-label font-bold text-brand-700">Distance Travelled (Auto-Calculated)</label>
              <div className="flex">
                <input type="text" readOnly className="input bg-brand-50 font-bold text-lg text-brand-800 rounded-r-none border-r-0 flex-1" value={distanceTravelled.toFixed(2)} />
                <select value={uom} onChange={e => setUom(e.target.value)} className="select bg-brand-100 font-bold text-brand-800 rounded-l-none border-l border-brand-200 w-24">
                  <option value="KM">KM</option>
                  <option value="Miles">Miles</option>
                </select>
              </div>
            </div>

            {/* Fuel Information */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Fuel Information</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Fuel Level (Departure)</label>
              <select name="fuel_level_departure" value={formData.fuel_level_departure} onChange={handleChange} className="input">
                <option value="">-- Select --</option>
                <option value="Empty">Empty</option>
                <option value="1/4">1/4 Tank</option>
                <option value="1/2">1/2 Tank</option>
                <option value="3/4">3/4 Tank</option>
                <option value="Full">Full</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Fuel Level (Return)</label>
              <select name="fuel_level_return" value={formData.fuel_level_return} onChange={handleChange} className="input">
                <option value="">-- Select --</option>
                <option value="Empty">Empty</option>
                <option value="1/4">1/4 Tank</option>
                <option value="1/2">1/2 Tank</option>
                <option value="3/4">3/4 Tank</option>
                <option value="Full">Full</option>
              </select>
            </div>

            <div className="form-group hidden">
              <label className="form-label">Fuel Issued (Litres)</label>
              <input type="number" step="0.01" name="fuel_issued" value={formData.fuel_issued} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group hidden">
              <label className="form-label">Fuel Cost</label>
              <input type="number" step="0.01" name="fuel_cost" value={formData.fuel_cost} onChange={handleChange} className="input" />
            </div>
            
            <div className="form-group md:col-span-2 hidden">
              <label className="form-label">Fuel Station</label>
              <input type="text" name="fuel_station" value={formData.fuel_station} onChange={handleChange} className="input" />
            </div>



            {/* Driver Declarations */}
            <div className="md:col-span-2 mt-4 border-t pt-6">
              <h3 className="text-lg font-semibold border-b pb-2 text-brand-700">Driver Declarations</h3>
            </div>
            
            <div className="form-group md:col-span-2">
              <label className="form-label">Driver Remarks</label>
              <textarea name="driver_remarks" value={formData.driver_remarks} onChange={handleChange} className="input h-20" placeholder="Notes from the driver..."></textarea>
            </div>
            
            <div className="form-group md:col-span-2">
              <label className="form-label">Incident / Accident Report</label>
              <textarea name="incident_report" value={formData.incident_report} onChange={handleChange} className="input h-20" placeholder="Details of any incidents..."></textarea>
            </div>
            
            <div className="form-group md:col-span-2">
              <label className="form-label">Traffic Offence / Fine</label>
              <textarea name="traffic_offence" value={formData.traffic_offence} onChange={handleChange} className="input h-20" placeholder="Details of any traffic offences..."></textarea>
            </div>
            
            <div className="form-group md:col-span-2">
              <label className="form-label">Breakdown Details</label>
              <textarea name="breakdown_details" value={formData.breakdown_details} onChange={handleChange} className="input h-20" placeholder="Details of any breakdowns..."></textarea>
            </div>



          </div>
          
          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={() => navigate("/transport/logbooks")} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={loading} onClick={(e) => handleSubmit(e, "Completed")} className="btn btn-success text-white border-none bg-green-500 hover:bg-green-600">
              <CheckCircleOutlined /> Complete Trip
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              <SaveOutlined /> Save Logbook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
