/**
 * @file BOQManager.jsx
 * @description Enterprise Bill of Quantities (BOQ) module for ERP Project Management.
 * Features:
 * - Project details: Project name, code, client, site location, and BOQ reference.
 * - Line item codes, detailed description, standard construction UoMs, quantities, rates, and amounts.
 * - Cost categorization: Materials, Labour, Equipment, Subcontracting, Transportation, Other.
 * - Tax and additional charges.
 * - Contingency calculation, subtotal, tax, and final estimated cost.
 * - Approval workflow and revision history: Prepared by, Reviewed by, Approved by, Version, and Date.
 * - Rate build-up analysis, CSV import/export, and printable official BOQ document.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FileSpreadsheet,
  Plus,
  Calculator,
  Download,
  Upload,
  Layers,
  Save,
  Trash2,
  Edit2,
  Eye,
  CheckCircle,
  Clock,
  ArrowLeft,
  X,
  RefreshCw,
  Printer,
  History,
  ShieldCheck,
  AlertCircle,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  Package,
  HardHat,
  Send,
  FileCheck2, RotateCcw, AlertTriangle
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";
import { useTaxCodesByPageId, PAGE_IDS } from "../../../../hooks/useTaxCodesByPageId.js";
import * as XLSX from "xlsx";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import { fetchReportHeader, renderHtmlToPdf } from "../../../../utils/pdfUtils.js";
import PrintPreviewModal from "../../../../components/PrintPreviewModal.jsx";


const UOM_OPTIONS = [
  { value: "EA", label: "Each (EA)" },
  { value: "M", label: "Metre (M)" },
  { value: "M2", label: "Square Metre (M2)" },
  { value: "M3", label: "Cubic Metre (M3)" },
  { value: "KG", label: "Kilogram (KG)" },
  { value: "TON", label: "Tonne (TON)" },
  { value: "DAY", label: "Day (DAY)" },
  { value: "HR", label: "Hour (HR)" },
  { value: "LOT", label: "Lot / Lump Sum (LOT)" },
  { value: "LTR", label: "Litre (LTR)" },
  { value: "BAG", label: "Bag (BAG)" },
  { value: "SET", label: "Set (SET)" },
];

const COST_CATEGORIES = [
  { value: "MATERIALS", label: "Materials", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  { value: "LABOUR", label: "Labour", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  { value: "EQUIPMENT", label: "Equipment / Plant", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" },
  { value: "SUBCONTRACTING", label: "Subcontracting", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
  { value: "TRANSPORTATION", label: "Transportation", color: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800" },
  { value: "OTHER", label: "Other Expenses", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
];

const STATUS_BADGES = {
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300" },
  PENDING_APPROVAL: { label: "Pending Approval", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse" },
  UNDER_REVIEW: { label: "Under Review", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" },
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" },
  REVISED: { label: "Revised", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" },
  REVERSED: { label: "Reversed", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300" },
  RETURNED: { label: "Returned", cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300" },
  REJECTED: { label: "Rejected", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300" },
};

export default function BOQManager() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [boqs, setBOQs] = useState([]);
  const [activeBOQ, setActiveBOQ] = useState(null);
  const [boqItems, setBOQItems] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Financial summary inputs
  const [contingencyPercent, setContingencyPercent] = useState(5);
  const [taxPercent, setTaxPercent] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [currency, setCurrency] = useState("GHS");

  // Tax Codes linked to BOQ page (Page ID 29)
  const { taxCodes: boqTaxCodes = [] } = useTaxCodesByPageId(PAGE_IDS.BOQ || 29);
  const [selectedTaxCodeId, setSelectedTaxCodeId] = useState("");
  const [selectedTaxCode, setSelectedTaxCode] = useState(null);

  // Print Preview & Document Template states
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [reportHeader, setReportHeader] = useState(null);

  // Approval inputs
  const [preparedByName, setPreparedByName] = useState("");
  const [preparedDate, setPreparedDate] = useState("");
  const [reviewedByName, setReviewedByName] = useState("");
  const [reviewedDate, setReviewedDate] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [approvedDate, setApprovedDate] = useState("");
  const [version, setVersion] = useState("1.0");
  const [remarks, setRemarks] = useState("");

  // Sales-order style workflow states
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [submittingForward, setSubmittingForward] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [wfLoading, setWfLoading] = useState(false);

  // Approve / Reject modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState("APPROVED");
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [newVersionRemarks, setNewVersionRemarks] = useState("");
  const [activeItemForRate, setActiveItemForRate] = useState(null);

  // Rate form
  const [rateForm, setRateForm] = useState({
    material_cost: 0,
    labour_cost: 0,
    plant_cost: 0,
    subcontract_cost: 0,
    overhead_percent: 10,
    profit_percent: 15,
  });

  // New BOQ form
  const [newBOQ, setNewBOQ] = useState({
    boq_title: "",
    boq_reference: "",
    client_name: "",
    site_location: "",
    boq_date: new Date().toISOString().split("T")[0],
    currency: "GHS",
    version: "1.0",
    contingency_percent: 5,
    tax_percent: 0,
    tax_code_id: null,
    tax_code: null,
    other_charges: 0,
    prepared_by_name: "",
    remarks: "",
  });

  const fileInputRef = useRef(null);

  // Load Document Template Report Header on mount
  useEffect(() => {
    (async () => {
      try {
        const rh = await fetchReportHeader(api);
        setReportHeader(rh);
      } catch (e) {}
    })();
  }, []);

  // Load Projects on mount (Do not auto-select any project by default)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  // Update selectedProject when ID changes
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      setBOQs([]);
      setActiveBOQ(null);
      setBOQItems([]);
      return;
    }
    const found = projects.find(p => String(p.id) === String(selectedProjectId));
    setSelectedProject(found || null);
    fetchBOQs();
  }, [selectedProjectId]);

  const fetchBOQs = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await api.get("/construction/boqs", { params: { project_id: selectedProjectId } });
      const items = res.data?.items || [];
      setBOQs(items);
      if (items.length > 0) {
        loadBOQDetails(items[0].id);
      } else {
        setActiveBOQ(null);
        setBOQItems([]);
        setRevisions([]);
      }
    } catch (e) {
      toast.error("Failed to load project BOQs");
    } finally {
      setLoading(false);
    }
  };

  const loadBOQDetails = async (boqId) => {
    setLoading(true);
    try {
      const res = await api.get(`/construction/boqs/${boqId}`);
      const b = res.data?.item || null;
      const itms = res.data?.items || [];
      const revs = res.data?.revisions || [];

      setActiveBOQ(b);
      setBOQItems(itms);
      setRevisions(revs);

      if (b) {
        setContingencyPercent(Number(b.contingency_percent || 0));
        setTaxPercent(Number(b.tax_percent || 0));
        if (b.tax_code_id) {
          setSelectedTaxCodeId(String(b.tax_code_id));
          if (b.tax_code) {
            setSelectedTaxCode({ id: b.tax_code_id, code: b.tax_code, name: b.tax_code });
          }
        } else {
          setSelectedTaxCodeId("");
          setSelectedTaxCode(null);
        }
        setOtherCharges(Number(b.other_charges || 0));
        setCurrency(b.currency || "GHS");
        setVersion(b.version || "1.0");
        setPreparedByName(b.prepared_by_name || "");
        setPreparedDate(b.prepared_date ? String(b.prepared_date).split("T")[0] : "");
        setReviewedByName(b.reviewed_by_name || "");
        setReviewedDate(b.reviewed_date ? String(b.reviewed_date).split("T")[0] : "");
        setApprovedByName(b.approved_by_name || "");
        setApprovedDate(b.approved_date ? String(b.approved_date).split("T")[0] : "");
        setRemarks(b.remarks || "");
      }
    } catch (e) {
      toast.error("Failed to load BOQ details");
    } finally {
      setLoading(false);
    }
  };

  // Add Item Row
  const addItemRow = () => {
    const nextNum = boqItems.length + 1;
    const projectCodePrefix = selectedProject?.project_code || "PRJ";
    const newItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      item_code: `${projectCodePrefix}-${String(nextNum).padStart(3, "0")}`,
      item_description: "",
      cost_category: "MATERIALS",
      uom: "M3",
      quantity: 1,
      unit_rate: 0,
      amount: 0,
      tax_rate_percent: 0,
      tax_amount: 0,
      remarks: "",
      item_order: nextNum,
    };
    setBOQItems([...boqItems, newItem]);
  };

  // Update item field
  const updateItem = (index, field, value) => {
    const updated = [...boqItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "quantity" || field === "unit_rate" || field === "tax_rate_percent") {
      const q = Number(updated[index].quantity || 0);
      const r = Number(updated[index].unit_rate || 0);
      const amt = Number((q * r).toFixed(2));
      updated[index].amount = amt;
      const taxRate = Number(updated[index].tax_rate_percent || 0);
      updated[index].tax_amount = Number(((amt * taxRate) / 100).toFixed(2));
    }

    setBOQItems(updated);
  };

  const removeItemRow = (index) => {
    const updated = boqItems.filter((_, i) => i !== index);
    setBOQItems(updated);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return boqItems.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [boqItems]);

  const contingencyAmount = useMemo(() => {
    return Number(((subtotal * Number(contingencyPercent || 0)) / 100).toFixed(2));
  }, [subtotal, contingencyPercent]);

  const taxAmount = useMemo(() => {
    const taxableBase = subtotal + contingencyAmount;
    return Number(((taxableBase * Number(taxPercent || 0)) / 100).toFixed(2));
  }, [subtotal, contingencyAmount, taxPercent]);

  const finalEstimatedCost = useMemo(() => {
    return Number((subtotal + contingencyAmount + taxAmount + Number(otherCharges || 0)).toFixed(2));
  }, [subtotal, contingencyAmount, taxAmount, otherCharges]);

  // Category breakdown calculations
  const categoryTotals = useMemo(() => {
    const totals = {
      MATERIALS: 0,
      LABOUR: 0,
      EQUIPMENT: 0,
      SUBCONTRACTING: 0,
      TRANSPORTATION: 0,
      OTHER: 0,
    };
    boqItems.forEach(i => {
      const cat = i.cost_category || "MATERIALS";
      if (totals[cat] !== undefined) {
        totals[cat] += Number(i.amount || 0);
      } else {
        totals.OTHER += Number(i.amount || 0);
      }
    });
    return totals;
  }, [boqItems]);

  // Sync selectedTaxCode when boqTaxCodes loads or selectedTaxCodeId changes
  useEffect(() => {
    if (selectedTaxCodeId && boqTaxCodes.length > 0 && selectedTaxCodeId !== "CUSTOM") {
      const match = boqTaxCodes.find(tc => String(tc.id) === String(selectedTaxCodeId));
      if (match) {
        setSelectedTaxCode(match);
      }
    }
  }, [boqTaxCodes, selectedTaxCodeId]);

  // Handle Tax Code selection from linked Tax Codes
  const handleTaxCodeSelect = (taxCodeId) => {
    setSelectedTaxCodeId(taxCodeId);
    if (!taxCodeId || taxCodeId === "") {
      setSelectedTaxCode(null);
      setTaxPercent(0);
      return;
    }
    if (taxCodeId === "CUSTOM") {
      setSelectedTaxCode({ code: "CUSTOM", name: "Custom Rate" });
      return;
    }
    const found = boqTaxCodes.find(tc => String(tc.id) === String(taxCodeId));
    if (found) {
      setSelectedTaxCode(found);
      setTaxPercent(Number(found.rate_percent || 0));
    }
  };

  // Save BOQ Items and Totals
  const handleSaveBOQ = async (recordRevision = false, revRemarks = "") => {
    if (!activeBOQ) return;
    setSaving(true);
    try {
      await api.post(`/construction/boqs/${activeBOQ.id}/items`, {
        items: boqItems,
        contingency_percent: contingencyPercent,
        contingency_amount: contingencyAmount,
        tax_code_id: selectedTaxCodeId && selectedTaxCodeId !== "CUSTOM" ? Number(selectedTaxCodeId) : null,
        tax_code: selectedTaxCode?.code || null,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        other_charges: otherCharges,
        subtotal,
        total_amount: finalEstimatedCost,
        version,
        prepared_by_name: preparedByName,
        reviewed_by_name: reviewedByName,
        approved_by_name: approvedByName,
        remarks,
        record_revision: recordRevision,
        revision_remarks: revRemarks,
      });
      toast.success("BOQ items and calculated totals saved successfully");
      loadBOQDetails(activeBOQ.id);
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save BOQ");
    } finally {
      setSaving(false);
    }
  };

  // Create BOQ
  const handleCreateBOQ = async (e) => {
    e.preventDefault();
    if (!newBOQ.boq_title) return toast.error("BOQ Title is required");
    try {
      const res = await api.post("/construction/boqs", {
        ...newBOQ,
        project_id: selectedProjectId,
        tax_code_id: newBOQ.tax_code_id || (selectedTaxCodeId && selectedTaxCodeId !== "CUSTOM" ? Number(selectedTaxCodeId) : null),
        tax_code: newBOQ.tax_code || selectedTaxCode?.code || null,
      });
      toast.success("BOQ created successfully");
      setShowCreateModal(false);
      setNewBOQ({
        boq_title: "",
        boq_reference: "",
        client_name: "",
        site_location: "",
        boq_date: new Date().toISOString().split("T")[0],
        currency: "GHS",
        version: "1.0",
        contingency_percent: 5,
        tax_percent: 0,
        other_charges: 0,
        prepared_by_name: "",
        remarks: "",
      });
      fetchBOQs();
      if (res.data?.id) {
        loadBOQDetails(res.data.id);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to create BOQ");
    }
  };

  // Open Create Modal and prepopulate project details
  const openCreateModal = () => {
    if (!selectedProjectId) {
      toast.info("Please select a project first");
      return;
    }
    const projCode = selectedProject?.project_code || "PRJ";
    const client = selectedProject?.client_name || "";
    const site = [selectedProject?.site_address, selectedProject?.site_city].filter(Boolean).join(", ");
    setNewBOQ({
      boq_title: selectedProject ? `${selectedProject.project_name} - Main BOQ` : "",
      boq_reference: `BOQ-${projCode}-${new Date().getFullYear()}-01`,
      client_name: client,
      site_location: site,
      boq_date: new Date().toISOString().split("T")[0],
      currency: "GHS",
      version: "1.0",
      contingency_percent: 5,
      tax_percent: 0,
      other_charges: 0,
      prepared_by_name: preparedByName || "Senior Quantity Surveyor",
      remarks: "Standard specification and bills of quantities.",
    });
    setShowCreateModal(true);
  };

  // Workflow Handlers (Sales-order style)
  const openForwardModal = async () => {
    if (!activeBOQ) return;
    setShowForwardModal(true);
    setForwardComments("");
    setWfLoading(true);
    try {
      // 1. Fetch available users for approver dropdown
      let uList = [];
      try {
        const uRes = await api.get("/workflows/users");
        uList = uRes?.data?.users || uRes?.data?.items || [];
      } catch {
        const uRes2 = await api.get("/admin/users", { params: { active: 1 } }).catch(() => null);
        uList = uRes2?.data?.items || [];
      }
      setAvailableUsers(uList);

      // 2. Fetch workflows
      const res = await api.get("/workflows");
      const list = Array.isArray(res.data?.items) ? res.data.items : [];
      const route = "/project-management/boq";
      const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
      
      const chosen = list.find(w => Number(w.is_active) === 1 && (String(w.document_route) === route || normalize(w.document_type) === "PROJECT_BOQ" || normalize(w.document_type) === "BOQ"))
        || list.find(w => Number(w.is_active) === 1 && normalize(w.document_type).includes("PROJECT"))
        || null;

      setCandidateWorkflow(chosen || null);

      if (chosen) {
        const wfDetail = await api.get(`/workflows/${chosen.id}`);
        const steps = wfDetail.data?.item?.steps || [];
        setWorkflowSteps(steps);
        const first = steps[0] || null;
        setFirstApprover(first);
        if (first?.approver_user_id) {
          setTargetApproverId(String(first.approver_user_id));
        } else if (first?.approvers?.length) {
          setTargetApproverId(String(first.approvers[0].id || first.approvers[0].user_id));
        }
      } else if (uList.length > 0) {
        setTargetApproverId(String(uList[0].id));
      }
    } catch (e) {
      console.error("Workflow load error:", e);
    } finally {
      setWfLoading(false);
    }
  };

  const handleForwardSubmit = async () => {
    if (!activeBOQ) return;
    setSubmittingForward(true);
    try {
      await api.post(`/construction/boqs/${activeBOQ.id}/submit`, {
        workflow_id: candidateWorkflow?.id || null,
        target_user_id: targetApproverId ? Number(targetApproverId) : null,
        comments: forwardComments,
      });
      toast.success("BOQ forwarded for approval successfully");
      setShowForwardModal(false);
      loadBOQDetails(activeBOQ.id);
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to forward BOQ for approval");
    } finally {
      setSubmittingForward(false);
    }
  };

  const handleApproveSubmit = async () => {
    if (!activeBOQ) return;
    try {
      await api.post(`/construction/boqs/${activeBOQ.id}/approve`, {
        comments: approveComments,
      });
      toast.success("BOQ approved successfully");
      setShowApproveModal(false);
      setApproveComments("");
      loadBOQDetails(activeBOQ.id);
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to approve BOQ");
    }
  };

  const handleRejectSubmit = async () => {
    if (!activeBOQ) return;
    if (!rejectionReason.trim()) {
      return toast.error("Please provide a rejection reason");
    }
    try {
      await api.post(`/construction/boqs/${activeBOQ.id}/reject`, {
        rejection_reason: rejectionReason,
      });
      toast.success("BOQ rejected");
      setShowRejectModal(false);
      setRejectionReason("");
      loadBOQDetails(activeBOQ.id);
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to reject BOQ");
    }
  };

  const handleReverseSubmit = async () => {
    if (!activeBOQ) return;
    if (!window.confirm("Are you sure you want to reverse approval? This will return the BOQ to DRAFT status so it can be edited.")) return;
    try {
      await api.post(`/construction/boqs/${activeBOQ.id}/reverse`, {
        reason: "Approval reversed by authorized user",
      });
      toast.success("Approval reversed. BOQ is now back in DRAFT.");
      loadBOQDetails(activeBOQ.id);
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to reverse approval");
    }
  };

  // Transition Status (Approval Workflow)
  const handleStatusTransition = async () => {
    if (!activeBOQ) return;
    try {
      await api.post(`/construction/boqs/${activeBOQ.id}/status`, {
        status: targetStatus,
        approved_by_name: approvedByName || "Project Director",
        approved_date: new Date().toISOString().split("T")[0],
        approval_remarks: approvalRemarks,
      });
      toast.success(`BOQ transitioned to ${targetStatus}`);
      setShowStatusModal(false);
      setApprovalRemarks("");
      loadBOQDetails(activeBOQ.id);
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    }
  };

  // Create New Revision
  const handleCreateRevision = async () => {
    if (!activeBOQ) return;
    try {
      const res = await api.post(`/construction/boqs/${activeBOQ.id}/revision`, {
        new_version: newVersionLabel || undefined,
        revision_remarks: newVersionRemarks,
      });
      toast.success(res.data?.message || "New revision created");
      setShowRevisionModal(false);
      setNewVersionLabel("");
      setNewVersionRemarks("");
      loadBOQDetails(activeBOQ.id);
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to create revision");
    }
  };

  // Delete BOQ
  const handleDeleteBOQ = async () => {
    if (!activeBOQ) return;
    if (!window.confirm(`Are you sure you want to delete "${activeBOQ.boq_title || activeBOQ.title}"? This will delete all line items and revisions.`)) return;
    try {
      await api.delete(`/construction/boqs/${activeBOQ.id}`);
      toast.success("BOQ deleted successfully");
      fetchBOQs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete BOQ");
    }
  };

  // Rate Analysis Modal handlers
  const openRateAnalysis = async (item) => {
    setActiveItemForRate(item);
    setShowRateModal(true);
    try {
      if (item.id && !String(item.id).startsWith("temp-")) {
        const res = await api.get(`/construction/boq-items/${item.id}/rate-analysis`);
        if (res.data?.item) {
          const r = res.data.item;
          setRateForm({
            material_cost: Number(r.material_cost || 0),
            labour_cost: Number(r.labour_cost || 0),
            plant_cost: Number(r.plant_cost || 0),
            subcontract_cost: Number(r.subcontract_cost || 0),
            overhead_percent: Number(r.overhead_percent || 10),
            profit_percent: Number(r.profit_percent || 15),
          });
          return;
        }
      }
    } catch (e) {}

    const rate = Number(item.unit_rate || 0);
    setRateForm({
      material_cost: Number((rate * 0.5).toFixed(2)),
      labour_cost: Number((rate * 0.25).toFixed(2)),
      plant_cost: Number((rate * 0.1).toFixed(2)),
      subcontract_cost: 0,
      overhead_percent: 10,
      profit_percent: 15,
    });
  };

  const calculatedDirectCost = Number(rateForm.material_cost || 0) + Number(rateForm.labour_cost || 0) + Number(rateForm.plant_cost || 0) + Number(rateForm.subcontract_cost || 0);
  const calculatedOverhead = (calculatedDirectCost * Number(rateForm.overhead_percent || 0)) / 100;
  const calculatedProfit = ((calculatedDirectCost + calculatedOverhead) * Number(rateForm.profit_percent || 0)) / 100;
  const calculatedUnitRate = Number((calculatedDirectCost + calculatedOverhead + calculatedProfit).toFixed(2));

  const applyRateAnalysis = async () => {
    if (!activeItemForRate) return;
    const idx = boqItems.findIndex(i => i.id === activeItemForRate.id);
    if (idx !== -1) {
      updateItem(idx, "unit_rate", calculatedUnitRate);
    }
    if (activeItemForRate.id && !String(activeItemForRate.id).startsWith("temp-")) {
      try {
        await api.post(`/construction/boq-items/${activeItemForRate.id}/rate-analysis`, {
          ...rateForm,
          update_boq_item_rate: true,
        });
      } catch (e) {}
    }
    toast.success(`Unit rate updated to ${currency} ${calculatedUnitRate}`);
    setShowRateModal(false);
  };

  // Excel Export with Document Template Header
  const exportExcel = async () => {
    if (!boqItems.length) return toast.info("No items to export");
    try {
      const headerInfo = reportHeader || await fetchReportHeader(api).catch(() => ({}));
      const companyName = headerInfo.companyName || "Company";
      const companyAddress = headerInfo.companyAddress || "";
      const companyContact = [headerInfo.companyPhone, headerInfo.companyEmail].filter(Boolean).join("  |  ");
      const companyWebsite = headerInfo.companyWebsite || "";

      const aoaData = [
        [companyName],
      ];
      if (companyAddress) aoaData.push([companyAddress]);
      if (companyContact) aoaData.push([companyContact]);
      if (companyWebsite) aoaData.push([companyWebsite]);
      aoaData.push([]);
      aoaData.push(["BILL OF QUANTITIES (BOQ)"]);
      aoaData.push([
        `BOQ Reference: ${activeBOQ?.boq_reference || "N/A"}`,
        "",
        `Version: ${version || activeBOQ?.version || "1.0"}`,
        "",
        `Date: ${activeBOQ?.boq_date || new Date().toISOString().split("T")[0]}`,
        "",
        `Currency: ${currency}`,
        "",
        `Status: ${activeBOQ?.status || "DRAFT"}`
      ]);
      aoaData.push([
        `Project: ${selectedProject?.project_name || "—"} (${selectedProject?.project_code || "—"})`,
        "",
        `Client / Employer: ${activeBOQ?.client_name || selectedProject?.client_name || "—"}`,
        "",
        `Site Location: ${activeBOQ?.site_location || selectedProject?.site_address || "—"}`
      ]);
      aoaData.push([]);

      // Table Header
      aoaData.push([
        "Item Code",
        "Description of Work",
        "Cost Category",
        "Unit of Measurement",
        "Quantity",
        "Unit Rate",
        "Amount",
        "Tax Rate %",
        "Tax Amount",
        "Remarks"
      ]);

      // Table Rows
      boqItems.forEach(i => {
        aoaData.push([
          i.item_code || "",
          i.item_description || i.description || "",
          i.cost_category || "MATERIALS",
          i.uom || i.unit || "EA",
          Number(i.quantity || 0),
          Number(i.unit_rate || 0),
          Number(i.amount || 0),
          Number(i.tax_rate_percent || 0),
          Number(i.tax_amount || 0),
          i.remarks || "",
        ]);
      });

      // Financial Summary Rows
      aoaData.push([]);
      aoaData.push(["", "", "", "", "", "Subtotal (Cost of Works):", subtotal, "", "", ""]);
      aoaData.push(["", "", "", "", "", `Contingency (${contingencyPercent}%):`, contingencyAmount, "", "", ""]);
      aoaData.push(["", "", "", "", "", `Tax & Levies (${selectedTaxCode?.code ? selectedTaxCode.code + ' ' : ''}${taxPercent}%):`, taxAmount, "", "", ""]);
      if (Number(otherCharges || 0) > 0) {
        aoaData.push(["", "", "", "", "", "Preliminaries & Other Charges:", Number(otherCharges || 0), "", "", ""]);
      }
      aoaData.push(["", "", "", "", "", `Final Estimated Cost (${currency}):`, finalEstimatedCost, "", "", ""]);

      // Sign-off Block
      aoaData.push([]);
      aoaData.push([
        `Prepared By: ${preparedByName || activeBOQ?.prepared_by_name || "—"}`,
        "",
        `Reviewed By: ${reviewedByName || activeBOQ?.reviewed_by_name || "—"}`,
        "",
        `Approved By: ${approvedByName || activeBOQ?.approved_by_name || "—"}`
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      autosizeWorksheetColumns(ws);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BOQ Schedule");
      const filename = `${activeBOQ?.boq_reference || "BOQ_Schedule"}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success("BOQ exported to Excel (.xlsx) successfully");
    } catch (err) {
      console.error("Export Excel error:", err);
      toast.error("Failed to export Excel file");
    }
  };

  // Excel Import (supports .xlsx, .xls, .csv)
  const handleExcelImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];
        if (!ws) return toast.error("Excel sheet is empty");

        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (!rawRows || rawRows.length === 0) return toast.error("Excel file has no data");

        // Identify the header row index
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
          const rowText = (rawRows[r] || []).map(c => String(c || "").toLowerCase()).join(" ");
          if (rowText.includes("item code") || (rowText.includes("description") && (rowText.includes("rate") || rowText.includes("unit")))) {
            headerRowIdx = r;
            break;
          }
        }

        const dataRows = headerRowIdx !== -1 ? rawRows.slice(headerRowIdx + 1) : rawRows.slice(1);
        const headers = headerRowIdx !== -1 ? rawRows[headerRowIdx].map(h => String(h || "").trim().toLowerCase()) : [];

        // Dynamic column mapping
        const colMap = {
          code: headers.findIndex(h => h.includes("item code") || h === "code"),
          desc: headers.findIndex(h => h.includes("desc")),
          category: headers.findIndex(h => h.includes("categor")),
          uom: headers.findIndex(h => h.includes("unit of") || h.includes("uom") || h === "unit"),
          qty: headers.findIndex(h => h.includes("quant") || h === "qty"),
          rate: headers.findIndex(h => h.includes("rate") || h.includes("price") || h.includes("cost")),
          amount: headers.findIndex(h => h.includes("amount") || h.includes("total")),
          taxRate: headers.findIndex(h => h.includes("tax rate") || h.includes("tax %")),
          taxAmount: headers.findIndex(h => h.includes("tax amount")),
          remarks: headers.findIndex(h => h.includes("remark") || h.includes("spec")),
        };

        const parsedItems = [];
        dataRows.forEach((row, idx) => {
          if (!row || !row.length) return;
          const rowStr = row.map(c => String(c || "").toLowerCase()).join(" ");
          // Skip summary lines
          if (rowStr.includes("subtotal") || rowStr.includes("contingency") || rowStr.includes("final estimated") || rowStr.includes("grand total") || rowStr.includes("prepared by")) {
            return;
          }

          const getVal = (colIdx, fallbackIdx) => {
            const i = colIdx !== -1 ? colIdx : fallbackIdx;
            return row[i] != null ? String(row[i]).trim() : "";
          };

          const code = getVal(colMap.code, 0);
          const desc = getVal(colMap.desc, 1);
          if (!code && !desc) return; // skip blank line

          const rawCat = getVal(colMap.category, 2).toUpperCase();
          const category = ["MATERIALS", "LABOUR", "EQUIPMENT", "SUBCONTRACTING", "TRANSPORTATION", "OTHER"].includes(rawCat) ? rawCat : "MATERIALS";
          const rawUom = getVal(colMap.uom, 3).toUpperCase();
          const uom = rawUom || "EA";
          const qty = Number(getVal(colMap.qty, 4)) || 1;
          const rate = Number(getVal(colMap.rate, 5)) || 0;
          const amt = Number(getVal(colMap.amount, 6)) || Number((qty * rate).toFixed(2));
          const taxPct = Number(getVal(colMap.taxRate, 7)) || 0;
          const taxAmt = Number(getVal(colMap.taxAmount, 8)) || Number(((amt * taxPct) / 100).toFixed(2));
          const itemRemarks = getVal(colMap.remarks, 9);

          parsedItems.push({
            id: `imported-${Date.now()}-${idx}`,
            item_code: code || `ITM-${boqItems.length + parsedItems.length + 1}`,
            item_description: desc || `Work Item #${boqItems.length + parsedItems.length + 1}`,
            cost_category: category,
            uom,
            quantity: qty,
            unit_rate: rate,
            amount: amt,
            tax_rate_percent: taxPct,
            tax_amount: taxAmt,
            remarks: itemRemarks || "",
            item_order: boqItems.length + parsedItems.length + 1,
          });
        });

        if (parsedItems.length > 0) {
          setBOQItems([...boqItems, ...parsedItems]);
          toast.success(`Imported ${parsedItems.length} BOQ items successfully from Excel`);
        } else {
          toast.warn("No valid BOQ items found in the Excel file");
        }
      } catch (err) {
        console.error("Excel import error:", err);
        toast.error("Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv document.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // Generate HTML for Print Feature using the Document Template & Report Header
  const handlePrint = async () => {
    try {
      const headerInfo = reportHeader || await fetchReportHeader(api).catch(() => ({}));
      const companyName = headerInfo.companyName || "Company";
      const companyAddress = headerInfo.companyAddress || "";
      const companyPhone = headerInfo.companyPhone || "";
      const companyEmail = headerInfo.companyEmail || "";
      const companyWebsite = headerInfo.companyWebsite || "";
      const logoUrl = headerInfo.logoUrl || "";
      const curr = currency || headerInfo.currCode || "GHS";

      const formattedDate = activeBOQ?.boq_date
        ? new Date(activeBOQ.boq_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
        : new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Bill of Quantities - ${activeBOQ?.boq_reference || "BOQ"}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .boq-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 4px;
    }
    /* Report Header Template from Document Templates */
    .report-header-tpl {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2.5px solid #0f172a;
      margin-bottom: 12px;
    }
    .header-logo-box {
      max-width: 200px;
    }
    .header-logo-img {
      max-height: 52px;
      max-width: 190px;
      object-fit: contain;
    }
    .header-company-box {
      text-align: right;
    }
    .header-company-name {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 2px;
    }
    .header-company-text {
      font-size: 10px;
      color: #475569;
      line-height: 1.4;
      margin: 0;
    }
    /* Document Title Banner */
    .doc-banner {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .doc-banner-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin: 0;
    }
    .doc-banner-meta {
      font-size: 9.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.2);
      letter-spacing: 0.05em;
    }
    /* Project Details Grid */
    .project-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }
    .project-row {
      display: flex;
      font-size: 10.5px;
    }
    .project-label {
      width: 110px;
      font-weight: 700;
      color: #64748b;
      flex-shrink: 0;
    }
    .project-val {
      color: #0f172a;
      font-weight: 600;
    }
    /* KPI Summary Cards */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }
    .kpi-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 8px;
      border-top: 3px solid #64748b;
    }
    .kpi-box.accent {
      border-top-color: #0284c7;
      background: #f0f9ff;
    }
    .kpi-lbl {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .kpi-amt {
      font-size: 11px;
      font-weight: 800;
      font-family: ui-monospace, monospace;
      color: #0f172a;
    }
    /* BOQ Items Schedule Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9.5px;
    }
    .items-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 6px 7px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    .items-table td {
      padding: 5px 7px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .num { text-align: right; font-family: ui-monospace, monospace; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    /* Summary Grid */
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .summary-pane {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .pane-title {
      background: #f1f5f9;
      padding: 5px 10px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #334155;
      border-bottom: 1px solid #cbd5e1;
    }
    .pane-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .pane-table td {
      padding: 4px 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .pane-table tr:last-child td {
      border-bottom: none;
    }
    .pane-table .grand-row td {
      background: #f8fafc;
      border-top: 2px solid #0f172a !important;
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
    }
    /* Approval Signatures */
    .signatures-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 20px;
      padding-top: 8px;
      page-break-inside: avoid;
    }
    .signature-card {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .sig-heading {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .sig-person {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      min-height: 16px;
    }
    .sig-sub {
      font-size: 9px;
      color: #64748b;
      margin-bottom: 24px;
    }
    .sig-underline {
      border-top: 1px solid #64748b;
      text-align: center;
      font-size: 8px;
      color: #94a3b8;
      padding-top: 2px;
    }
    .print-footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="boq-container">
    <!-- 1. Report Header Template from Document Templates -->
    <div class="report-header-tpl">
      <div class="header-logo-box">
        ${logoUrl ? `<img class="header-logo-img" src="${logoUrl}" alt="${companyName}" />` : `<div style="font-size: 18px; font-weight: 900; color: #0f172a;">${companyName}</div>`}
      </div>
      <div class="header-company-box">
        <div class="header-company-name">${companyName}</div>
        ${companyAddress ? `<p class="header-company-text">${companyAddress}</p>` : ""}
        ${companyPhone ? `<p class="header-company-text">Contact No: ${companyPhone}</p>` : ""}
        ${companyEmail ? `<p class="header-company-text">Email: ${companyEmail}</p>` : ""}
        ${companyWebsite ? `<p class="header-company-text">Web: ${companyWebsite}</p>` : ""}
      </div>
    </div>

    <!-- 2. Document Title Banner -->
    <div class="doc-banner">
      <div class="doc-banner-title">Bill of Quantities (BOQ)</div>
      <div class="doc-banner-meta">
        <span>Ref: <strong style="font-family: monospace;">${activeBOQ?.boq_reference || "—"}</strong></span>
        <span>Version: ${version || activeBOQ?.version || "1.0"}</span>
        <span class="status-badge">${activeBOQ?.status || "DRAFT"}</span>
      </div>
    </div>

    <!-- 3. Project & BOQ Information Grid -->
    <div class="project-grid">
      <div class="project-row">
        <span class="project-label">Project Name:</span>
        <span class="project-val">${selectedProject?.project_name || "—"} (${selectedProject?.project_code || "—"})</span>
      </div>
      <div class="project-row">
        <span class="project-label">Date of Issue:</span>
        <span class="project-val">${formattedDate}</span>
      </div>
      <div class="project-row">
        <span class="project-label">Client / Employer:</span>
        <span class="project-val">${activeBOQ?.client_name || selectedProject?.client_name || "—"}</span>
      </div>
      <div class="project-row">
        <span class="project-label">Site Location:</span>
        <span class="project-val">${activeBOQ?.site_location || selectedProject?.site_address || "—"}</span>
      </div>
      <div class="project-row">
        <span class="project-label">Contract Currency:</span>
        <span class="project-val">${curr}</span>
      </div>
      <div class="project-row">
        <span class="project-label">BOQ Title:</span>
        <span class="project-val">${activeBOQ?.boq_title || "Standard BOQ Schedule"}</span>
      </div>
    </div>

    <!-- 4. Financial KPI Cards -->
    <div class="kpi-row">
      <div class="kpi-box">
        <div class="kpi-lbl">Cost of Works</div>
        <div class="kpi-amt">${curr} ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Contingency (${contingencyPercent}%)</div>
        <div class="kpi-amt">${curr} ${contingencyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Tax (${selectedTaxCode?.code ? selectedTaxCode.code + ' ' : ''}${taxPercent}%)</div>
        <div class="kpi-amt">${curr} ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Preliminaries / Other</div>
        <div class="kpi-amt">${curr} ${Number(otherCharges || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-box accent">
        <div class="kpi-lbl">Final Estimated Cost</div>
        <div class="kpi-amt">${curr} ${finalEstimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    </div>

    <!-- 5. Full Schedule of Rates Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th style="width: 75px;">Item Code</th>
          <th>Description of Work</th>
          <th style="width: 75px;">Category</th>
          <th style="width: 45px;" class="center">Unit</th>
          <th style="width: 55px;" class="num">Quantity</th>
          <th style="width: 70px;" class="num">Rate (${curr})</th>
          <th style="width: 80px;" class="num">Amount (${curr})</th>
          <th style="width: 70px;">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${boqItems.map((item, idx) => `
          <tr>
            <td class="center">${idx + 1}</td>
            <td class="bold font-mono">${item.item_code || "—"}</td>
            <td>${item.item_description || item.description || "—"}</td>
            <td><span style="font-size: 8.5px; color: #475569;">${item.cost_category || "MATERIALS"}</span></td>
            <td class="center font-mono">${item.uom || item.unit || "EA"}</td>
            <td class="num font-mono">${Number(item.quantity || 0).toLocaleString()}</td>
            <td class="num font-mono">${Number(item.unit_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="num font-mono bold">${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="font-size: 8.5px; color: #64748b;">${item.remarks || "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <!-- 6. Summary Section -->
    <div class="summary-grid">
      <!-- Category Breakdown -->
      <div class="summary-pane">
        <div class="pane-title">Cost Category Distribution</div>
        <table class="pane-table">
          <tbody>
            ${Object.entries(categoryTotals).map(([cat, amt]) => {
              const pct = subtotal > 0 ? ((amt / subtotal) * 100).toFixed(1) : "0.0";
              return `
                <tr>
                  <td class="bold">${cat}</td>
                  <td class="num">${curr} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="num" style="width: 45px; color: #64748b;">${pct}%</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <!-- Financial Reconciliation -->
      <div class="summary-pane">
        <div class="pane-title">Financial Summary & Reconciliation</div>
        <table class="pane-table">
          <tbody>
            <tr>
              <td>Subtotal (Measured Works):</td>
              <td class="num bold">${curr} ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Contingency (${contingencyPercent}%):</td>
              <td class="num">${curr} ${contingencyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Tax & Applicable Levies (${selectedTaxCode?.code ? selectedTaxCode.code + ' ' : ''}${taxPercent}%):</td>
              <td class="num">${curr} ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Preliminaries & Other Charges:</td>
              <td class="num">${curr} ${Number(otherCharges || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr class="grand-row">
              <td>Final Estimated Contract Cost:</td>
              <td class="num">${curr} ${finalEstimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 7. Approval & Sign-Off Block -->
    <div class="signatures-row">
      <div class="signature-card">
        <div class="sig-heading">Prepared By</div>
        <div class="sig-person">${preparedByName || activeBOQ?.prepared_by_name || "—"}</div>
        <div class="sig-sub">Date: ${preparedDate || (activeBOQ?.prepared_date ? String(activeBOQ.prepared_date).split("T")[0] : "—")}</div>
        <div class="sig-underline">Authorized Signature</div>
      </div>
      <div class="signature-card">
        <div class="sig-heading">Reviewed By</div>
        <div class="sig-person">${reviewedByName || activeBOQ?.reviewed_by_name || "—"}</div>
        <div class="sig-sub">Date: ${reviewedDate || (activeBOQ?.reviewed_date ? String(activeBOQ.reviewed_date).split("T")[0] : "—")}</div>
        <div class="sig-underline">Authorized Signature</div>
      </div>
      <div class="signature-card">
        <div class="sig-heading">Approved By</div>
        <div class="sig-person">${approvedByName || activeBOQ?.approved_by_name || "—"}</div>
        <div class="sig-sub">Date: ${approvedDate || (activeBOQ?.approved_date ? String(activeBOQ.approved_date).split("T")[0] : "—")}</div>
        <div class="sig-underline">Authorized Signature</div>
      </div>
    </div>

    <!-- 8. Document Footer -->
    <div class="print-footer">
      <span>OmniSuite ERP  •  Project Management & Construction Module</span>
      <span>Official Contract Document  •  Generated: ${new Date().toLocaleString()}</span>
    </div>
  </div>
</body>
</html>`;

      setPrintHtml(html);
      setPrintModalOpen(true);
    } catch (e) {
      console.error("Print generation error:", e);
      toast.error("Failed to generate print document");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await renderHtmlToPdf(printHtml, `${activeBOQ?.boq_reference || "BOQ"}.pdf`);
    } catch (e) {
      toast.error("Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const currentStatusBadge = activeBOQ ? (STATUS_BADGES[activeBOQ.status] || STATUS_BADGES.DRAFT) : STATUS_BADGES.DRAFT;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:max-w-none">
      {/* Canonical Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <FileSpreadsheet size={26} className="text-brand-600 dark:text-brand-400" />
              Bill of Quantities (BOQ) & Cost Schedule
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Project:</span>
            <select
              className="input text-sm py-1.5 h-auto min-w-[200px]"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
            >
              <option value="">-- Select a Project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_code} - {p.project_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchBOQs}
            className="p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
            title="Refresh BOQs"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={openCreateModal}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New BOQ
          </button>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 flex items-center justify-center mx-auto">
            <Layers size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Please Select a Project</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a project from the dropdown above to view, manage, and create Bills of Quantities and Cost Schedules.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* BOQ Selection Bar & Project Details Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Project Details Banner */}
        <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                  {selectedProject?.project_code || "PRJ"}
                </span>
                {activeBOQ?.boq_date && (
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Clock size={12} /> {String(activeBOQ.boq_date).split("T")[0]}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {activeBOQ ? activeBOQ.boq_title || activeBOQ.title : selectedProject ? `${selectedProject.project_name} (BOQ Schedule)` : "Bill of Quantities"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Project Name:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProject?.project_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Client / Employer:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{activeBOQ?.client_name || selectedProject?.client_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Site Location:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{activeBOQ?.site_location || [selectedProject?.site_address, selectedProject?.site_city].filter(Boolean).join(", ") || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">BOQ Reference:</span>
                  <span className="font-bold font-mono text-brand-600 dark:text-brand-400">{activeBOQ?.boq_reference || activeBOQ?.boq_number || "—"}</span>
                </div>
              </div>
            </div>

            {/* Quick Switcher among existing project BOQs */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 print:hidden">
              <div className="w-full sm:w-auto">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Active BOQ Document:
                </label>
                <select
                  className="input text-sm py-1.5 h-auto w-full min-w-[220px]"
                  value={activeBOQ?.id || ""}
                  onChange={e => loadBOQDetails(e.target.value)}
                >
                  {boqs.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.boq_reference ? `[${b.boq_reference}] ` : ""}{b.boq_title || b.title} (v{b.version || "1.0"})
                    </option>
                  ))}
                  {boqs.length === 0 && <option value="">No BOQs Available</option>}
                </select>
              </div>

              {activeBOQ && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRevisionModal(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition"
                    title="Revision History & New Version"
                  >
                    <History size={14} className="text-blue-500" /> Revisions ({revisions.length})
                  </button>
                  <button
                    onClick={() => {
                      setTargetStatus(activeBOQ.status === "APPROVED" ? "REVISED" : "APPROVED");
                      setShowStatusModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5 transition"
                  >
                    <ShieldCheck size={14} /> Workflow Status
                  </button>
                  <button
                    onClick={handleDeleteBOQ}
                    className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 transition"
                    title="Delete BOQ"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cost Category Summary Cards */}
        {activeBOQ && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Package size={12} /> Materials
              </span>
              <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                {currency} {categoryTotals.MATERIALS.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Users size={12} /> Labour
              </span>
              <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                {currency} {categoryTotals.LABOUR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <Wrench size={12} /> Equipment
              </span>
              <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                {currency} {categoryTotals.EQUIPMENT.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <HardHat size={12} /> Subcontracts
              </span>
              <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                {currency} {categoryTotals.SUBCONTRACTING.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                <Truck size={12} /> Transport
              </span>
              <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                {currency} {categoryTotals.TRANSPORTATION.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <DollarSign size={12} /> Other / Overheads
              </span>
              <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                {currency} {categoryTotals.OTHER.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main BOQ Line Items Grid */}
      {activeBOQ ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Grid Toolbar */}
          <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Layers size={16} className="text-brand-600" />
                Line Items ({boqItems.length})
              </span>
              <button
                onClick={addItemRow}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1 transition"
              >
                <Plus size={14} /> Add Line Item
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelImport}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition"
                title="Import Excel or CSV items"
              >
                <Upload size={14} /> Import Excel
              </button>
              <button
                onClick={exportExcel}
                disabled={!boqItems.length}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition disabled:opacity-50"
                title="Export BOQ Schedule to Excel (.xlsx)"
              >
                <Download size={14} /> Export Excel
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition"
                title="Print Preview BOQ with Document Template Header"
              >
                <Printer size={14} /> Print
              </button>
              <button
                onClick={() => handleSaveBOQ(false)}
                disabled={saving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 w-28">Item Code</th>
                  <th className="p-3 min-w-[260px]">Description of Work</th>
                  <th className="p-3 w-36">Cost Category</th>
                  <th className="p-3 w-32">Unit (UoM)</th>
                  <th className="p-3 w-24 text-right">Quantity</th>
                  <th className="p-3 w-28 text-right">Unit Rate</th>
                  <th className="p-3 w-32 text-right">Amount ({currency})</th>
                  <th className="p-3 w-20 text-center print:hidden">Rate Build</th>
                  <th className="p-3 w-14 text-center print:hidden">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {boqItems.map((item, idx) => {
                  const catConfig = COST_CATEGORIES.find(c => c.value === item.cost_category) || COST_CATEGORIES[0];
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors">
                      {/* Line Number */}
                      <td className="p-2.5 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      {/* Item Code */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          required
                          placeholder="e.g. CIV-001"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.item_code}
                          onChange={e => updateItem(idx, "item_code", e.target.value)}
                        />
                      </td>

                      {/* Description of Work */}
                      <td className="p-2.5">
                        <textarea
                          rows={2}
                          required
                          placeholder="Detailed specification of materials, services, or work to be performed..."
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed resize-y"
                          value={item.item_description || item.description || ""}
                          onChange={e => updateItem(idx, "item_description", e.target.value)}
                        />
                      </td>

                      {/* Cost Category */}
                      <td className="p-2.5">
                        <select
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.cost_category || "MATERIALS"}
                          onChange={e => updateItem(idx, "cost_category", e.target.value)}
                        >
                          {COST_CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Unit of Measurement */}
                      <td className="p-2.5">
                        <select
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.uom || item.unit || "EA"}
                          onChange={e => updateItem(idx, "uom", e.target.value)}
                        >
                          {UOM_OPTIONS.map(u => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Quantity */}
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="any"
                          required
                          min="0"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-right text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.quantity}
                          onChange={e => updateItem(idx, "quantity", e.target.value)}
                        />
                      </td>

                      {/* Unit Rate */}
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="any"
                          required
                          min="0"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-right text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.unit_rate}
                          onChange={e => updateItem(idx, "unit_rate", e.target.value)}
                        />
                      </td>

                      {/* Amount */}
                      <td className="p-2.5 text-right font-mono font-bold text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Rate Build-Up action */}
                      <td className="p-2.5 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => openRateAnalysis(item)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition"
                          title="Open Rate Build-Up Analysis"
                        >
                          <Calculator size={14} />
                        </button>
                      </td>

                      {/* Delete */}
                      <td className="p-2.5 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Remove Line Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {boqItems.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                      No line items added yet. Click &quot;Add Line Item&quot; or &quot;Import CSV&quot; to populate your BOQ schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Contingency, Taxes, and Totals Summary Section */}
          <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Approval Workflow & Governance (Replacing static manual sign-off) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Approval Workflow & Governance
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Multi-level sign-off, audit trail, and governed approval progression
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border uppercase tracking-wider ${currentStatusBadge.cls}`}>
                    {currentStatusBadge.label}
                  </span>
                </div>

                {/* Workflow Status Info Box */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Workflow Stage:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{currentStatusBadge.label}</span>
                  </div>
                  {activeBOQ?.forwarded_to_username && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Assigned Approver:</span>
                      <span className="font-semibold text-brand-600 dark:text-brand-400 font-mono">
                        {activeBOQ.forwarded_to_username}
                      </span>
                    </div>
                  )}
                  {activeBOQ?.approved_by_name && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Approved By:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {activeBOQ.approved_by_name} {activeBOQ.approved_date ? `(${String(activeBOQ.approved_date).split("T")[0]})` : ""}
                      </span>
                    </div>
                  )}
                  {activeBOQ?.approval_remarks && (
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[11px] mb-0.5">Workflow Remarks:</span>
                      <span className="text-slate-700 dark:text-slate-300 italic">{activeBOQ.approval_remarks}</span>
                    </div>
                  )}
                </div>

                {/* Workflow Action Buttons (Sales Order Style) */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {/* Forward for Approval */}
                  {(["DRAFT", "REVERSED", "RETURNED"].includes(String(activeBOQ?.status || "DRAFT").toUpperCase())) && (
                    <button
                      type="button"
                      onClick={openForwardModal}
                      disabled={!activeBOQ}
                      className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Send size={15} /> Forward for Approval
                    </button>
                  )}

                  {/* Approve & Reject */}
                  {(["PENDING_APPROVAL", "UNDER_REVIEW"].includes(String(activeBOQ?.status || "").toUpperCase())) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowApproveModal(true)}
                        className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                      >
                        <CheckCircle size={15} /> Approve BOQ
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRejectModal(true)}
                        className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all"
                      >
                        <X size={15} /> Reject
                      </button>
                    </>
                  )}

                  {/* Reverse Approval */}
                  {(String(activeBOQ?.status || "").toUpperCase() === "APPROVED") && (
                    <button
                      type="button"
                      onClick={handleReverseSubmit}
                      className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all"
                    >
                      <RotateCcw size={15} /> Reverse Approval
                    </button>
                  )}

                  {/* View Revision & Approval Audit History */}
                  <button
                    type="button"
                    onClick={() => setShowRevisionModal(true)}
                    className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Audit trail and historical snapshots"
                  >
                    <History size={15} /> Audit Log ({revisions.length})
                  </button>
                </div>

                {/* Specification Notes / General Remarks */}
                <div className="pt-2">
                  <label className="text-slate-500 font-semibold block mb-1 text-xs">
                    Specification Notes & Exclusions:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Specification standard (SMM7/POMI/CESMM), tender exclusions, mobilization terms..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    disabled={activeBOQ?.status === "APPROVED"}
                  />
                </div>
              </div>

              {/* Financial Totals Breakdown Box */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>BOQ Financial Summary & Contingency</span>
                  <span className="font-mono text-brand-600">{currency}</span>
                </h4>

                <div className="space-y-3 text-xs border-b border-slate-200 dark:border-slate-800 pb-4">
                  {/* Subtotal */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Direct Cost Subtotal:</span>
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Contingency */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">Contingency:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right"
                          value={contingencyPercent}
                          onChange={e => setContingencyPercent(e.target.value)}
                        />
                        <span className="text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {currency} {contingencyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Tax Code Selection & Applicable Levies */}
                  <div className="space-y-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                        Tax Code & Levies:
                      </span>
                      <select
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-[210px]"
                        value={selectedTaxCodeId}
                        onChange={e => handleTaxCodeSelect(e.target.value)}
                        disabled={activeBOQ?.status === "APPROVED"}
                      >
                        <option value="">-- Select Linked Tax Code --</option>
                        {boqTaxCodes.map(tc => (
                          <option key={tc.id} value={tc.id}>
                            {tc.code} ({Number(tc.rate_percent)}%) - {tc.name}
                          </option>
                        ))}
                        <option value="CUSTOM">Custom Percentage...</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px] font-medium">Applied Rate:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right"
                            value={taxPercent}
                            onChange={e => {
                              setTaxPercent(e.target.value);
                              if (selectedTaxCodeId !== "CUSTOM") setSelectedTaxCodeId("CUSTOM");
                            }}
                            disabled={activeBOQ?.status === "APPROVED"}
                          />
                          <span className="text-slate-400 font-bold">%</span>
                        </div>
                        {selectedTaxCode && selectedTaxCode.code !== "CUSTOM" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800">
                            {selectedTaxCode.code}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {currency} {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Other Charges / Preliminaries */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Preliminaries & Other Charges:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-mono text-xs">{currency}</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-right"
                        value={otherCharges}
                        onChange={e => setOtherCharges(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Final Estimated Cost */}
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                      Final Estimated Cost (Total BOQ Amount)
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Inclusive of direct costs, contingency, taxes & preliminaries
                    </span>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                    {currency} {finalEstimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => handleSaveBOQ(true, "Saved with revision record")}
                    disabled={saving}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Save & Create Revision Snapshot
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveBOQ(false)}
                    disabled={saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <Save size={14} /> {saving ? "Saving..." : "Save BOQ"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 flex items-center justify-center mx-auto">
            <FileSpreadsheet size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No BOQ Selected</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an existing Bill of Quantities from the project list above or create a new one to begin estimating.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 inline-flex items-center gap-2 transition"
          >
            <Plus size={16} /> Create First BOQ for Project
          </button>
        </div>
      )}
        </>
      )}

      {/* Modal: Create BOQ */}
      <ProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Bill of Quantities (BOQ)"
        subtitle="Set up project details, client, site location, contingency, and initial revision"
        icon={FileSpreadsheet}
        onSubmit={handleCreateBOQ}
        submitLabel="Create BOQ"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                BOQ Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Architectural & Structural Works BOQ"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newBOQ.boq_title}
                onChange={e => setNewBOQ({ ...newBOQ, boq_title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                BOQ Reference Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. BOQ-PRJ01-2026-001"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={newBOQ.boq_reference}
                onChange={e => setNewBOQ({ ...newBOQ, boq_reference: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Client / Employer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Ministry of Works & Housing / Client Co."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newBOQ.client_name}
                onChange={e => setNewBOQ({ ...newBOQ, client_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Site Location / Address
              </label>
              <input
                type="text"
                placeholder="e.g. Plot 14B, Airport Residential, Accra"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newBOQ.site_location}
                onChange={e => setNewBOQ({ ...newBOQ, site_location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Date of Issue
              </label>
              <input
                type="date"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={newBOQ.boq_date}
                onChange={e => setNewBOQ({ ...newBOQ, boq_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Currency
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newBOQ.currency}
                onChange={e => setNewBOQ({ ...newBOQ, currency: e.target.value })}
              >
                <option value="GHS">GHS (Ghana Cedi)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Contingency Rate (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="5"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={newBOQ.contingency_percent}
                onChange={e => setNewBOQ({ ...newBOQ, contingency_percent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Applicable Tax Code
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newBOQ.tax_code_id || ""}
                onChange={e => {
                  const val = e.target.value;
                  const found = boqTaxCodes.find(tc => String(tc.id) === String(val));
                  setNewBOQ({
                    ...newBOQ,
                    tax_code_id: val ? Number(val) : null,
                    tax_code: found ? found.code : null,
                    tax_percent: found ? Number(found.rate_percent || 0) : 0,
                  });
                }}
              >
                <option value="">No Tax (0%)</option>
                {boqTaxCodes.map(tc => (
                  <option key={tc.id} value={tc.id}>
                    {tc.code} ({Number(tc.rate_percent)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Remarks, Specifications & Preliminaries
            </label>
            <textarea
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
              placeholder="Scope description, standard method of measurement (SMM7/CESMM), contract clauses..."
              value={newBOQ.remarks}
              onChange={e => setNewBOQ({ ...newBOQ, remarks: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Rate Build-Up Analysis */}
      <ProjectModal
        open={showRateModal}
        onClose={() => setShowRateModal(false)}
        title="Rate Build-Up Analysis"
        subtitle={`Item ${activeItemForRate?.item_code || ""}: ${activeItemForRate?.item_description || activeItemForRate?.description || "Work item"}`}
        icon={Calculator}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowRateModal(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyRateAnalysis}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              Apply Rate to Item
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Material Cost / Unit ({currency})
              </label>
              <input
                type="number"
                step="any"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                value={rateForm.material_cost}
                onChange={e => setRateForm({ ...rateForm, material_cost: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Direct Labour / Unit ({currency})
              </label>
              <input
                type="number"
                step="any"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                value={rateForm.labour_cost}
                onChange={e => setRateForm({ ...rateForm, labour_cost: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Plant & Equipment / Unit ({currency})
              </label>
              <input
                type="number"
                step="any"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                value={rateForm.plant_cost}
                onChange={e => setRateForm({ ...rateForm, plant_cost: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Subcontract & Specialist ({currency})
              </label>
              <input
                type="number"
                step="any"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                value={rateForm.subcontract_cost}
                onChange={e => setRateForm({ ...rateForm, subcontract_cost: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl flex justify-between items-center text-xs border border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Direct Cost Subtotal:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {currency} {calculatedDirectCost.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Overhead Rate (%)</label>
              <input
                type="number"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                value={rateForm.overhead_percent}
                onChange={e => setRateForm({ ...rateForm, overhead_percent: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Profit Margin (%)</label>
              <input
                type="number"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                value={rateForm.profit_percent}
                onChange={e => setRateForm({ ...rateForm, profit_percent: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-xl flex justify-between items-center">
            <div>
              <p className="text-xs font-bold uppercase text-brand-800 dark:text-brand-300">Computed Unit Rate</p>
              <p className="text-[11px] text-slate-500">
                Direct ({calculatedDirectCost.toFixed(2)}) + Overhead ({calculatedOverhead.toFixed(2)}) + Profit ({calculatedProfit.toFixed(2)})
              </p>
            </div>
            <div className="text-xl font-bold font-mono text-brand-700 dark:text-brand-200">
              {currency} {calculatedUnitRate.toFixed(2)}
            </div>
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Revision History & Create New Revision */}
      <ProjectModal
        open={showRevisionModal}
        onClose={() => setShowRevisionModal(false)}
        title="BOQ Revision & Audit History"
        subtitle={`Audit trail for ${activeBOQ?.boq_reference || "BOQ"} - Version ${activeBOQ?.version || "1.0"}`}
        icon={History}
        showFooter={false}
      >
        <div className="space-y-6">
          {/* Create New Version Box */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Create New Revision Version
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">New Version Number</label>
                <input
                  type="text"
                  placeholder="e.g. 2.0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-mono font-bold"
                  value={newVersionLabel}
                  onChange={e => setNewVersionLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Revision Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Revised based on structural engineer addendum 3"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  value={newVersionRemarks}
                  onChange={e => setNewVersionRemarks(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleCreateRevision}
                className="btn btn-primary text-xs font-semibold flex items-center gap-1.5"
              >
                <History size={14} /> Commit New Revision
              </button>
            </div>
          </div>

          {/* Historical Revisions Log */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Historical Log Entries ({revisions.length})
            </h4>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Rev</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Prepared</th>
                    <th className="p-2.5">Approved</th>
                    <th className="p-2.5 text-right">Total Amount</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {revisions.map((rev) => (
                    <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono font-bold text-brand-600">{rev.version}</td>
                      <td className="p-2.5 font-mono text-slate-500">{String(rev.revision_date || rev.created_at).split("T")[0]}</td>
                      <td className="p-2.5">{rev.prepared_by || "—"}</td>
                      <td className="p-2.5">{rev.approved_by || "—"}</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {Number(rev.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {rev.status || "DRAFT"}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-500 max-w-xs truncate">{rev.remarks || "—"}</td>
                    </tr>
                  ))}
                  {revisions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                        No previous revision records archived.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Workflow Status & Approval Transition */}
      <ProjectModal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="BOQ Workflow Approval Transition"
        subtitle={`Update official status for ${activeBOQ?.boq_reference || "BOQ"}`}
        icon={ShieldCheck}
        onSubmit={(e) => { e.preventDefault(); handleStatusTransition(); }}
        submitLabel="Update Status"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Select Target Workflow Status <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={targetStatus}
              onChange={e => setTargetStatus(e.target.value)}
            >
              <option value="DRAFT">DRAFT - Internal Estimating Work in Progress</option>
              <option value="UNDER_REVIEW">UNDER REVIEW - Submitted for Commercial Verification</option>
              <option value="APPROVED">APPROVED - Formally Ratified for Construction / Tender</option>
              <option value="REVISED">REVISED - Superseded by Subsequent Addendum</option>
              <option value="REJECTED">REJECTED - Disapproved / Returned for Corrections</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Approving Authority / Reviewer Name
            </label>
            <input
              type="text"
              placeholder="e.g. Ing. Kwame Mensah (Project Director)"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
              value={approvedByName}
              onChange={e => setApprovedByName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Approval / Status Remarks
            </label>
            <textarea
              rows={3}
              placeholder="Enter determination notes, tender committee reference, or conditions of approval..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
              value={approvalRemarks}
              onChange={e => setApprovalRemarks(e.target.value)}
            />
          </div>
        </div>
      </ProjectModal>
    
      {/* Forward for Approval Modal (Sales Order Standard) */}
      {showForwardModal && (
        <ProjectModal
          open={showForwardModal}
          onClose={() => setShowForwardModal(false)}
          title="Forward for Approval"
          subtitle={`Submit ${activeBOQ?.boq_reference || "BOQ"} into the approval workflow`}
          icon={Send}
          showFooter={false}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="text-slate-600 dark:text-slate-300 flex justify-between">
                <span>Document Reference:</span>
                <span className="font-bold font-mono text-brand-600 dark:text-brand-400">
                  {activeBOQ?.boq_reference || "—"}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300 flex justify-between">
                <span>Total Amount:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {currency} {finalEstimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300 flex justify-between">
                <span>Workflow Definition:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {candidateWorkflow ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})` : "Standard BOQ Approval (Default)"}
                </span>
              </div>
            </div>

            {wfLoading ? (
              <div className="py-4 text-center text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin" /> Loading workflow approvers...
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Select Target Approver:
                  </label>
                  <select
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    value={targetApproverId}
                    onChange={e => setTargetApproverId(e.target.value)}
                  >
                    <option value="">-- Choose Approver --</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.full_name || u.username} {u.role_name ? `(${u.role_name})` : ""}
                      </option>
                    ))}
                  </select>
                  {firstApprover && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Step {firstApprover.step_order || 1}: {firstApprover.step_name || "Approval"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Submission Comments / Cover Note:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add cover notes or instructions for the reviewing authority..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={forwardComments}
                    onChange={e => setForwardComments(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowForwardModal(false)}
                className="btn btn-secondary px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForwardSubmit}
                disabled={submittingForward}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {submittingForward ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Forwarding...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Submit for Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </ProjectModal>
      )}

      {/* Approve BOQ Modal */}
      {showApproveModal && (
        <ProjectModal
          open={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          title="Approve Bill of Quantities"
          subtitle={`Authorize and ratify ${activeBOQ?.boq_reference || "BOQ"}`}
          icon={CheckCircle}
          showFooter={false}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to approve BOQ <strong className="text-slate-900 dark:text-white">{activeBOQ?.boq_reference}</strong>? Once approved, line items and tender rates will be locked.
            </p>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Approval Remarks / Comments (Optional):
              </label>
              <textarea
                rows={3}
                placeholder="Approved based on tender scope and QS verification..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={approveComments}
                onChange={e => setApproveComments(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="btn btn-secondary px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
              >
                <CheckCircle size={14} /> Confirm Approval
              </button>
            </div>
          </div>
        </ProjectModal>
      )}

      {/* Reject BOQ Modal */}
      {showRejectModal && (
        <ProjectModal
          open={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Bill of Quantities"
          subtitle={`Return ${activeBOQ?.boq_reference || "BOQ"} with review corrections`}
          icon={X}
          showFooter={false}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Please enter the reason for rejecting BOQ <strong className="text-slate-900 dark:text-white">{activeBOQ?.boq_reference}</strong>.
            </p>
            <div>
              <label className="font-bold text-rose-600 dark:text-rose-400 block mb-1">
                Rejection Reason (Required):
              </label>
              <textarea
                rows={3}
                placeholder="Rate discrepancies, missing specifications, budget exceeded..."
                className="w-full bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="btn btn-secondary px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all"
              >
                <X size={14} /> Confirm Rejection
              </button>
            </div>
          </div>
        </ProjectModal>
      )}

      {/* Print Preview Modal with Document Template Header */}
      <PrintPreviewModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        html={printHtml}
        downloading={downloadingPdf}
        onDownload={handleDownloadPdf}
      />
    </div>
  );
}
