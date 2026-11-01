/**
 * @fileoverview HRSetup component.
 * Provides functionality for HRSetup.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../hooks/usePermissions.jsx";
import { Mail, FileText, CheckCircle2, Sparkles, RefreshCw, Copy, Send } from "lucide-react";

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function HRSetup() {
  const location = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const getTabFromLocation = useCallback(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) return tabParam;
    const path = location.pathname.toLowerCase();
    if (path.includes("/departments")) return "departments";
    if (path.includes("/designations") || path.includes("/job-roles"))
      return "positions";
    if (path.includes("/branches") || path.includes("/locations"))
      return "locations";
    if (path.includes("/shifts")) return "shifts";
    if (path.includes("/leave-types") || path.includes("/leave-setup"))
      return "leave-types";
    if (path.includes("/tax-relief-types") || path.includes("/tax-relief-setup"))
      return "tax-relief-types";
    return "departments";
  }, [location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState(getTabFromLocation());

  useEffect(() => {
    setActiveTab(getTabFromLocation());
  }, [location.pathname, location.search, getTabFromLocation]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  const shiftTotalHours = useMemo(() => {
    const toMins = (t) => {
      if (!t || typeof t !== "string") return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const start = toMins(form.start_time);
    const end = toMins(form.end_time);
    let diff = end - start;
    if (diff < 0) diff += 24 * 60;
    diff -= Number(form.break_minutes || 0);
    if (diff < 0) return "N/A";
    return `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, "0")}m`;
  }, [form.start_time, form.end_time, form.break_minutes]);

  const extractItems = (res) => {
    if (!res) return [];
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data?.data?.items)) return res.data.data.items;
    return [];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "departments") endpoint = "/hr/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "locations") endpoint = "/hr/setup/locations";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods")
        endpoint = "/hr/payroll/periods";
      else if (activeTab === "employment-types")
        endpoint = "/hr/setup/employment-types";
      else if (activeTab === "employee-categories")
        endpoint = "/hr/setup/employee-categories";
      else if (activeTab === "loan-types") endpoint = "/hr/loan-types";
      else if (activeTab === "tax-relief-types") endpoint = "/hr/tax-relief-types";
      else if (activeTab === "shifts") endpoint = "/hr/shifts";
      else if (activeTab === "parameters" || activeTab === "welcome-email-template" || activeTab === "promotion-templates") endpoint = "/hr/setup/parameters";
      else if (activeTab === "salary-components")
        endpoint = "/hr/salary-component-definitions";

      let res = null;
      try {
        res = await api.get(endpoint);
      } catch {
        if (activeTab === "departments") {
          res = await api.get("/admin/departments").catch(() => null);
        }
      }

      if (activeTab === "parameters" || activeTab === "welcome-email-template" || activeTab === "promotion-templates") {
        setItems([]);
        const params = extractItems(res);
        const formObj = {};
        params.forEach((p) => {
          if (p?.param_key) formObj[p.param_key] = p.param_value;
        });

        if (activeTab === "welcome-email-template") {
          if (!formObj.welcome_email_subject) {
            formObj.welcome_email_subject = "Welcome to {{company_name}} - Your Employee Portal Account";
          }
          if (!formObj.welcome_email_template) {
            formObj.welcome_email_template = "Hello {{employee_name}},\n\nWelcome to {{company_name}}! Your official employee portal account has been created.\n\nYour login credentials are:\nUsername: {{username}}\nTemporary Password: {{password}}\nStaff ID: {{emp_code}}\n\nPlease log in to access your payslips, submit leave requests, and manage staff operations. For security, please update your password on first login.\n\nBest regards,\nHuman Resources Department\n{{company_name}}";
          }
        }

        if (activeTab === "promotion-templates") {
          if (!formObj.promotion_letter_subject) {
            formObj.promotion_letter_subject = "Congratulations on Your Promotion to {{new_position}} - {{company_name}}";
          }
          if (!formObj.promotion_letter_template) {
            formObj.promotion_letter_template = "Dear {{employee_name}},\n\nOn behalf of executive management, we are delighted to congratulate you on your official promotion to {{new_position}} (moving upward from {{previous_position}}), effective {{effective_date}}!\n\nNew Base Salary: {{new_salary}}\n\nRemarks:\n{{remarks}}\n\nThis promotion is a direct recognition of your dedication and valuable contributions to {{company_name}}. We look forward to your continued leadership and success in this expanded role.\n\nSincerely,\nHuman Resources Department\n{{company_name}}";
          }
          const existingReassignSub = formObj.reassignment_letter_subject || formObj.demotion_letter_subject;
          formObj.reassignment_letter_subject = existingReassignSub || "Official Notice: Role Reassignment to {{new_position}} - {{company_name}}";
          
          const existingReassignTpl = formObj.reassignment_letter_template || formObj.demotion_letter_template;
          formObj.reassignment_letter_template = existingReassignTpl || "Dear {{employee_name}},\n\nThis official communication is to inform you that following recent internal administrative evaluations, your employment role within {{company_name}} has been reassigned to {{new_position}} (transitioning from {{previous_position}}), effective {{effective_date}}.\n\nAdministrative Remarks:\n{{remarks}}\n\nYour supervisor will meet with you to review your updated duties, expectations, and reporting structure. Please contact the HR department if you require any clarification.\n\nSincerely,\nHuman Resources Department\n{{company_name}}";
        }

        setForm(formObj);
      } else if (activeTab === "loan-types") {
        setItems(extractItems(res));
        try {
          const accRes = await api.get("/finance/accounts?active=1");
          setAccounts(extractItems(accRes));
        } catch {}
      } else {
        setItems(extractItems(res));
      }
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setForm({});
    setIsEditing(false);
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let endpoint = "";
      if (activeTab === "departments") endpoint = "/hr/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "locations") endpoint = "/hr/setup/locations";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods")
        endpoint = "/hr/payroll/periods";
      else if (activeTab === "employment-types")
        endpoint = "/hr/setup/employment-types";
      else if (activeTab === "employee-categories")
        endpoint = "/hr/setup/employee-categories";
      else if (activeTab === "loan-types") endpoint = "/hr/loan-types";
      else if (activeTab === "shifts") endpoint = "/hr/shifts";
      else if (activeTab === "salary-components")
        endpoint = "/hr/salary-component-definitions";

      const payload = {
        ...form,
        component_type:
          activeTab === "salary-components"
            ? (form.component_type || "ALLOWANCE")
            : form.component_type,
        dept_name: form.dept_name || form.name,
        dept_code: form.dept_code || form.code,
        name:
          form.name ||
          form.dept_name ||
          form.pos_name ||
          form.location_name ||
          form.type_name,
        code: form.code || form.dept_code || form.pos_code,
        pos_name: form.pos_name || form.name,
        pos_code: form.pos_code || form.code,
        location_name: form.location_name || form.name,
        type_name: form.type_name || form.name,
        days_per_year: form.days_per_year || form.max_days,
        max_days: form.max_days || form.days_per_year,
      };

      if (activeTab === "departments" || activeTab === "shifts") {
        if (isEditing && form.id) {
          await api.put(`${endpoint}/${form.id}`, payload);
        } else {
          await api.post(endpoint, payload);
        }
      } else if (activeTab === "parameters" || activeTab === "welcome-email-template" || activeTab === "promotion-templates") {
        endpoint = "/hr/setup/parameters";
        const paramsPayload = { ...form };
        if (activeTab === "promotion-templates") {
          // Sync reassignment parameters
          paramsPayload.demotion_letter_subject = paramsPayload.reassignment_letter_subject;
          paramsPayload.demotion_letter_template = paramsPayload.reassignment_letter_template;
        }
        await api.post(endpoint, { parameters: paramsPayload });
        toast.success(
          activeTab === "welcome-email-template"
            ? "Welcome email template saved successfully"
            : activeTab === "promotion-templates"
              ? "Promotion and demotion templates saved successfully"
              : "Parameters saved successfully"
        );
        loadData();
        return;
      } else {
        await api.post(endpoint, payload);
      }

      toast.success("Saved successfully");
      setForm({});
      setIsEditing(false);
      loadData();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unexpected server error";
      toast.error(`Failed to save: ${message}`);
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setIsEditing(true);
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/human-resources" className="btn-secondary text-sm">Back to Menu</Link>
          <h2 className="text-lg font-semibold">HR Setup & Parameters</h2>
        </div>

        <div className="flex border-b mb-6 overflow-x-auto">
          {[
            { id: "locations", label: "Branches" },
            { id: "departments", label: "Departments" },
            { id: "positions", label: "Job Roles Setup" },
            { id: "shifts", label: "Shifts" },
            { id: "leave-types", label: "Leave Types" },
            { id: "payroll-periods", label: "Payroll Periods" },
            { id: "employment-types", label: "Employment Types" },
            { id: "employee-categories", label: "Employee Categories" },
            { id: "loan-types", label: "Loan Types" },
            { id: "tax-relief-types", label: "Tax Relief Categories" },
            { id: "welcome-email-template", label: "Welcome Email Template" },
            { id: "promotion-templates", label: "Promotion / Reassignment Templates" },
            { id: "parameters", label: "Parameters" },
            { id: "salary-components", label: "Salary Components" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-b-2 border-brand text-brand"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "welcome-email-template" ? (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-brand" />
                  New Employee Welcome Email Template
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customize the automated email sent to new staff with their login username and randomly generated credentials.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      welcome_email_subject: "Welcome to {{company_name}} - Your Employee Portal Account",
                      welcome_email_template: "Hello {{employee_name}},\n\nWelcome to {{company_name}}! Your official employee portal account has been created.\n\nYour login credentials are:\nUsername: {{username}}\nTemporary Password: {{password}}\nStaff ID: {{emp_code}}\n\nPlease log in to access your payslips, submit leave requests, and manage staff operations. For security, please update your password on first login.\n\nBest regards,\nHuman Resources Department\n{{company_name}}",
                    }));
                    toast.info("Template reset to defaults (click Save to apply)");
                  }}
                  className="btn-secondary text-xs h-9 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn-primary text-xs h-9 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Template
                </button>
              </div>
            </div>

            {/* Placeholders Guide */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                Supported Dynamic Placeholders (Click to insert)
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: "{{employee_name}}", desc: "Full Name" },
                  { tag: "{{username}}", desc: "First & Last Name without space" },
                  { tag: "{{password}}", desc: "8-Char Random Password (1 Upper, 1 Digit, 1 Special)" },
                  { tag: "{{emp_code}}", desc: "Staff Code" },
                  { tag: "{{company_name}}", desc: "Company / Organization Name" },
                ].map((p) => (
                  <button
                    key={p.tag}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        welcome_email_template: (f.welcome_email_template || "") + " " + p.tag,
                      }));
                      toast.info(`Inserted ${p.tag}`);
                    }}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-brand hover:border-brand transition shadow-2xs"
                    title={p.desc}
                  >
                    <code>{p.tag}</code>
                    <span className="text-[10px] text-slate-500 font-sans">({p.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Editor */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    className="input w-full font-medium text-sm"
                    value={form.welcome_email_subject || ""}
                    onChange={(e) => setForm({ ...form, welcome_email_subject: e.target.value })}
                    placeholder="e.g. Welcome to {{company_name}} - Your Employee Portal Account"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Email Message Content
                  </label>
                  <textarea
                    rows={12}
                    className="input w-full font-sans text-sm leading-relaxed p-3"
                    value={form.welcome_email_template || ""}
                    onChange={(e) => setForm({ ...form, welcome_email_template: e.target.value })}
                    placeholder="Write your email body here. Placeholders like {{username}} and {{password}} will be automatically replaced."
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Live Preview (Simulated with Sample Employee)
                </label>
                <div className="border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 shadow-xs">
                  <div className="bg-slate-800 text-white p-3 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-400">Subject: </span>
                      <span className="font-semibold">
                        {(form.welcome_email_subject || "Welcome to {{company_name}}")
                          .replace(/\{\{company_name\}\}/g, "OmniSuite")
                          .replace(/\{\{employee_name\}\}/g, "Enoch Asamoah")
                          .replace(/\{\{username\}\}/g, "enochasamoah")
                          .replace(/\{\{password\}\}/g, "K8#mP2x9")}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Preview</span>
                  </div>
                  <div className="p-5 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-800">
                    {(form.welcome_email_template || "")
                      .replace(/\{\{company_name\}\}/g, "OmniSuite Corp")
                      .replace(/\{\{employee_name\}\}/g, "Enoch Asamoah")
                      .replace(/\{\{username\}\}/g, "enochasamoah")
                      .replace(/\{\{password\}\}/g, "K8#mP2x9")
                      .replace(/\{\{emp_code\}\}/g, "EMP-0012")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "promotion-templates" ? (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand" />
                  Promotion & Demotion Letter Templates
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure official letters dispatched to employees when a promotion, demotion, or role reassignment is saved or sent from the list.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      promotion_letter_subject: "Congratulations on Your Promotion to {{new_position}} - {{company_name}}",
                      promotion_letter_template: "Dear {{employee_name}},\n\nOn behalf of executive management, we are delighted to congratulate you on your official promotion to {{new_position}} (moving upward from {{previous_position}}), effective {{effective_date}}!\n\nNew Base Salary: {{new_salary}}\n\nRemarks:\n{{remarks}}\n\nThis promotion is a direct recognition of your dedication and valuable contributions to {{company_name}}. We look forward to your continued leadership and success in this expanded role.\n\nSincerely,\nHuman Resources Department\n{{company_name}}",
                      demotion_letter_subject: "Official Notice: Reassignment to {{new_position}} - {{company_name}}",
                      demotion_letter_template: "Dear {{employee_name}},\n\nThis official communication is to inform you that following recent internal administrative evaluations, your employment role within {{company_name}} has been reassigned to {{new_position}} (transitioning from {{previous_position}}), effective {{effective_date}}.\n\nNew Base Salary: {{new_salary}}\n\nAdministrative Remarks:\n{{remarks}}\n\nYour supervisor will meet with you to review your updated duties and reporting structure. Please contact the HR department if you require any clarification.\n\nSincerely,\nHuman Resources Department\n{{company_name}}",
                    }));
                    toast.info("Templates reset to defaults (click Save to apply)");
                  }}
                  className="btn-secondary text-xs h-9 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn-primary text-xs h-9 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Templates
                </button>
              </div>
            </div>

            {/* Placeholders Guide */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                Supported Dynamic Placeholders
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: "{{employee_name}}", desc: "Full Name" },
                  { tag: "{{previous_position}}", desc: "Previous Role" },
                  { tag: "{{new_position}}", desc: "Assigned Role" },
                  { tag: "{{effective_date}}", desc: "Effective Date" },
                  { tag: "{{new_salary}}", desc: "New Base Salary (Promotion only)" },
                  { tag: "{{remarks}}", desc: "HR Remarks" },
                  { tag: "{{company_name}}", desc: "Company Name" },
                ].map((p) => (
                  <span
                    key={p.tag}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-brand shadow-2xs"
                  >
                    <code>{p.tag}</code>
                    <span className="text-[10px] text-slate-500 font-sans">({p.desc})</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Promotion Template Card */}
              <div className="border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-5 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm uppercase tracking-wide">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Official Promotion Letter Template
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Promotion Subject Line
                  </label>
                  <input
                    type="text"
                    className="input w-full font-medium text-sm"
                    value={form.promotion_letter_subject || ""}
                    onChange={(e) => setForm({ ...form, promotion_letter_subject: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Promotion Message Body
                  </label>
                  <textarea
                    rows={10}
                    className="input w-full font-sans text-sm leading-relaxed p-3"
                    value={form.promotion_letter_template || ""}
                    onChange={(e) => setForm({ ...form, promotion_letter_template: e.target.value })}
                  />
                </div>
              </div>

              {/* Reassignment Template Card */}
              <div className="border border-blue-200 dark:border-blue-800/40 rounded-xl p-5 bg-blue-50/20 dark:bg-blue-950/10 space-y-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm uppercase tracking-wide">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Official Role Reassignment Letter Template
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reassignment Subject Line
                  </label>
                  <input
                    type="text"
                    className="input w-full font-medium text-sm"
                    value={form.reassignment_letter_subject || form.demotion_letter_subject || ""}
                    onChange={(e) => setForm({ ...form, reassignment_letter_subject: e.target.value, demotion_letter_subject: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reassignment Message Body (Salary is Excluded)
                  </label>
                  <textarea
                    rows={10}
                    className="input w-full font-sans text-sm leading-relaxed p-3"
                    value={form.reassignment_letter_template || form.demotion_letter_template || ""}
                    onChange={(e) => setForm({ ...form, reassignment_letter_template: e.target.value, demotion_letter_template: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
              <h3 className="font-medium mb-4">
                {activeTab === "parameters"
                  ? "Update Settings"
                  : (isEditing ? "Edit" : "Add New") +
                    " " +
                    activeTab.replace("-", " ")}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                  {activeTab === "salary-components" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Component Name
                        </label>
                        <input
                          className="input"
                          value={form.component_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, component_name: e.target.value })
                          }
                          placeholder="e.g. Housing Allowance"
                          maxLength={100}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Component Type
                        </label>
                        <select
                          className="input"
                          value={form.component_type || "ALLOWANCE"}
                          onChange={(e) =>
                            setForm({ ...form, component_type: e.target.value })
                          }
                        >
                          <option value="ALLOWANCE">Allowance / Earning</option>
                          <option value="DEDUCTION">Deduction</option>
                        </select>
                      </div>
                      <label className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <input
                          type="checkbox"
                          checked={!!form.manual_calculation}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              manual_calculation: e.target.checked,
                            })
                          }
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            Manual monthly amount
                          </span>
                          <span className="block text-xs text-slate-500">
                            Enter an employee-specific amount for each payroll
                            period instead of calculating it from a fixed amount
                            or percentage.
                          </span>
                        </span>
                      </label>
                      <div>
                        <label className="block text-sm mb-1">Status</label>
                        <select
                          className="input"
                          value={
                            form.is_active === false || form.is_active === 0
                              ? "0"
                              : "1"
                          }
                          onChange={(e) =>
                            setForm({
                              ...form,
                              is_active: e.target.value === "1",
                            })
                          }
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "shifts" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Code</label>
                        <input
                          className="input"
                          value={form.code || ""}
                          onChange={(e) =>
                            setForm({ ...form, code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Name</label>
                        <input
                          className="input"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1">
                            Start Time
                          </label>
                          <input
                            className="input"
                            type="time"
                            value={form.start_time || ""}
                            onChange={(e) =>
                              setForm({ ...form, start_time: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">End Time</label>
                          <input
                            className="input"
                            type="time"
                            value={form.end_time || ""}
                            onChange={(e) =>
                              setForm({ ...form, end_time: e.target.value })
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm mb-1">
                            Break Minutes
                          </label>
                          <input
                            className="input"
                            type="number"
                            value={form.break_minutes || 0}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                break_minutes: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">
                            Total Hours
                          </label>
                          <input
                            className="input"
                            type="text"
                            value={(() => {
                              const toMin = (t) => {
                                if (!t) return 0;
                                const [hh, mm] = String(t)
                                  .split(":")
                                  .map(Number);
                                return (hh % 24) * 60 + (mm || 0);
                              };
                              const s = toMin(form.start_time);
                              const e = toMin(form.end_time);
                              let d = e - s;
                              if (d < 0) d += 24 * 60;
                              d -= Number(form.break_minutes || 0);
                              const h = Math.max(0, d) / 60;
                              return isFinite(h) ? h.toFixed(2) : "0.00";
                            })()}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Status</label>
                          <select
                            className="input"
                            value={form.is_active ? "1" : "0"}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                is_active: e.target.value === "1",
                              })
                            }
                          >
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                  {activeTab === "departments" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Code</label>
                        <input
                          className="input"
                          value={form.code || ""}
                          onChange={(e) =>
                            setForm({ ...form, code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Name</label>
                        <input
                          className="input"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "locations" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Location Name
                        </label>
                        <input
                          className="input"
                          value={form.location_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, location_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Address</label>
                        <textarea
                          className="input"
                          value={form.address || ""}
                          onChange={(e) =>
                            setForm({ ...form, address: e.target.value })
                          }
                          rows="2"
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "positions" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Code</label>
                        <input
                          className="input"
                          value={form.pos_code || ""}
                          onChange={(e) =>
                            setForm({ ...form, pos_code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Name</label>
                        <input
                          className="input"
                          value={form.pos_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, pos_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Reports To (Position)
                        </label>
                        <select
                          className="input"
                          value={form.reports_to_pos_id || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              reports_to_pos_id: e.target.value,
                            })
                          }
                        >
                          <option value="">-- None --</option>
                          {items
                            .filter((p) => !form.id || p.id !== form.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.pos_name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "leave-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Type Name</label>
                        <input
                          className="input"
                          value={form.type_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, type_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Days Per Year
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={form.max_days || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              max_days: Number(e.target.value),
                            })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "payroll-periods" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Period Name
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. March 2026"
                          value={form.period_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, period_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Start Date</label>
                        <input
                          className="input"
                          type="date"
                          value={form.start_date || ""}
                          onChange={(e) =>
                            setForm({ ...form, start_date: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">End Date</label>
                        <input
                          className="input"
                          type="date"
                          value={form.end_date || ""}
                          onChange={(e) =>
                            setForm({ ...form, end_date: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "employment-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Type Name</label>
                        <input
                          className="input"
                          placeholder="e.g. Full-Time, Contract"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "employee-categories" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Category Name
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. Management, Staff"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "tax-relief-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200">
                          Category Code *
                        </label>
                        <input
                          className="input w-full"
                          placeholder="e.g. MARRIAGE, CHILD_EDU"
                          value={form.code || ""}
                          onChange={(e) => setForm({ ...form, code: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200">
                          Relief Category Name *
                        </label>
                        <input
                          className="input w-full"
                          placeholder="e.g. Marriage / Responsibility Relief"
                          value={form.name || ""}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="block text-xs sm:text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200 truncate">
                            Max Monthly (GHS)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input w-full min-w-0 font-mono"
                            placeholder="100.00"
                            value={form.max_monthly_amount || ""}
                            onChange={(e) => {
                              const m = parseFloat(e.target.value) || 0;
                              setForm({
                                ...form,
                                max_monthly_amount: e.target.value,
                                max_annual_amount: m > 0 ? (m * 12).toFixed(2) : form.max_annual_amount,
                              });
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-xs sm:text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200 truncate">
                            Max Annual (GHS)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input w-full min-w-0 font-mono"
                            placeholder="1200.00"
                            value={form.max_annual_amount || ""}
                            onChange={(e) => {
                              const a = parseFloat(e.target.value) || 0;
                              setForm({
                                ...form,
                                max_annual_amount: e.target.value,
                                max_monthly_amount: a > 0 ? (a / 12).toFixed(2) : form.max_monthly_amount,
                              });
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200">
                          Description & Qualification Rules
                        </label>
                        <textarea
                          className="input w-full h-20"
                          placeholder="e.g. Granted to married employees or those caring for at least 2 children under 16 years."
                          value={form.description || ""}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                      </div>
                      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.requires_approval !== 0 && form.requires_approval !== false}
                          onChange={(e) => setForm({ ...form, requires_approval: e.target.checked ? 1 : 0 })}
                        />
                        <span>Requires HR Approval before applying to payroll</span>
                      </label>
                      <div>
                        <label className="block text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200">
                          Status
                        </label>
                        <select
                          className="input w-full"
                          value={form.is_active !== false && form.is_active !== 0 ? "1" : "0"}
                          onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "loan-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200">
                          Loan Type Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. Salary Advance, Personal Loan, Car Loan"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-semibold text-slate-700 dark:text-slate-200">
                          Status
                        </label>
                        <select
                          className="input"
                          value={form.is_active ? "1" : "0"}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              is_active: e.target.value === "1",
                            })
                          }
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "shifts" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Shift Code *
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. DAY, NIGHT"
                          value={form.code || ""}
                          onChange={(e) =>
                            setForm({ ...form, code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Shift Name *
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. Standard Day Shift"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Start Time *
                        </label>
                        <input
                          className="input"
                          type="time"
                          value={form.start_time || "08:00"}
                          onChange={(e) =>
                            setForm({ ...form, start_time: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">End Time *</label>
                        <input
                          className="input"
                          type="time"
                          value={form.end_time || "17:00"}
                          onChange={(e) =>
                            setForm({ ...form, end_time: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Break Minutes
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={form.break_minutes ?? 60}
                          onChange={(e) =>
                            setForm({ ...form, break_minutes: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Total Hours
                        </label>
                        <div className="input bg-slate-50 dark:bg-slate-900/50 font-semibold text-brand">
                          {shiftTotalHours}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Status</label>
                        <select
                          className="input"
                          value={form.is_active ? "1" : "0"}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              is_active: e.target.value === "1",
                            })
                          }
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "parameters" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1 font-semibold">
                          Regular Working Hours (Daily)
                        </label>
                        <input
                          className="input"
                          type="number"
                          step="0.5"
                          value={form.REGULAR_WORKING_HOURS || "8"}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              REGULAR_WORKING_HOURS: e.target.value,
                            })
                          }
                          required
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Used for OT calculations in timesheets.
                        </p>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary flex-1">
                      Save
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm({});
                          setIsEditing(false);
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-2">
            {activeTab === "salary-components" ? (
              <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="text-left text-xs font-bold uppercase text-slate-500">
                      <th className="px-4 py-3">Component</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Calculation</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3 font-medium">
                          {item.component_name}
                        </td>
                        <td className="px-4 py-3">
                          {item.component_type === "ALLOWANCE"
                            ? "Allowance / Earning"
                            : "Deduction"}
                        </td>
                        <td className="px-4 py-3">
                          {item.manual_calculation
                            ? "Manual monthly amount"
                            : "Fixed or percentage"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="text-brand text-sm hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          No salary component definitions configured
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              activeTab !== "parameters" && (
                <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                      <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Details
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-2">
                            {activeTab === "shifts" && (
                              <div>
                                <div className="font-medium">
                                  {item.name}{" "}
                                  <span className="text-xs text-slate-500">
                                    ({item.code})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.start_time} - {item.end_time} •{" "}
                                  {(() => {
                                    const toMin = (t) => {
                                      if (!t) return 0;
                                      const [hh, mm] = String(t)
                                        .split(":")
                                        .map(Number);
                                      return (hh % 24) * 60 + (mm || 0);
                                    };
                                    const s = toMin(item.start_time);
                                    const e = toMin(item.end_time);
                                    let d = e - s;
                                    if (d < 0) d += 24 * 60;
                                    d -= Number(item.break_minutes || 0);
                                    const h = Math.max(0, d) / 60;
                                    return `${isFinite(h) ? h.toFixed(2) : "0.00"} hrs`;
                                  })()}{" "}
                                  {item.break_minutes
                                    ? `• Break ${item.break_minutes} min`
                                    : ""}
                                </div>
                              </div>
                            )}
                            {activeTab === "locations" && (
                              <div>
                                <div className="font-medium">
                                  {item.location_name ||
                                    item.name ||
                                    item.title ||
                                    "Unnamed Location"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.address || "No address specified"}
                                </div>
                              </div>
                            )}
                            {activeTab === "departments" && (
                              <div>
                                <div className="font-medium">
                                  {item.dept_name ||
                                    item.name ||
                                    item.title ||
                                    "Unnamed Department"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.dept_code || item.code || "—"}
                                </div>
                              </div>
                            )}
                            {activeTab === "positions" && (
                              <div>
                                <div className="font-medium">
                                  {item.pos_name ||
                                    item.name ||
                                    item.title ||
                                    "Unnamed Position"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Code: {item.pos_code || item.code || "—"}{" "}
                                  {item.parent_pos_name
                                    ? `• Reports to: ${item.parent_pos_name}`
                                    : ""}{" "}
                                  {item.dept_name
                                    ? `• Dept: ${item.dept_name}`
                                    : ""}
                                </div>
                              </div>
                            )}
                            {activeTab === "leave-types" && (
                              <div>
                                <div className="font-medium">
                                  {item.type_name ||
                                    item.name ||
                                    item.leave_type ||
                                    "Unnamed Leave Type"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.days_per_year ?? item.max_days ?? 0}{" "}
                                  days/year
                                </div>
                              </div>
                            )}
                            {activeTab === "payroll-periods" && (
                              <div>
                                <div className="font-medium">
                                  {item.period_name ||
                                    item.name ||
                                    "Unnamed Period"}
                                </div>
                                {(item.start_date || item.end_date) && (
                                  <div className="text-xs text-slate-500">
                                    {item.start_date
                                      ? String(item.start_date).split("T")[0]
                                      : "—"}{" "}
                                    to{" "}
                                    {item.end_date
                                      ? String(item.end_date).split("T")[0]
                                      : "—"}
                                  </div>
                                )}
                              </div>
                            )}
                            {activeTab === "loan-types" && (
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {item.name || item.loan_type_name || "Unnamed Loan Type"}
                                </div>
                                {(() => {
                                  const accCode = item.account_code || (accounts.find((a) => String(a.id) === String(item.account_id))?.code);
                                  const accName = item.account_name || (accounts.find((a) => String(a.id) === String(item.account_id))?.name);
                                  const accGroup = item.account_group_name || (accounts.find((a) => String(a.id) === String(item.account_id))?.group_name);
                                  return accCode ? (
                                    <div className="mt-1 flex items-center flex-wrap gap-1.5 text-xs">
                                      <span className="font-mono bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-bold">
                                        {accCode}
                                      </span>
                                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                                        {accName}
                                      </span>
                                      {accGroup && (
                                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                          ({accGroup})
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                      Account will be auto-created on save
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {activeTab === "tax-relief-types" && (
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{item.name}</span>
                                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {item.code}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span>Monthly Max: <strong className="font-mono text-slate-800 dark:text-slate-200">GHS {Number(item.max_monthly_amount || 0).toFixed(2)}</strong></span>
                                  <span>Annual Max: <strong className="font-mono text-slate-800 dark:text-slate-200">GHS {Number(item.max_annual_amount || 0).toFixed(2)}</strong></span>
                                </div>
                              </div>
                            )}
                            {(activeTab === "employment-types" ||
                              activeTab === "employee-categories") && (
                              <div>
                                <div className="font-medium">
                                  {item.name ||
                                    item.type_name ||
                                    item.category_name ||
                                    item.allowance_name ||
                                    item.loan_type_name ||
                                    "Unnamed Record"}
                                </div>
                                {(item.code || item.type_code) && (
                                  <div className="text-xs text-slate-500">
                                    {item.code || item.type_code}
                                  </div>
                                )}
                              </div>
                            )}
                            {activeTab === "shifts" && (
                              <div>
                                <div className="font-medium">
                                  {item.name ||
                                    item.shift_name ||
                                    "Unnamed Shift"}{" "}
                                  <span className="font-mono text-xs text-slate-500">
                                    ({item.code || item.shift_code || "—"})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.start_time || "08:00"} –{" "}
                                  {item.end_time || "17:00"} &nbsp;|&nbsp;
                                  Break: {item.break_minutes ?? 60}min
                                  &nbsp;|&nbsp;{" "}
                                  {item.is_active !== false &&
                                  item.is_active !== 0 ? (
                                    <span className="text-emerald-600 font-medium">
                                      Active
                                    </span>
                                  ) : (
                                    <span className="text-red-500">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEdit(item)}
                                className="text-brand text-sm hover:underline"
                              >
                                Edit
                              </button>
                              {activeTab === "tax-relief-types" && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to deactivate ${item.name}?`)) {
                                      try {
                                        await api.delete(`/hr/tax-relief-types/${item.id}`);
                                        toast.success("Tax relief category deactivated");
                                        loadData();
                                      } catch {
                                        toast.error("Failed to deactivate category");
                                      }
                                    }
                                  }}
                                  className="text-red-500 text-sm hover:underline ml-2"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && !loading && (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            No records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {activeTab === "parameters" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded border border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-300">
                <h4 className="font-semibold mb-2">About Parameters</h4>
                <p className="text-sm">
                  These settings control module-wide calculations. For example,
                  "Regular Working Hours" defines the threshold above which
                  hours are considered Overtime (OT) in the Timesheet module.
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </Guard>
  );
}
