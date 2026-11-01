/**
 * @fileoverview TaxReliefList component.
 * Allows individual employees and HR managers to claim, manage, and approve statutory tax reliefs.
 * Tax reliefs directly reduce taxable income before PAYE tax brackets are applied,
 * reducing tax liability and increasing take-home pay.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client.js";
import { toast } from "react-toastify";
import { Guard } from "@/hooks/usePermissions.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import Modal from "@/components/Modal";
import {
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  User,
  AlertCircle,
  Settings,
} from "lucide-react";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function TaxReliefList() {
  const [reliefs, setReliefs] = useState([]);
  const [reliefTypes, setReliefTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [viewMode, setViewMode] = useViewMode();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [approvalModalItem, setApprovalModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    employee_id: "",
    relief_type_id: "",
    relief_name: "",
    monthly_amount: "",
    annual_amount: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    certificate_number: "",
    description: "",
    status: "ACTIVE",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resReliefs, resTypes, resEmps] = await Promise.allSettled([
        api.get("/hr/tax-reliefs"),
        api.get("/hr/tax-relief-types"),
        api.get("/hr/employees"),
      ]);

      if (resReliefs.status === "fulfilled") {
        setReliefs(resReliefs.value.data?.items || []);
      } else {
        console.error("Failed to load employee tax reliefs:", resReliefs.reason);
        toast.error("Failed to load tax reliefs data");
      }

      if (resTypes.status === "fulfilled") {
        setReliefTypes(resTypes.value.data?.items || []);
      } else {
        console.error("Failed to load tax relief types:", resTypes.reason);
      }

      if (resEmps.status === "fulfilled") {
        setEmployees(
          (resEmps.value.data?.items || []).filter(
            (e) => e.status === "ACTIVE" || !e.status
          )
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tax reliefs data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Relief Type Selection in Form
  const handleTypeChange = (typeId) => {
    const selected = reliefTypes.find((t) => String(t.id) === String(typeId));
    setFormData((prev) => ({
      ...prev,
      relief_type_id: typeId,
      relief_name: selected?.name || prev.relief_name,
    }));
  };

  // Sync monthly/annual amounts
  const handleMonthlyChange = (val) => {
    const m = parseFloat(val) || 0;
    setFormData((prev) => ({
      ...prev,
      monthly_amount: val,
      annual_amount: m > 0 ? String(Math.round(m * 12 * 100) / 100) : "",
    }));
  };

  const handleAnnualChange = (val) => {
    const a = parseFloat(val) || 0;
    setFormData((prev) => ({
      ...prev,
      annual_amount: val,
      monthly_amount: a > 0 ? String(Math.round((a / 12) * 100) / 100) : "",
    }));
  };

  const openNewModal = () => {
    setEditingItem(null);
    setFormData({
      employee_id: "",
      relief_type_id: reliefTypes.length ? String(reliefTypes[0].id) : "",
      relief_name: reliefTypes.length ? reliefTypes[0].name : "",
      monthly_amount: "",
      annual_amount: "",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      certificate_number: "",
      description: "",
      status: "ACTIVE",
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      employee_id: String(item.employee_id || ""),
      relief_type_id: String(item.relief_type_id || ""),
      relief_name: item.relief_name || "",
      monthly_amount: String(item.monthly_amount || ""),
      annual_amount: String(item.annual_amount || ""),
      start_date: item.start_date ? String(item.start_date).slice(0, 10) : "",
      end_date: item.end_date ? String(item.end_date).slice(0, 10) : "",
      certificate_number: item.certificate_number || "",
      description: item.description || "",
      status: item.status || "ACTIVE",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id) {
      toast.error("Please select an employee");
      return;
    }
    const m = parseFloat(formData.monthly_amount) || 0;
    if (m <= 0) {
      toast.error("Monthly relief amount must be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      const selectedCat = reliefTypes.find(
        (t) => String(t.id) === String(formData.relief_type_id)
      );
      const payload = {
        ...formData,
        employee_id: Number(formData.employee_id),
        relief_type_id: formData.relief_type_id ? Number(formData.relief_type_id) : null,
        relief_name: formData.relief_name || selectedCat?.name || "Tax Relief",
        monthly_amount: m,
        annual_amount: m * 12,
      };

      if (editingItem) {
        await api.put(`/hr/tax-reliefs/${editingItem.id}`, payload);
        toast.success("Employee tax relief updated successfully");
      } else {
        await api.post("/hr/tax-reliefs", payload);
        toast.success("Tax relief registered successfully");
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save tax relief");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (item, newStatus, reason = null) => {
    try {
      await api.post(`/hr/tax-reliefs/${item.id}/status`, {
        status: newStatus,
        rejection_reason: reason,
      });
      toast.success(`Tax relief marked as ${newStatus}`);
      setApprovalModalItem(null);
      setRejectionReason("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to remove tax relief for ${item.first_name} ${item.last_name}?`)) {
      return;
    }
    try {
      await api.delete(`/hr/tax-reliefs/${item.id}`);
      toast.success("Tax relief deleted successfully");
      loadData();
    } catch (err) {
      toast.error("Failed to delete tax relief");
    }
  };

  // Selected employee for modal header card
  const selectedEmp = useMemo(() => {
    return employees.find((e) => String(e.id) === String(formData.employee_id));
  }, [employees, formData.employee_id]);

  // Filtered List
  const filteredReliefs = useMemo(() => {
    return reliefs.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        `${item.first_name || ""} ${item.last_name || ""}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (item.emp_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.relief_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.certificate_number || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        filterStatus === "ALL" ||
        item.status === filterStatus ||
        (filterStatus === "ACTIVE" && (item.status === "ACTIVE" || item.status === "APPROVED"));

      const matchesType =
        filterType === "ALL" || String(item.relief_type_id) === String(filterType);

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [reliefs, searchQuery, filterStatus, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const activeList = reliefs.filter(
      (r) => r.status === "ACTIVE" || r.status === "APPROVED"
    );
    const totalMonthly = activeList.reduce(
      (sum, r) => sum + Number(r.monthly_amount || 0),
      0
    );
    const totalAnnual = activeList.reduce(
      (sum, r) => sum + Number(r.annual_amount || 0),
      0
    );
    const pendingCount = reliefs.filter((r) => r.status === "PENDING").length;
    const employeesBenefiting = new Set(activeList.map((r) => r.employee_id)).size;

    return {
      activeCount: activeList.length,
      totalMonthly,
      totalAnnual,
      pendingCount,
      employeesBenefiting,
    };
  }, [reliefs]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Pending Review
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Inactive
          </span>
        );
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Employee Tax Reliefs
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Manage employee statutory tax reliefs that reduce PAYE assessable income and boost net pay
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/human-resources" className="btn-secondary">
              ← Back to Menu
            </Link>
            <Link
              to="/human-resources/setup?tab=tax-relief-types"
              className="btn-secondary flex items-center gap-1.5"
              title="Configure Statutory Relief Categories in HR Setup"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Categories</span>
            </Link>
            <button
              onClick={openNewModal}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Claim / New Tax Relief
            </button>
          </div>
        </div>

        {/* Stat Cards - Numbers rendered in clean black / dark mode white */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Reliefs
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats.activeCount}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Across {stats.employeesBenefiting} employee(s)
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly Relief Total
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              GHS {fmt(stats.totalMonthly)}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Deducted from taxable income
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Annual Relief Value
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              GHS {fmt(stats.totalAnnual)}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Full year tax deduction
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Review
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats.pendingCount}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Awaiting HR verification
            </span>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee, code, or relief name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-full text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active / Approved</option>
              <option value="PENDING">Pending Review</option>
              <option value="REJECTED">Rejected</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="ALL">All Relief Types</option>
              {reliefTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        {/* Content View: Table or Grid */}
        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-400" />
            Loading employee tax relief records...
          </div>
        ) : filteredReliefs.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">
              No Tax Reliefs Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              No employee tax reliefs matched the current search criteria or none have been submitted yet.
            </p>
            <button onClick={openNewModal} className="btn-primary mt-4 inline-flex items-center gap-2 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Claim First Tax Relief
            </button>
          </div>
        ) : viewMode !== "grid" ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Relief Details</th>
                    <th className="px-4 py-3 text-right">Monthly Relief</th>
                    <th className="px-4 py-3 text-right">Annual Relief</th>
                    <th className="px-4 py-3">Effective Period</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredReliefs.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {r.first_name} {r.last_name}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {r.emp_code}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {r.relief_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                            {r.type_name || "Statutory Relief"}
                          </span>
                          {r.certificate_number && (
                            <span className="text-[11px] text-slate-400">
                              Ref: {r.certificate_number}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        GHS {fmt(r.monthly_amount)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                        GHS {fmt(r.annual_amount)}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        <div>
                          From: {r.start_date ? String(r.start_date).slice(0, 10) : "Immediate"}
                        </div>
                        {r.end_date && (
                          <div className="text-slate-400">
                            Until: {String(r.end_date).slice(0, 10)}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(r.status)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(r, "APPROVED")}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded shadow-xs"
                                title="Approve Relief"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setApprovalModalItem(r)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded shadow-xs"
                                title="Reject Relief"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEditModal(r)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Edit Tax Relief"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReliefs.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                      {r.first_name?.[0]}
                      {r.last_name?.[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">
                        {r.first_name} {r.last_name}
                      </h4>
                      <span className="text-xs font-mono text-slate-500">
                        {r.emp_code}
                      </span>
                    </div>
                  </div>
                  {getStatusBadge(r.status)}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-2 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Relief:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {r.relief_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Monthly Reduction:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      GHS {fmt(r.monthly_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Annual Value:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      GHS {fmt(r.annual_amount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                  <span className="text-slate-400">
                    From {r.start_date ? String(r.start_date).slice(0, 10) : "Start"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(r)}
                      className="text-brand hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      className="text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Claim / Edit Tax Relief (Standard ERP HR Modal Orientation) */}
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title={editingItem ? "Edit Employee Tax Relief" : "Claim / New Employee Tax Relief"}
          subtitle="Register employee statutory tax relief to reduce taxable income before PAYE brackets"
          icon={ShieldCheck}
          maxWidth="max-w-2xl"
          showFooter={false}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Employee Summary Header Card */}
            {selectedEmp && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Employee
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 block">
                    {selectedEmp.first_name} {selectedEmp.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Base Salary
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block">
                    GHS {fmt(selectedEmp.base_salary)}
                  </span>
                  <span className="text-[10px] text-slate-400">Monthly</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Department
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
                    {selectedEmp.dept_name || "General"}
                  </span>
                </div>
              </div>
            )}

            {/* Row 1: Employee & Category (No employee ID / code in options, no amount attached in category options) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  className="input w-full text-sm"
                  value={formData.employee_id}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, employee_id: e.target.value }))
                  }
                  required
                >
                  <option value="">— Select Employee —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Relief Category <span className="text-red-500">*</span>
                  </label>
                  <Link
                    to="/human-resources/setup?tab=tax-relief-types"
                    target="_blank"
                    className="text-[10px] text-brand hover:underline"
                    title="Open HR Setup in new tab"
                  >
                    + Manage Categories
                  </Link>
                </div>
                <select
                  className="input w-full text-sm"
                  value={formData.relief_type_id}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  required
                >
                  <option value="">— Select Category —</option>
                  {reliefTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Monthly Relief & Certificate / Document Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Monthly Relief Amount (GHS) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono text-slate-400">
                    GHS
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input pl-12 w-full font-mono font-bold text-slate-900 dark:text-white"
                    value={formData.monthly_amount}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, monthly_amount: e.target.value }))
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Deducted directly from assessable taxable income
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Certificate / Document Number
                </label>
                <input
                  type="text"
                  className="input w-full text-sm font-mono"
                  value={formData.certificate_number}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      certificate_number: e.target.value,
                    }))
                  }
                  placeholder="e.g. MC-2024-991, CER-0012"
                />
              </div>
            </div>

            {/* Row 3: Dates & Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Effective Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="input w-full text-sm"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, start_date: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Effective End Date
                </label>
                <input
                  type="date"
                  className="input w-full text-sm"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, end_date: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Status
                </label>
                <select
                  className="input w-full text-sm"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  <option value="ACTIVE">Active (Immediate)</option>
                  <option value="PENDING">Pending HR Review</option>
                  <option value="INACTIVE">Inactive / On Hold</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary text-sm"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-sm flex items-center gap-2"
                disabled={submitting}
              >
                {submitting ? "Saving..." : editingItem ? "Update Tax Relief" : "Save Tax Relief"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Rejection Reason */}
        <Modal
          open={!!approvalModalItem}
          onClose={() => setApprovalModalItem(null)}
          title="Reject Tax Relief Claim"
          subtitle={`Specify reason for rejecting tax relief for ${approvalModalItem?.first_name || ""} ${approvalModalItem?.last_name || ""}`}
          icon={AlertCircle}
          maxWidth="max-w-md"
          showFooter={false}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Please enter an explanation for the audit log so the employee and payroll team are notified.
            </p>
            <textarea
              className="input w-full text-xs"
              rows={3}
              placeholder="Reason (e.g. missing supporting certificate, expired document, exceeds statutory allowance)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setApprovalModalItem(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleStatusUpdate(approvalModalItem, "REJECTED", rejectionReason)
                }
                className="btn-danger text-xs px-3 py-1.5"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Guard>
  );
}
