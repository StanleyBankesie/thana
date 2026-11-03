import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../../api/client";
import { Plus, Trash2, Save, ArrowLeft, Users, UserCheck, Search, X, Check, ChevronDown } from "lucide-react";
import { getAllFeatures as getAllModuleFeatures } from "../../../../data/modulesRegistry";

function toTitle(s) {
  return String(s || "")
    .split("-")
    .map((x) => (x[0] ? x[0].toUpperCase() + x.slice(1) : ""))
    .join(" ");
}
function toCode(module, label) {
  return `${module}_${label}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function normalizeModuleKey(mod) {
  return String(mod || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function routeRank(path) {
  const s = String(path || "");
  let score = 0;
  if (s.includes("/:")) score += 2;
  if (/\/(new|edit)\b/i.test(s)) score += 1;
  return score;
}
function isBetterRoute(nextPath, existingPath) {
  return routeRank(nextPath) < routeRank(existingPath);
}
function normalizeDocLabel(label) {
  const s = String(label || "").trim();
  if (!s) return s;
  const map = {
    user: "User",
    users: "User",
    invoice: "Invoice",
    invoices: "Invoice",
    customer: "Customer",
    customers: "Customer",
    branch: "Branch",
    branches: "Branch",
    company: "Company",
    companies: "Company",
    employee: "Employee",
    employees: "Employee",
  };
  const lower = s.toLowerCase();
  if (map[lower]) return map[lower];
  const words = s.split(/\s+/).filter(Boolean);
  if (!words.length) return s;
  const last = words[words.length - 1];
  const lastLower = last.toLowerCase();
  const exceptions = new Set(["sales", "pos"]);
  if (exceptions.has(lastLower)) return s;
  let singular = last;
  if (/ies$/i.test(last) && last.length > 3) {
    singular = last.replace(/ies$/i, "y");
  } else if (/(ses|xes|zes|ches|shes)$/i.test(last) && last.length > 3) {
    singular = last.replace(/es$/i, "");
  } else if (/s$/i.test(last) && last.length > 3) {
    singular = last.slice(0, -1);
  }
  if (singular !== last) {
    words[words.length - 1] = singular;
    return words.join(" ");
  }
  return s;
}


function ApproverMultiSelect({
  selectedUserIds = [],
  allUsers = [],
  onChange,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIds = (Array.isArray(selectedUserIds) ? selectedUserIds : [])
    .map((id) => Number(id));

  const filteredUsers = allUsers.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const uname = String(u.username || "").toLowerCase();
    const fname = String(u.full_name || "").toLowerCase();
    const email = String(u.email || "").toLowerCase();
    return uname.includes(term) || fname.includes(term) || email.includes(term);
  });

  const toggleUser = (userId) => {
    const id = Number(userId);
    let next;
    if (selectedIds.includes(id)) {
      next = selectedIds.filter((x) => x !== id);
    } else {
      next = [...selectedIds, id];
    }
    onChange(next);
  };

  const removeUser = (userId, e) => {
    e.stopPropagation();
    const id = Number(userId);
    onChange(selectedIds.filter((x) => x !== id));
  };

  const selectAll = () => {
    const allIds = Array.from(new Set([...selectedIds, ...filteredUsers.map((u) => Number(u.id))]));
    onChange(allIds);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        onClick={() => setIsOpen(true)}
        className={`min-h-[40px] p-2 border rounded-md shadow-sm bg-white cursor-pointer transition-colors flex flex-wrap items-center gap-1.5 ${
          isOpen ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        {selectedIds.length === 0 ? (
          <span className="text-xs text-gray-400 px-1 flex items-center gap-1.5">
            <Users size={14} /> Select one or more approvers...
          </span>
        ) : (
          selectedIds.map((id) => {
            const u = allUsers.find((user) => Number(user.id) === id);
            const label = u ? (u.full_name ? `${u.username} (${u.full_name})` : u.username) : `User #${id}`;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
              >
                <span>{label}</span>
                <button
                  type="button"
                  onClick={(e) => removeUser(id, e)}
                  className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 flex items-center justify-center text-blue-600 transition-colors"
                  title="Remove user"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })
        )}
        <div className="ml-auto pr-1 text-gray-400">
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-fadeIn">
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username, full name or email..."
              className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 p-0"
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="px-3 py-1.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>
              {selectedIds.length} of {allUsers.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Select All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 p-1">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                No users found matching "{searchTerm}"
              </div>
            ) : (
              filteredUsers.map((u) => {
                const id = Number(u.id);
                const isSelected = selectedIds.includes(id);
                return (
                  <div
                    key={id}
                    onClick={() => toggleUser(id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-medium"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 pointer-events-none"
                    />
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                      {(u.username || "U").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 truncate">{u.username}</span>
                        {u.full_name && (
                          <span className="text-gray-500 truncate text-[11px]">({u.full_name})</span>
                        )}
                      </div>
                      {u.email && (
                        <div className="text-[11px] text-gray-400 truncate">{u.email}</div>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={14} className="text-blue-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const WorkflowForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [formData, setFormData] = useState({
    workflow_code: "",
    workflow_name: "",
    module_key: "",
    document_type: "",
    document_route: "",
    email_notify: true,
      sms_notify: true,
      whatsapp_notify: true,
    is_active: true,
    steps: [],
  });

  useEffect(() => {
    fetchUsers();
    fetchTransactionDocTypes();
    if (isEdit) {
      fetchWorkflow();
    }
    return () => {};
  }, [id]);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/workflows/users", { params: { active: 1, limit: 100 } });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setUsers(items);
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };
  const [stepUserOptions, setStepUserOptions] = useState({});
  const searchUsersForStep = async (index, term) => {
    const q = String(term || "").trim();
    if (q.length < 2) {
      setStepUserOptions((prev) => ({ ...prev, [index]: [] }));
      return;
    }
    try {
      const res = await api.get("/workflows/users", {
        params: { q, active: 1 },
      });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setStepUserOptions((prev) => ({ ...prev, [index]: items }));
    } catch (error) {
      setStepUserOptions((prev) => ({ ...prev, [index]: [] }));
    }
  };

  const fetchTransactionDocTypes = async () => {
    try {
      // Build from client modules registry to include ALL module features
      const feats = Array.isArray(getAllModuleFeatures())
        ? getAllModuleFeatures()
        : [];
      const map = new Map();
      for (const f of feats) {
        if (!f || f.type === "dashboard") continue;
        const moduleKey = String(f.module_key || "").trim();
        const moduleLabel = moduleKey
          .split("-")
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
          .join(" ");
        const label = normalizeDocLabel(String(f.label || "").trim());
        const route = String(f.path || "").trim();
        if (!moduleLabel || !label || !route) continue;
        const key = `${moduleLabel}||${label.toUpperCase()}`;
        const existing = map.get(key);
        if (!existing || isBetterRoute(route, existing.route)) {
          const code = toCode(moduleLabel, label);
          map.set(key, { module: moduleLabel, label, code, route });
        }
      }
      const list = Array.from(map.values()).sort((a, b) =>
        a.module === b.module
          ? a.label.localeCompare(b.label)
          : a.module.localeCompare(b.module),
      );
      const extra = {
        module: "Purchase",
        label: "General Requisition",
        code: toCode("Purchase", "General Requisition"),
        route: "/purchase/general-requisitions",
      };
      if (!list.some((dt) => dt.code === extra.code)) {
        list.push(extra);
      }
      setDocTypes(list);
    } catch (error) {
      console.error(
        "Failed to build document types from modules registry",
        error,
      );
      setDocTypes([]);
    }
  };

  useEffect(() => {
    if (
      !formData.module_key ||
      !formData.document_type ||
      docTypes.length === 0
    )
      return;
    const match =
      docTypes.find(
        (dt) =>
          normalizeModuleKey(dt.module) ===
            normalizeModuleKey(formData.module_key) &&
          dt.label === formData.document_type,
      ) ||
      docTypes.find(
        (dt) =>
          dt.code ===
          toCode(
            normalizeModuleKey(formData.module_key),
            formData.document_type,
          ),
      );
    setSelectedDocType(match ? match.code : "");
  }, [docTypes, formData.module_key, formData.document_type]);

  const fetchWorkflow = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/workflows/${id}`);
      const data = res.data.item;
      const mappedSteps = Array.isArray(data.steps)
        ? data.steps.map((s) => ({
            ...s,
            approver_user_ids:
              Array.isArray(s.approvers) && s.approvers.length
                ? s.approvers.map((a) => a.id)
                : s.approver_user_id
                  ? [s.approver_user_id]
                  : [],
          }))
        : [];
      setFormData({
        ...data,
        is_active: !!data.is_active,
        email_notify: data.email_notify == null ? true : Boolean(data.email_notify),
        sms_notify: data.sms_notify == null ? true : Boolean(data.sms_notify),
        whatsapp_notify: data.whatsapp_notify == null ? true : Boolean(data.whatsapp_notify),
        steps: mappedSteps,
      });
      const initialCode = toCode(
        normalizeModuleKey(data.module_key),
        data.document_type,
      );
      setSelectedDocType(initialCode);
    } catch (error) {
      console.error("Failed to fetch workflow", error);
      alert("Error loading workflow");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData((prev) => ({ ...prev, steps: newSteps }));
  };

  const addStep = () => {
    setFormData((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          step_order: prev.steps.length + 1,
          step_name: "",
          approver_user_ids: [],
          approval_limit: null,
          is_mandatory: true,
        },
      ],
    }));
  };

  const removeStep = (index) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Re-index steps
    const reIndexed = newSteps.map((step, i) => ({
      ...step,
      step_order: i + 1,
    }));
    setFormData((prev) => ({ ...prev, steps: reIndexed }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate steps
      for (const step of formData.steps) {
        const ids = Array.isArray(step.approver_user_ids)
          ? step.approver_user_ids
          : step.approver_user_id
            ? [step.approver_user_id]
            : [];
        if (!ids.length) {
          alert(`Please select an approver for step ${step.step_order}`);
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...formData,
        steps: formData.steps.map((s) => {
          const ids = Array.isArray(s.approver_user_ids)
            ? s.approver_user_ids
            : s.approver_user_id
              ? [s.approver_user_id]
              : [];
          return {
            ...s,
            approver_user_ids: ids.map((x) => Number(x)),
            approval_limit: s.approval_limit
              ? parseFloat(s.approval_limit)
              : null,
          };
        }),
      };
      if (!isEdit) {
        const code = String(payload.workflow_code || "");
        if (!/^WF-[0-9]{6}$/.test(code)) {
          delete payload.workflow_code;
        }
      }

      if (isEdit) {
        await api.put(`/workflows/${id}`, payload);
      } else {
        await api.post("/workflows", payload);
      }
      navigate("/administration/workflows");
    } catch (error) {
      console.error("Failed to save workflow", error);
      alert(error.response?.data?.message || "Error saving workflow");
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit && !formData.workflow_code) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/administration/workflows")}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEdit ? "Edit Workflow" : "Create Workflow"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Workflow Name
              </label>
              <input
                type="text"
                name="workflow_name"
                required
                value={formData.workflow_name}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Workflow Code
              </label>
              <input
                type="text"
                name="workflow_code"
                required
                value={formData.workflow_code}
                readOnly
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white dark:bg-slate-900 text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Module Key
              </label>
              <select
                name="module_key"
                required
                value={formData.module_key}
                onChange={(e) => {
                  const mk = e.target.value;
                  setSelectedDocType("");
                  setFormData((prev) => ({
                    ...prev,
                    module_key: mk,
                    document_type: "",
                    document_route: "",
                  }));
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="">Select Module</option>
                {docTypes.length === 0 ? (
                  <>
                    <option value="PURCHASE">Purchase</option>
                    <option value="SALES">Sales</option>
                    <option value="SERVICE_MANAGEMENT">
                      Service Management
                    </option>
                    <option value="HR">HR</option>
                    <option value="FINANCE">Finance</option>
                    <option value="INVENTORY">Inventory</option>
                  </>
                ) : (
                  Array.from(new Set(docTypes.map((dt) => dt.module))).map(
                    (m) => (
                      <option
                        key={m}
                        value={String(m)
                          .toUpperCase()
                          .replace(/[^A-Z0-9]+/g, "_")
                          .replace(/^_+|_+$/g, "")}
                      >
                        {m}
                      </option>
                    ),
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Document Type
              </label>
              <select
                name="document_type"
                required
                value={selectedDocType}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDocType(val);
                  const dt =
                    docTypes.find((x) => x.code === val) ||
                    (() => {
                      const parts = String(val).split("|");
                      if (parts.length === 2) {
                        return {
                          module: parts[0],
                          label: parts[1],
                          route: `/${parts[0].toLowerCase()}/${parts[1]
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")}`,
                        };
                      }
                      return null;
                    })();
                  if (dt) {
                    setFormData((prev) => ({
                      ...prev,
                      module_key: normalizeModuleKey(dt.module),
                      document_type: dt.label || "",
                      document_route: dt.route || "",
                    }));
                  }
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="">Select Document Type</option>
                {docTypes.length === 0 ? (
                  <>
                    <option value="SERVICE MANAGEMENT|Service Request">
                      Service Request
                    </option>
                    <option value="SALES|Sales Order">Sales Order</option>
                    <option value="PURCHASE|Purchase Order">
                      Purchase Order
                    </option>
                    <option value="PURCHASE|General Requisition">
                      General Requisition
                    </option>
                    <option value="SALES|Invoice">Invoice</option>
                    <option value="INVENTORY|Work Order">Work Order</option>
                  </>
                ) : (
                  docTypes
                    .filter((dt) =>
                      formData.module_key
                        ? normalizeModuleKey(dt.module) ===
                          normalizeModuleKey(formData.module_key)
                        : true,
                    )
                    .map((dt) => (
                      <option key={dt.code} value={dt.code}>
                        {dt.label}
                      </option>
                    ))
                )}
              </select>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={fetchTransactionDocTypes}
                  className="btn btn-sm btn-secondary"
                >
                  Refresh Types
                </button>
              </div>
            </div>
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Is Active
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="email_notify"
                type="checkbox"
                name="email_notify"
                checked={!!formData.email_notify}
                onChange={handleChange}
              />
              <label htmlFor="email_notify" className="text-sm text-gray-700">
                Send email notifications to approvers
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                id="sms_notify"
                type="checkbox"
                name="sms_notify"
                checked={!!formData.sms_notify}
                onChange={handleChange}
              />
              <label htmlFor="sms_notify" className="text-sm text-gray-700">
                Send SMS notifications to approvers
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                id="whatsapp_notify"
                type="checkbox"
                name="whatsapp_notify"
                checked={!!formData.whatsapp_notify}
                onChange={handleChange}
              />
              <label htmlFor="whatsapp_notify" className="text-sm text-gray-700">
                Send WhatsApp notifications to approvers
              </label>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-700">
              Approval Steps
            </h2>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
            >
              <Plus size={16} /> Add Step
            </button>
          </div>

          <div className="space-y-4">
            {formData.steps.map((step, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row gap-4 items-start md:items-end p-4 bg-gray-50 rounded border border-gray-200"
              >
                <div className="w-full md:w-16">
                  <label className="block text-xs font-medium text-gray-500">
                    Order
                  </label>
                  <div className="mt-1 font-semibold text-center">
                    {step.step_order}
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-gray-500">
                    Step Name
                  </label>
                  <input
                    type="text"
                    value={step.step_name}
                    onChange={(e) =>
                      handleStepChange(index, "step_name", e.target.value)
                    }
                    placeholder="e.g. Manager Approval"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                  />
                </div>

                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-500">
                      Approvers (Users) <span className="text-red-500">*</span>
                    </label>
                    {Array.isArray(step.approver_user_ids) && step.approver_user_ids.length > 0 && (
                      <span className="text-[11px] text-blue-600 font-medium">
                        {step.approver_user_ids.length} selected
                      </span>
                    )}
                  </div>
                  <ApproverMultiSelect
                    selectedUserIds={step.approver_user_ids}
                    allUsers={users}
                    onChange={(nextIds) => {
                      handleStepChange(index, "approver_user_ids", nextIds);
                    }}
                  />
                  {(!step.approver_user_ids || step.approver_user_ids.length === 0) && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      ⚠️ Select one or more users who can approve this step
                    </p>
                  )}
                </div>

                <div className="w-full md:w-32">
                  <label className="block text-xs font-medium text-gray-500">
                    Limit ($)
                  </label>
                  <input
                    type="number"
                    value={step.approval_limit || ""}
                    onChange={(e) =>
                      handleStepChange(index, "approval_limit", e.target.value)
                    }
                    placeholder="No Limit"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            {formData.steps.length === 0 && (
              <p className="text-gray-500 text-sm italic text-center py-4">
                No steps defined. Click "Add Step" to begin.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate("/administration/workflows")}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? "Saving..." : "Save Workflow"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkflowForm;
