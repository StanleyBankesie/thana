import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function DriverForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    employee_id: "",
    user_id: "",
    license_number: "",
    license_type: "STANDARD",
    license_expiry: "",
  });

  useEffect(() => {
    let cancelled = false;
    api.get("/hr/employees")
      .then((res) => {
        if (!cancelled && res.data?.data?.items) {
          setEmployees(res.data.data.items);
        }
      })
      .catch((err) => {
        if (err.response?.status !== 403) {
          toast.error("Failed to fetch employees");
        }
      });
      
    api.get("/admin/users")
      .then((res) => {
        if (!cancelled && res.data?.data?.items) {
          setUsers(res.data.data.items);
        } else if (!cancelled && res.data?.users) {
          setUsers(res.data.users); // Fallback depending on API response structure
        }
      })
      .catch((err) => console.error("Failed to fetch users", err));
      
    if (id) {
      api.get(`/transport/drivers/${id}`)
        .then(res => {
          if (!cancelled && res.data?.success) {
            const driver = res.data.data.driver;
            setFormData({
              employee_id: driver.employee_id || "",
              employee_name: driver.employee_name || "",
              user_id: driver.user_id || "",
              license_number: driver.license_number || "",
              license_type: driver.license_type || "STANDARD",
              license_expiry: driver.license_expiry ? driver.license_expiry.split('T')[0] : "",
            });
          }
        })
        .catch(err => console.error("Failed to fetch driver", err));
    }
      
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!formData.employee_id && !formData.employee_name) || !formData.license_number) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      if (id) {
        await api.put(`/transport/drivers/${id}`, formData);
        toast.success("Driver updated successfully");
      } else {
        await api.post("/transport/drivers", formData);
        toast.success("Driver added successfully");
      }
      navigate("/transport/drivers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <button onClick={() => window.history.back()} className="btn btn-ghost btn-sm px-2 text-slate-500"
            >
              ← Back
            </button>
            {id ? "Edit Driver" : "New Driver"}
          </h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Select Employee *</span>
              </label>
              <input
                type="text"
                name="employee_name"
                className="input input-bordered w-full"
                value={formData.employee_name || formData.employee_id || ""}
                onChange={(e) => {
                  handleChange({ target: { name: 'employee_id', value: e.target.value }});
                  handleChange({ target: { name: 'employee_name', value: e.target.value }});
                }}
                placeholder="Enter employee name"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">License Number *</span>
              </label>
              <input
                type="text"
                name="license_number"
                className="input input-bordered w-full"
                value={formData.license_number}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Link to User Account (Optional)</span>
              </label>
              <select
                name="user_id"
                className="input input-bordered w-full"
                value={formData.user_id}
                onChange={handleChange}
              >
                <option value="">-- No User Account Linked --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">License Type</span>
              </label>
              <select
                name="license_type"
                className="input input-bordered w-full"
                value={formData.license_type}
                onChange={handleChange}
              >
                <option value="COMMERCIAL">Commercial</option>
                <option value="HEAVY_DUTY">Heavy Duty</option>
                <option value="STANDARD">Standard</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">License Expiry</span>
              </label>
              <input
                type="date"
                name="license_expiry"
                className="input input-bordered w-full"
                value={formData.license_expiry}
                onChange={handleChange}
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button onClick={() => window.history.back()} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
