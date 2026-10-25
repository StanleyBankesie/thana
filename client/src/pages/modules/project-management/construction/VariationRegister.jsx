/**
 * @file VariationRegister.jsx
 * @description Enterprise Variations & Change Orders Module for OmniSuite ERP.
 * Captures all information needed to request, evaluate, approve, cost, and implement
 * a change to an existing project without duplicating PM, BOQ, Contracts, or Finance data:
 * - Section 1. Change Identification: Auto-generated reference, Document Stage, Project, Type, Reason, Description.
 * - Section 2. Scope & BOQ Changes: Repeatable line-item grid with additions, modifications, omissions, and replacements.
 * - Section 3. Financial Impact: Baseline preservation, contractor's proposed vs assessed vs approved, markup, tax, contingency.
 * - Section 4. Schedule & Delivery Impact: Original completion, calendar days impact, revised completion date, task dependencies.
 * - Section 5. Supporting Information & Risk Assessment: Drawings, client instructions, quotations, site photos, HSSE/quality risks.
 * - Section 6. Review & Approval: 7-stage workflow stepper, multi-disciplinary review comments, downstream contract & budget integration.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FileEdit,
  Plus,
  DollarSign,
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  X,
  AlertTriangle,
  Search,
  RefreshCw,
  FileText,
  Layers,
  ShieldCheck,
  Upload,
  Download,
  Printer,
  Eye,
  Trash2,
  Edit3,
  Sliders,
  Building,
  Users,
  CheckSquare,
  Package,
  History,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  FileSpreadsheet,
  TrendingUp,
  ArrowRight,
  HardHat,
  Paperclip,
  Check,
  RotateCcw,
  Sparkles,
  Cloud,
  Loader2,
  FolderArchive
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";
import { fetchReportHeader, renderHtmlToPdf } from "../../../../utils/pdfUtils.js";
import PrintPreviewModal from "../../../../components/PrintPreviewModal.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { ListAttachmentIconButton } from "@/components/list/ListDocActionIconButtons.jsx";

// 7-Stage Workflow Definition matching user specification
export const WORKFLOW_STAGES = [
  { stage: 1, key: "DRAFT", label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300" },
  { stage: 2, key: "SUBMITTED", label: "Submitted for Review", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" },
  { stage: 3, key: "UNDER_ASSESSMENT", label: "Under Technical / Commercial Assessment", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" },
  { stage: 4, key: "PENDING_AUTHORIZATION", label: "Pending Authorization", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 animate-pulse" },
  { stage: 5, key: "APPROVED", label: "Approved / Change Order Issued", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { stage: 6, key: "IN_IMPLEMENTATION", label: "In Implementation", cls: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300" },
  { stage: 7, key: "COMPLETED", label: "Completed / Closed", cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300" },
  { stage: 0, key: "REJECTED", label: "Rejected", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300" },
  { stage: 0, key: "WITHDRAWN", label: "Withdrawn", cls: "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400" },
  { stage: 1, key: "RETURNED", label: "Returned for Revision", cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300" },
];

export const CHANGE_TYPES = [
  { value: "SCOPE_QUANTITY", label: "Scope / Quantity Adjustment" },
  { value: "DESIGN_CHANGE", label: "Design / Drawing Revision" },
  { value: "SITE_CONDITION", label: "Unforeseen Site Condition" },
  { value: "CLIENT_REQUEST", label: "Client Instruction / Request" },
  { value: "STATUTORY", label: "Statutory / Regulatory Compliance" },
  { value: "OMISSION", label: "Scope Omission / Reduction" },
  { value: "MATERIAL_SUBSTITUTION", label: "Material / Specification Substitution" },
  { value: "ACCELERATION", label: "Schedule Acceleration / Overtime" },
  { value: "VALUE_ENGINEERING", label: "Value Engineering Proposal" },
  { value: "OTHER", label: "Other Contractual Adjustment" },
];

export const REASON_OPTIONS = [
  { value: "CLIENT_REQUEST", label: "Client Request / Scope Addition" },
  { value: "SITE_CONDITION", label: "Unforeseen Ground / Structural Site Condition" },
  { value: "DESIGN_CHANGE", label: "Consultant / Architectural Drawing Revision" },
  { value: "VALUE_ENGINEERING", label: "Cost Optimization / Value Engineering" },
  { value: "STATUTORY", label: "Statutory, Fire or Building Code Compliance" },
  { value: "OMISSION", label: "Work Item Cancelled or Omitted" },
  { value: "MATERIAL_UNAVAILABLE", label: "Specified Material Unavailable in Market" },
  { value: "SAFETY_MEASURE", label: "Health, Safety & Environmental Protection" },
  { value: "OTHER", label: "Other Justified Cause" },
];

export const UOM_OPTIONS = ["Each", "m", "m²", "m³", "kg", "ton", "day", "hr", "lot", "month"];

export const COST_CATEGORIES = [
  { value: "MATERIALS", label: "Materials & Consumables" },
  { value: "LABOUR", label: "Labour & Workforce" },
  { value: "EQUIPMENT", label: "Plant & Equipment" },
  { value: "SUBCONTRACTING", label: "Subcontractor Works" },
  { value: "TRANSPORTATION", label: "Transportation & Haulage" },
  { value: "OTHER", label: "Other Direct Expenses" },
];

export default function VariationRegister() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");

  // Mode: "REGISTER" (Table View) or "FORM" (Single Form Page View)
  const [viewMode, setViewMode] = useState("REGISTER");
  const [savingForm, setSavingForm] = useState(false);

  // Form State
  const initialForm = {
    id: null,
    variation_no: "",
    document_stage: "VARIATION_REQUEST",
    project_id: "",
    title: "",
    change_type: "SCOPE_QUANTITY",
    reason: "CLIENT_REQUEST",
    priority: "NORMAL",
    originator: "CLIENT",
    contract_ref: "",
    client_name: "",
    contractor_name: "",
    subcontractor_id: "",
    date_raised: new Date().toISOString().split("T")[0],
    effective_date: "",
    description: "",
    contractor_proposed_amount: 0,
    assessed_amount: 0,
    amount_approved: 0,
    schedule_impact_days: 0,
    original_completion_date: "",
    revised_completion_date: "",
    affected_tasks: "",
    risk_assessment: "",
    hsq_implications: "",
    funding_source: "CLIENT_FUNDED",
    contingency_impact: 0,
    direct_cost: 0,
    overhead_cost: 0,
    markup_percent: 10,
    tax_amount: 0,
    supporting_documents: [],
    pm_review_comments: "",
    qs_review_comments: "",
    finance_review_comments: "",
    client_approval_ref: "",
    status: "DRAFT",
    workflow_stage: 1,
    remarks: ""
  };

  const [form, setForm] = useState(initialForm);
  const [lineItems, setLineItems] = useState([]);
  const [projectBaseline, setProjectBaseline] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectBOQItems, setProjectBOQItems] = useState([]);

  // Workflow Action Modal State
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [targetStatus, setTargetStatus] = useState("SUBMITTED");
  const [workflowComments, setWorkflowComments] = useState("");
  const [workflowApprovalData, setWorkflowApprovalData] = useState({
    amount_approved: 0,
    schedule_impact_days: 0,
    update_contract_sum: true,
    update_project_budget: false,
    budget_adjustment_amount: 0
  });

  // Print Preview States
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [reportHeader, setReportHeader] = useState(null);

  // Subcontracts and Active Contracts
  const [subcontracts, setSubcontracts] = useState([]);

  // Attachments Modal & Cloudinary Upload States (Procurement module pattern)
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef(null);

  // Load Projects, Subcontracts, and Report Header on mount (Do NOT auto-select by default)
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

    (async () => {
      try {
        const subRes = await api.get("/construction/subcontracts").catch(() => ({ data: { items: [] } }));
        setSubcontracts(subRes.data?.items || []);
      } catch (e) {}
    })();

    (async () => {
      try {
        const rh = await fetchReportHeader(api);
        setReportHeader(rh);
      } catch (e) {}
    })();
  }, []);

  // Active contracts across selected project and all projects
  const activeContractsList = useMemo(() => {
    const list = [];
    const seen = new Set();
    const curProjId = form.project_id || selectedProjectId;
    const curProj = projects.find(p => String(p.id) === String(curProjId));

    // 1. Current selected project's primary contract
    if (curProj) {
      const ref = curProj.contract_ref_no || (curProj.project_code ? `${curProj.project_code}-CONTRACT` : "");
      if (ref && !seen.has(ref.toLowerCase())) {
        seen.add(ref.toLowerCase());
        list.push({
          ref,
          projectId: curProj.id,
          label: `${ref} — ${curProj.project_name} (Main Contract)`,
          type: "PRIMARY",
          badge: "Main Contract",
          contractorName: curProj.client_name || ""
        });
      }
    }

    // 2. Subcontracts for current project
    subcontracts.forEach(sc => {
      if (String(sc.project_id) === String(curProjId)) {
        const ref = sc.subcontract_number || sc.contract_no;
        if (ref && !seen.has(ref.toLowerCase())) {
          seen.add(ref.toLowerCase());
          list.push({
            ref,
            projectId: sc.project_id,
            label: `${ref} — ${sc.supplier_name || sc.subcontractor_name || sc.trade || "Subcontract"} (Subcontract)`,
            type: "SUBCONTRACT",
            badge: "Subcontract",
            subcontractorId: sc.subcontractor_id,
            contractorName: sc.supplier_name || sc.subcontractor_name || ""
          });
        }
      }
    });

    // 3. Other active projects with contracts
    projects.forEach(p => {
      if (String(p.id) !== String(curProjId) && p.contract_ref_no) {
        if (!seen.has(p.contract_ref_no.toLowerCase())) {
          seen.add(p.contract_ref_no.toLowerCase());
          list.push({
            ref: p.contract_ref_no,
            projectId: p.id,
            label: `${p.contract_ref_no} — ${p.project_name}`,
            type: "OTHER",
            badge: p.project_code || "Contract"
          });
        }
      }
    });

    return list;
  }, [projects, subcontracts, form.project_id, selectedProjectId]);

  const currentProjectContracts = useMemo(() => {
    const curProjId = form.project_id || selectedProjectId;
    return activeContractsList.filter(c => String(c.projectId) === String(curProjId));
  }, [activeContractsList, form.project_id, selectedProjectId]);

  const handleSelectContract = (contractRef) => {
    const matched = activeContractsList.find(c => c.ref.toLowerCase() === (contractRef || "").trim().toLowerCase());
    setForm(f => ({
      ...f,
      contract_ref: contractRef,
      contractor_name: matched?.contractorName || f.contractor_name,
      subcontractor_id: matched?.subcontractorId || f.subcontractor_id
    }));
  };

  const handleFormProjectChange = async (newProjectId) => {
    const proj = projects.find(p => String(p.id) === String(newProjectId));
    if (!proj) return;

    const projCode = proj.project_code || "PRJ";
    const seq = String(variations.length + 1).padStart(3, "0");
    const autoRef = `VAR-${projCode}-${new Date().getFullYear()}-${seq}`;
    const autoContract = proj.contract_ref_no || (projCode ? `${projCode}-CONTRACT` : "");

    setForm(f => ({
      ...f,
      project_id: newProjectId,
      variation_no: f.variation_no?.startsWith("VAR-") ? autoRef : f.variation_no,
      client_name: proj.client_name || f.client_name,
      contract_ref: autoContract,
      original_completion_date: proj.end_date ? String(proj.end_date).split("T")[0] : f.original_completion_date,
      revised_completion_date: proj.end_date ? String(proj.end_date).split("T")[0] : f.revised_completion_date
    }));

    try {
      const [detailsRes, boqRes] = await Promise.all([
        api.get(`/construction/cost-control/${newProjectId}`).catch(() => ({ data: null })),
        api.get(`/construction/boqs`, { params: { project_id: newProjectId } }).catch(() => ({ data: { items: [] } }))
      ]);

      if (detailsRes?.data) {
        const cs = detailsRes.data.cost_summary || {};
        const p = detailsRes.data.project || {};
        setProjectBaseline({
          contract_sum: Number(p.contract_sum || 0),
          revised_contract_sum: Number(p.revised_contract_sum || p.contract_sum || 0),
          budget: Number(cs.approved_budget || p.budget || 0),
          actual_cost: Number(cs.actual_cost || 0),
          remaining_budget: Number(cs.remaining_budget || 0)
        });
      }

      const boqList = boqRes?.data?.items || [];
      const activeBOQ = boqList.find(b => b.status === "APPROVED") || boqList[0];
      if (activeBOQ) {
        const itemsRes = await api.get(`/construction/boqs/${activeBOQ.id}`).catch(() => ({ data: null }));
        setProjectBOQItems(itemsRes?.data?.items || []);
      } else {
        setProjectBOQItems([]);
      }
    } catch (err) {
      console.error("Error updating project data:", err);
    }
  };

  const handleCloudinaryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      setUploadingDoc(true);
      const newDocs = [];

      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "omnisuite/variations");
        const res = await api.post("/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        const url = res.data?.secure_url || res.data?.url || res.data?.path;
        if (!url) throw new Error(`Upload failed for ${file.name}`);

        const docObj = {
          name: file.name,
          url: url,
          size: file.size,
          mime_type: file.type || "application/octet-stream",
          uploaded_at: new Date().toISOString(),
          is_cloudinary: String(url).includes("cloudinary.com")
        };
        newDocs.push(docObj);

        // If editing an existing variation with ID, also save into adm_document_attachments
        if (form.id) {
          await api.post(`/documents/variation/${form.id}/attachments`, {
            url: url,
            name: file.name,
            title: file.name,
            description: "Uploaded via Variation Register form",
            category: "Variation Evidence",
            mime_type: file.type || null,
            file_size: file.size || null
          }).catch(() => null);
        }
      }

      setForm(f => ({
        ...f,
        supporting_documents: [...(f.supporting_documents || []), ...newDocs]
      }));
      toast.success(`${newDocs.length} attachment(s) uploaded successfully to Cloudinary!`);
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to upload file to Cloudinary");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Update selected project details & load variations
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      setVariations([]);
      return;
    }
    const found = projects.find(p => String(p.id) === String(selectedProjectId));
    setSelectedProject(found || null);
    fetchVariations();
  }, [selectedProjectId]);

  const fetchVariations = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await api.get("/construction/variations", { params: { project_id: selectedProjectId } });
      setVariations(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load variations");
    } finally {
      setLoading(false);
    }
  };

  // Switch to Form Mode for a New Request
  const handleOpenCreateForm = async () => {
    if (!selectedProjectId) {
      return toast.info("Please select a project first");
    }

    const proj = selectedProject || {};
    const projCode = proj.project_code || "PRJ";
    const dateStr = new Date().toISOString().split("T")[0];
    const seq = String(variations.length + 1).padStart(3, "0");
    const autoRef = `VAR-${projCode}-${new Date().getFullYear()}-${seq}`;

    const autoContract = proj.contract_ref_no || (projCode ? `${projCode}-CONTRACT` : "");

    setForm({
      ...initialForm,
      project_id: selectedProjectId,
      variation_no: autoRef,
      client_name: proj.client_name || "",
      contract_ref: autoContract,
      original_completion_date: proj.end_date ? String(proj.end_date).split("T")[0] : "",
      revised_completion_date: proj.end_date ? String(proj.end_date).split("T")[0] : "",
      date_raised: dateStr,
      description: ""
    });

    setLineItems([]);

    // Fetch baseline, tasks, and BOQ items for the selected project
    try {
      const [detailsRes, boqRes] = await Promise.all([
        api.get(`/construction/cost-control/${selectedProjectId}`).catch(() => ({ data: null })),
        api.get(`/construction/boqs`, { params: { project_id: selectedProjectId } }).catch(() => ({ data: { items: [] } }))
      ]);

      if (detailsRes?.data) {
        const cs = detailsRes.data.cost_summary || {};
        const p = detailsRes.data.project || {};
        setProjectBaseline({
          contract_sum: Number(p.contract_sum || 0),
          revised_contract_sum: Number(p.revised_contract_sum || p.contract_sum || 0),
          budget: Number(cs.approved_budget || p.budget || 0),
          actual_cost: Number(cs.actual_cost || 0),
          remaining_budget: Number(cs.remaining_budget || 0)
        });
      }

      const boqList = boqRes?.data?.items || [];
      if (boqList.length > 0) {
        const activeBOQ = boqList[0];
        const itemsRes = await api.get(`/construction/boqs/${activeBOQ.id}`).catch(() => ({ data: null }));
        setProjectBOQItems(itemsRes?.data?.items || []);
      }
    } catch (e) {}

    setViewMode("FORM");
  };

  // Open Existing Variation for View / Edit in Form View
  const handleOpenEditForm = async (variationId) => {
    setLoading(true);
    try {
      const res = await api.get(`/construction/variations/${variationId}`);
      const data = res.data || {};
      const v = data.variation || {};
      const items = data.items || [];
      const financials = data.financials || {};
      setProjectTasks(data.tasks || []);
      setProjectBOQItems(data.boqItems || []);
      setProjectBaseline(financials);

      setForm({
        ...v,
        project_id: String(v.project_id),
        date_raised: v.date_raised ? String(v.date_raised).split("T")[0] : "",
        effective_date: v.effective_date ? String(v.effective_date).split("T")[0] : "",
        original_completion_date: v.original_completion_date ? String(v.original_completion_date).split("T")[0] : "",
        revised_completion_date: v.revised_completion_date ? String(v.revised_completion_date).split("T")[0] : "",
        supporting_documents: Array.isArray(v.supporting_documents) ? v.supporting_documents : (typeof v.supporting_documents === "string" ? JSON.parse(v.supporting_documents || "[]") : [])
      });

      setLineItems(items.map(it => ({
        ...it,
        original_qty: Number(it.original_qty || 0),
        original_rate: Number(it.original_rate || 0),
        original_amount: Number(it.original_amount || 0),
        revised_qty: Number(it.revised_qty || 0),
        proposed_rate: Number(it.proposed_rate || 0),
        proposed_amount: Number(it.proposed_amount || 0),
        qty_diff: Number(it.qty_diff || 0),
        cost_diff: Number(it.cost_diff || 0)
      })));

      setViewMode("FORM");
    } catch (e) {
      toast.error("Failed to load variation details");
    } finally {
      setLoading(false);
    }
  };

  // Scope & BOQ Line Items Handlers
  const handleAddLineItem = () => {
    const newItem = {
      id: "temp_" + Date.now(),
      item_code: "",
      item_description: "",
      change_action: "ADD",
      cost_category: "MATERIALS",
      uom: "Each",
      original_qty: 0,
      original_rate: 0,
      original_amount: 0,
      revised_qty: 1,
      proposed_rate: 0,
      proposed_amount: 0,
      qty_diff: 1,
      cost_diff: 0,
      reason_and_spec: ""
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const handleImportBOQItem = (boqItem) => {
    const origQty = Number(boqItem.quantity || 0);
    const origRate = Number(boqItem.unit_rate || 0);
    const origAmt = origQty * origRate;
    const newItem = {
      id: "temp_" + Date.now(),
      boq_item_id: boqItem.id,
      item_code: boqItem.item_code || "",
      item_description: boqItem.item_description || "",
      change_action: "MODIFY",
      cost_category: boqItem.cost_category || "MATERIALS",
      uom: boqItem.uom || "Each",
      original_qty: origQty,
      original_rate: origRate,
      original_amount: origAmt,
      revised_qty: origQty,
      proposed_rate: origRate,
      proposed_amount: origAmt,
      qty_diff: 0,
      cost_diff: 0,
      reason_and_spec: "Scope adjustment against original BOQ baseline"
    };
    setLineItems(prev => [...prev, newItem]);
    toast.success(`Imported BOQ Item ${boqItem.item_code || ""}`);
  };

  const handleUpdateLineItem = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === "change_action") {
        if (value === "ADD") {
          item.original_qty = 0;
          item.original_rate = 0;
          item.original_amount = 0;
        } else if (value === "OMIT") {
          item.revised_qty = 0;
          item.proposed_rate = item.original_rate;
        }
      }

      // Reactive Financial Calculations:
      // Quantity change = Revised quantity − Original quantity
      // Proposed line value = Revised quantity × Proposed unit rate
      const origQty = Number(item.original_qty || 0);
      const origRate = Number(item.original_rate || 0);
      const revQty = Number(item.revised_qty || 0);
      const propRate = Number(item.proposed_rate || 0);

      item.original_amount = origQty * origRate;
      item.proposed_amount = revQty * propRate;
      item.qty_diff = revQty - origQty;
      item.cost_diff = item.proposed_amount - item.original_amount;

      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveLineItem = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  // Line item summary calculations
  const lineItemSummary = useMemo(() => {
    let additions = 0;
    let omissions = 0;
    let net = 0;
    lineItems.forEach(it => {
      const diff = Number(it.cost_diff || 0);
      if (diff > 0) additions += diff;
      else omissions += Math.abs(diff);
      net += diff;
    });
    return { additions, omissions, net };
  }, [lineItems]);

  // Sync line item net change to form direct cost if items are present
  useEffect(() => {
    if (lineItems.length > 0) {
      setForm(f => ({
        ...f,
        direct_cost: lineItemSummary.net,
        contractor_proposed_amount: f.contractor_proposed_amount === 0 ? lineItemSummary.net : f.contractor_proposed_amount,
        assessed_amount: f.assessed_amount === 0 ? lineItemSummary.net : f.assessed_amount
      }));
    }
  }, [lineItemSummary.net]);

  // Reactive Schedule Calculations:
  // Revised completion date = Original completion date + schedule_impact_days
  useEffect(() => {
    if (form.original_completion_date && form.schedule_impact_days !== undefined) {
      try {
        const origDate = new Date(form.original_completion_date);
        if (!isNaN(origDate.getTime())) {
          origDate.setDate(origDate.getDate() + Number(form.schedule_impact_days || 0));
          setForm(f => ({ ...f, revised_completion_date: origDate.toISOString().split("T")[0] }));
        }
      } catch (e) {}
    }
  }, [form.original_completion_date, form.schedule_impact_days]);

  // Save / Submit Full Form
  const handleSaveForm = async (targetWorkflowStatus = null) => {
    if (!form.project_id) return toast.error("Please select a project");
    if (!form.title) return toast.error("Please enter a title for the variation");

    setSavingForm(true);
    const submissionStatus = targetWorkflowStatus || form.status || "DRAFT";
    const payload = {
      ...form,
      status: submissionStatus,
      cost_impact: Number(form.assessed_amount || form.contractor_proposed_amount || lineItemSummary.net || 0),
      items: lineItems
    };

    try {
      if (form.id) {
        await api.put(`/construction/variations/${form.id}`, payload);
        toast.success("Variation updated successfully");
      } else {
        const res = await api.post("/construction/variations", payload);
        toast.success("Variation created successfully");
        setForm(f => ({ ...f, id: res.data?.id, variation_no: res.data?.variation_no || f.variation_no }));
      }
      fetchVariations();
      setViewMode("REGISTER");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save variation");
    } finally {
      setSavingForm(false);
    }
  };

  // Open Quick Workflow Modal from Register Table or Form
  const openWorkflowModal = (v, nextStatus) => {
    setSelectedVariation(v);
    setTargetStatus(nextStatus);
    setWorkflowComments("");
    setWorkflowApprovalData({
      amount_approved: Number(v.assessed_amount || v.cost_impact || 0),
      schedule_impact_days: Number(v.schedule_impact_days || 0),
      update_contract_sum: true,
      update_project_budget: false,
      budget_adjustment_amount: 0
    });
    setWorkflowModalOpen(true);
  };

  const handleAdvanceWorkflow = async (e) => {
    e.preventDefault();
    if (!selectedVariation) return;

    try {
      await api.post(`/construction/variations/${selectedVariation.id}/workflow`, {
        target_status: targetStatus,
        comments: workflowComments,
        ...workflowApprovalData
      });
      toast.success(`Workflow advanced to ${targetStatus}`);
      setWorkflowModalOpen(false);
      fetchVariations();
      if (viewMode === "FORM" && form.id === selectedVariation.id) {
        handleOpenEditForm(selectedVariation.id);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to advance workflow");
    }
  };

  const handleDeleteVariation = async (id) => {
    if (!window.confirm("Are you sure you want to delete this draft variation request?")) return;
    try {
      await api.delete(`/construction/variations/${id}`);
      toast.success("Variation deleted successfully");
      fetchVariations();
      if (viewMode === "FORM") setViewMode("REGISTER");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete variation");
    }
  };

  // Print Official Variation Document
  const handlePrintDocument = async (v = null) => {
    const item = v || form;
    const headerInfo = reportHeader || await fetchReportHeader(api).catch(() => ({}));
    const companyName = headerInfo.companyName || "Company";
    const companyAddress = headerInfo.companyAddress || "";
    const companyContact = [headerInfo.companyPhone, headerInfo.companyEmail].filter(Boolean).join("  |  ");
    const currency = "GH₵";

    const printLineItems = v ? (v.items || lineItems) : lineItems;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; padding: 24px; max-width: 850px; margin: 0 auto; font-size: 12px; line-height: 1.5;">
        <!-- Header -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">${companyName}</h1>
              <p style="margin: 2px 0; color: #64748b; font-size: 11px;">${companyAddress}</p>
              <p style="margin: 2px 0; color: #64748b; font-size: 11px;">${companyContact}</p>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 800; border-radius: 6px; background: #e0f2fe; color: #0369a1; text-transform: uppercase; border: 1px solid #bae6fd;">
                ${item.document_stage === "CHANGE_ORDER" ? "OFFICIAL CHANGE ORDER" : "VARIATION REQUEST"}
              </span>
              <p style="font-family: monospace; font-size: 13px; font-weight: 800; margin: 6px 0 0 0; color: #0f172a;">${item.variation_no || "VAR-DRAFT"}</p>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Date: ${item.date_raised || new Date().toISOString().split("T")[0]}</p>
            </div>
          </div>
        </div>

        <!-- Project & Contract Info -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <tr>
            <td style="padding: 8px 12px; width: 25%; font-size: 11px; color: #64748b; font-weight: bold;">Project Name:</td>
            <td style="padding: 8px 12px; width: 25%; font-size: 12px; font-weight: bold; color: #0f172a;">${selectedProject?.project_name || "—"}</td>
            <td style="padding: 8px 12px; width: 25%; font-size: 11px; color: #64748b; font-weight: bold;">Project Code:</td>
            <td style="padding: 8px 12px; width: 25%; font-size: 12px; font-mono; font-weight: bold; color: #0f172a;">${selectedProject?.project_code || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-size: 11px; color: #64748b; font-weight: bold;">Client / Employer:</td>
            <td style="padding: 8px 12px; font-size: 12px; font-weight: bold; color: #0f172a;">${item.client_name || selectedProject?.client_name || "—"}</td>
            <td style="padding: 8px 12px; font-size: 11px; color: #64748b; font-weight: bold;">Contract Ref:</td>
            <td style="padding: 8px 12px; font-size: 12px; font-mono; font-weight: bold; color: #0f172a;">${item.contract_ref || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-size: 11px; color: #64748b; font-weight: bold;">Change Type:</td>
            <td style="padding: 8px 12px; font-size: 12px; font-weight: bold; color: #0f172a;">${item.change_type}</td>
            <td style="padding: 8px 12px; font-size: 11px; color: #64748b; font-weight: bold;">Priority / Status:</td>
            <td style="padding: 8px 12px; font-size: 12px; font-weight: bold; color: #0f172a;">${item.priority} | ${item.status}</td>
          </tr>
        </table>

        <!-- Title & Description -->
        <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
          <h3 style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #0f172a;">Title: ${item.title}</h3>
          <p style="margin: 0; color: #334155; font-size: 11.5px; white-space: pre-wrap;">${item.description || "No detailed description specified."}</p>
        </div>

        <!-- Scope & BOQ Line Items Grid -->
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a;">Schedule of Changed Items & Quantities</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #e2e8f0; color: #0f172a; text-align: left; font-weight: bold;">
                <th style="padding: 6px; border: 1px solid #cbd5e1;">Code</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">Description</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">Action</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">UoM</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Orig Qty</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Rev Qty</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Diff</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Rate (${currency})</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Cost Diff (${currency})</th>
              </tr>
            </thead>
            <tbody>
              ${printLineItems.length === 0 ? `<tr><td colspan="9" style="padding: 12px; text-align: center; color: #94a3b8; font-style: italic;">No specific line items recorded. Overall lump-sum change applied.</td></tr>` : 
                printLineItems.map(it => `
                  <tr>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; font-family: monospace;">${it.item_code || "—"}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1;">${it.item_description || "—"}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${it.change_action}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${it.uom}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${Number(it.original_qty || 0).toFixed(2)}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${Number(it.revised_qty || 0).toFixed(2)}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: bold;">${Number(it.qty_diff || 0).toFixed(2)}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${Number(it.proposed_rate || it.original_rate || 0).toFixed(2)}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: bold; color: ${Number(it.cost_diff || 0) >= 0 ? '#166534' : '#991b1b'};">
                      ${Number(it.cost_diff || 0) >= 0 ? '+' : ''}${Number(it.cost_diff || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>

        <!-- Financial Impact Summary Box -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #cbd5e1;">
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px 12px; font-weight: bold;">Net Cost Impact:</td>
            <td style="padding: 8px 12px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; color: #0f172a;">
              ${currency} ${Number(item.assessed_amount || item.cost_impact || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>
            <td style="padding: 8px 12px; font-weight: bold;">Schedule Impact:</td>
            <td style="padding: 8px 12px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; color: #0f172a;">
              +${item.schedule_impact_days || 0} Calendar Days
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold;">Contractor Proposed Price:</td>
            <td style="padding: 8px 12px; text-align: right; font-family: monospace;">${currency} ${Number(item.contractor_proposed_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="padding: 8px 12px; font-weight: bold;">Funding Source:</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: bold;">${item.funding_source || "Client Funded"}</td>
          </tr>
        </table>

        <!-- Signatures & Authorizations -->
        <div style="margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center;">
          <div style="border-top: 1px solid #94a3b8; padding-top: 6px;">
            <p style="margin: 0; font-size: 11px; font-weight: bold;">Prepared by (Contractor / PM)</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Signature & Date</p>
          </div>
          <div style="border-top: 1px solid #94a3b8; padding-top: 6px;">
            <p style="margin: 0; font-size: 11px; font-weight: bold;">Evaluated by (Lead QS)</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Signature & Date</p>
          </div>
          <div style="border-top: 1px solid #94a3b8; padding-top: 6px;">
            <p style="margin: 0; font-size: 11px; font-weight: bold;">Approved by (Employer / Client)</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Authorized Signature & Date</p>
          </div>
        </div>
      </div>
    `;

    setPrintHtml(html);
    setPrintModalOpen(true);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const filename = `${form.variation_no || "Variation"}.pdf`;
      await renderHtmlToPdf(printHtml, filename);
    } catch (e) {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Filtered Variations for Register Table
  const filteredVariations = useMemo(() => {
    return variations.filter(v => {
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      if (stageFilter !== "ALL" && v.document_stage !== stageFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        v.variation_no?.toLowerCase().includes(q) ||
        v.title?.toLowerCase().includes(q) ||
        v.originator?.toLowerCase().includes(q) ||
        v.change_type?.toLowerCase().includes(q) ||
        v.status?.toLowerCase().includes(q)
      );
    });
  }, [variations, statusFilter, stageFilter, searchTerm]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = variations.length;
    const approved = variations.filter(v => v.status === "APPROVED" || v.status === "COMPLETED");
    const totalProposed = variations.reduce((sum, v) => sum + Number(v.contractor_proposed_amount || v.cost_impact || 0), 0);
    const totalApprovedVal = approved.reduce((sum, v) => sum + Number(v.amount_approved || v.cost_impact || 0), 0);
    const totalDays = approved.reduce((sum, v) => sum + Number(v.schedule_impact_days || 0), 0);
    return { total, approvedCount: approved.length, totalProposed, totalApprovedVal, totalDays };
  }, [variations]);

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
              <FileEdit size={26} className="text-brand-600 dark:text-brand-400" />
              Variations & Change Orders
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Request, evaluate, approve, cost, and implement project change orders with baseline audit preservation
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {viewMode === "FORM" ? (
            <button
              onClick={() => setViewMode("REGISTER")}
              className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-2"
            >
              <RotateCcw size={15} /> Back to Register
            </button>
          ) : (
            <>
              {/* Project Switcher */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Project:</span>
                <select
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[220px]"
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
                onClick={fetchVariations}
                disabled={!selectedProjectId}
                className="p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 transition"
                title="Refresh Register"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>

              <button
                onClick={handleOpenCreateForm}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all"
              >
                <Plus size={16} /> New Change Request
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: REGISTER TABLE VIEW */}
      {/* ========================================================================= */}
      {viewMode === "REGISTER" && (
        <>
          {/* No Project Selected State */}
          {!selectedProjectId ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center space-y-6 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
                <FileEdit size={34} />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Please Select a Project</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Select a project from the dropdown above to manage variation requests, review contractual change orders, evaluate cost impacts, and approve time extensions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-brand-600 flex items-center gap-1.5">
                    <FileSpreadsheet size={15} /> Baseline Integrity
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Original BOQ and contract baseline are preserved for full auditable comparisons.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-blue-600 flex items-center gap-1.5">
                    <Layers size={15} /> 7-Stage Workflow
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Structured reviews across PM, Lead Quantity Surveyor, and Client authorization.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                    <DollarSign size={15} /> Contract Reconciliation
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Tracks cumulative changes and separates contract price from internal project budget.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Variations Logged</span>
                  <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{stats.total}</p>
                  <p className="text-[10px] text-slate-500">Registered change proposals</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Change Orders</span>
                  <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{stats.approvedCount}</p>
                  <p className="text-[10px] text-slate-500">Formally authorized by client</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Proposed Value</span>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    GH₵ {stats.totalProposed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500">Contractor claimed amount</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Approved Net Value</span>
                  <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    GH₵ {stats.totalApprovedVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500">Contract sum adjustment</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Approved Time Extension</span>
                  <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
                    +{stats.totalDays} Days
                  </p>
                  <p className="text-[10px] text-slate-500">Cumulative schedule impact</p>
                </div>
              </div>

              {/* Variations Register Table & Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                      Variations Register ({filteredVariations.length})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Stage Filter */}
                    <select
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                      value={stageFilter}
                      onChange={e => setStageFilter(e.target.value)}
                    >
                      <option value="ALL">All Stages</option>
                      <option value="VARIATION_REQUEST">Variation Request</option>
                      <option value="CHANGE_ORDER">Change Order</option>
                    </select>

                    {/* Status Filter */}
                    <select
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">All Statuses</option>
                      {WORKFLOW_STAGES.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search ref, title, type..."
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3">Ref & Stage</th>
                        <th className="p-3">Title & Scope Change</th>
                        <th className="p-3">Type & Reason</th>
                        <th className="p-3">Dates</th>
                        <th className="p-3 text-right">Proposed (GH₵)</th>
                        <th className="p-3 text-right">Approved (GH₵)</th>
                        <th className="p-3 text-center">Time</th>
                        <th className="p-3 text-center">Workflow Status</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredVariations.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-10 text-center text-slate-400 italic">
                            {variations.length === 0
                              ? "No variation requests recorded for this project yet. Click 'New Change Request' to create one."
                              : "No variations match your filter criteria."}
                          </td>
                        </tr>
                      ) : (
                        filteredVariations.map(v => {
                          const stageInfo = WORKFLOW_STAGES.find(s => s.key === v.status) || WORKFLOW_STAGES[0];
                          return (
                            <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3">
                                <span className="font-mono font-bold text-brand-600 dark:text-brand-400 block">
                                  {v.variation_no}
                                </span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                                  v.document_stage === "CHANGE_ORDER" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50" : "bg-blue-100 text-blue-700 dark:bg-blue-950/50"
                                }`}>
                                  {v.document_stage === "CHANGE_ORDER" ? "Change Order" : "Variation Request"}
                                </span>
                              </td>
                              <td className="p-3 max-w-xs">
                                <div className="font-bold text-slate-900 dark:text-white truncate">{v.title}</div>
                                <div className="text-[11px] text-slate-400 truncate mt-0.5">{v.description || "—"}</div>
                              </td>
                              <td className="p-3">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 block">{v.change_type}</span>
                                <span className="text-[10px] text-slate-400">{v.reason}</span>
                              </td>
                              <td className="p-3 font-mono text-slate-500 text-[11px]">
                                {v.date_raised ? String(v.date_raised).split("T")[0] : "—"}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                {Number(v.contractor_proposed_amount || v.cost_impact || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {v.status === "APPROVED" || v.status === "COMPLETED"
                                  ? Number(v.amount_approved || v.cost_impact || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                  : "—"}
                              </td>
                              <td className="p-3 text-center font-mono font-bold">
                                +{v.schedule_impact_days || 0}d
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${stageInfo.cls}`}>
                                  {stageInfo.label}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditForm(v.id)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300"
                                    title="Open Full Form"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => handlePrintDocument(v)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300"
                                    title="Print Change Order"
                                  >
                                    <Printer size={14} />
                                  </button>
                                  <ListAttachmentIconButton
                                    onClick={() => {
                                      setActiveDocId(v.id);
                                      setShowAttachModal(true);
                                    }}
                                    title="Attachments (Cloudinary)"
                                  />
                                  {v.status !== "APPROVED" && v.status !== "COMPLETED" && (
                                    <button
                                      onClick={() => openWorkflowModal(v, v.status === "DRAFT" ? "SUBMITTED" : "APPROVED")}
                                      className="px-2 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 text-[11px] font-bold"
                                    >
                                      {v.status === "DRAFT" ? "Submit" : "Review"}
                                    </button>
                                  )}
                                  {v.status === "DRAFT" && (
                                    <button
                                      onClick={() => handleDeleteVariation(v.id)}
                                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                                      title="Delete Draft"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: COMPREHENSIVE SINGLE FORM VIEW (6 LOGICAL SECTIONS) */}
      {/* ========================================================================= */}
      {viewMode === "FORM" && (
        <div className="space-y-6">
          {/* Form Top Control Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                    {form.variation_no || "VAR-DRAFT"}
                  </span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {selectedProject?.project_name} ({selectedProject?.project_code})
                  </span>
                  {/* Status Badge */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                    Stage {form.workflow_stage || 1}: {form.status}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {form.id ? `Edit Variation & Change Order` : `Create Project Change Request`}
                </h2>
              </div>

              {/* Form Action Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewMode("REGISTER")}
                  className="btn btn-secondary text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintDocument()}
                  className="btn btn-secondary text-xs py-2 inline-flex items-center gap-1.5"
                >
                  <Printer size={15} /> Print Document
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveForm("DRAFT")}
                  disabled={savingForm}
                  className="btn btn-secondary text-xs py-2 inline-flex items-center gap-1.5"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveForm("SUBMITTED")}
                  disabled={savingForm}
                  className="btn btn-primary text-xs py-2 inline-flex items-center gap-1.5"
                >
                  <CheckCircle size={15} /> Submit for Review
                </button>
              </div>
            </div>

            {/* 7-Stage Workflow Progress Stepper */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Change Order Approval Lifecycle:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
                {WORKFLOW_STAGES.filter(s => s.stage > 0).map((st) => {
                  const isCurrent = form.status === st.key;
                  const isPassed = (form.workflow_stage || 1) >= st.stage;
                  return (
                    <div
                      key={st.stage}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold transition-all ${
                        isCurrent
                          ? "bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 shadow-sm ring-2 ring-brand-500/20"
                          : isPassed
                          ? "bg-white border-emerald-400 text-emerald-700 dark:bg-slate-900 dark:text-emerald-400"
                          : "bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800"
                      }`}
                    >
                      <span className="block text-[9px] font-black uppercase opacity-60">Step {st.stage}</span>
                      <span className="truncate block mt-0.5">{st.label.split(" / ")[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 1. CHANGE IDENTIFICATION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Building size={16} className="text-brand-600" /> Section 1. Change Identification
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Project details, contractual stage, type, and origin</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Change Reference Number
                </label>
                <input
                  type="text"
                  className="input w-full font-mono font-bold text-brand-600"
                  value={form.variation_no}
                  onChange={e => setForm({ ...form, variation_no: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Document Stage <span className="text-rose-500">*</span>
                </label>
                <select
                  className="input w-full font-semibold"
                  value={form.document_stage}
                  onChange={e => setForm({ ...form, document_stage: e.target.value })}
                >
                  <option value="VARIATION_REQUEST">Variation Request</option>
                  <option value="CHANGE_ORDER">Approved Change Order</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Project <span className="text-rose-500">*</span>
                </label>
                <select
                  className="input w-full font-semibold"
                  value={form.project_id}
                  onChange={e => handleFormProjectChange(e.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Change Type <span className="text-rose-500">*</span>
                </label>
                <select
                  className="input w-full font-semibold"
                  value={form.change_type}
                  onChange={e => setForm({ ...form, change_type: e.target.value })}
                >
                  {CHANGE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for Change <span className="text-rose-500">*</span>
                </label>
                <select
                  className="input w-full font-semibold"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                >
                  {REASON_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Priority
                </label>
                <select
                  className="input w-full font-semibold"
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Related Contract / Agreement Ref
                  </label>
                  {activeContractsList.length > 0 && (
                    <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">
                      {activeContractsList.length} active
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    list="active-contracts-list"
                    placeholder="Select active contract or type ref..."
                    className="input w-full font-mono pr-7"
                    value={form.contract_ref}
                    onChange={e => handleSelectContract(e.target.value)}
                  />
                  <datalist id="active-contracts-list">
                    {activeContractsList.map((c, i) => (
                      <option key={i} value={c.ref}>
                        {c.label}
                      </option>
                    ))}
                  </datalist>
                  {form.contract_ref && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, contract_ref: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title="Clear"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                {currentProjectContracts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {currentProjectContracts.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectContract(c.ref)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          form.contract_ref === c.ref
                            ? "bg-brand-50 border-brand-300 text-brand-700 font-bold dark:bg-brand-950/40 dark:border-brand-700 dark:text-brand-300 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400"
                        }`}
                        title={c.label}
                      >
                        {c.badge}: {c.ref}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Date Raised
                </label>
                <input
                  type="date"
                  className="input w-full font-mono"
                  value={form.date_raised}
                  onChange={e => setForm({ ...form, date_raised: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Requested Effective Date
                </label>
                <input
                  type="date"
                  className="input w-full font-mono"
                  value={form.effective_date}
                  onChange={e => setForm({ ...form, effective_date: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Initiated By / Originator
                </label>
                <select
                  className="input w-full font-semibold"
                  value={form.originator}
                  onChange={e => setForm({ ...form, originator: e.target.value })}
                >
                  <option value="CLIENT">Client / Employer</option>
                  <option value="CONSULTANT">Consultant / Supervising Engineer</option>
                  <option value="CONTRACTOR">Main Contractor</option>
                  <option value="SUBCONTRACTOR">Subcontractor</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Client / Employer Name
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={form.client_name}
                  onChange={e => setForm({ ...form, client_name: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Contractor / Vendor Name
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={form.contractor_name}
                  onChange={e => setForm({ ...form, contractor_name: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-2 text-xs w-full">
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Variation Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dustbin Supply & Installation Scope Expansion"
                className="input w-full font-semibold text-sm"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="pt-2 text-xs w-full">
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Detailed Scope Description & Contractual Basis <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                className="input w-full min-h-[110px] leading-relaxed"
                placeholder="Provide a comprehensive narrative of what work must be added, omitted or modified, contract clause references, and cause for instruction..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          {/* SECTION 2. SCOPE & BOQ CHANGES (REPEATABLE LINE ITEM GRID) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Package size={16} className="text-brand-600" /> Section 2. Scope & BOQ Changes (Line-Item Grid)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Itemized changes preserving original BOQ baseline: additions, modifications, omissions, and replacements
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {projectBOQItems.length > 0 && (
                  <div className="relative group">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <FileSpreadsheet size={14} className="text-brand-600" /> Import BOQ Item ({projectBOQItems.length})
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-80 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 hidden group-hover:block p-1 text-xs">
                      {projectBOQItems.map(bi => (
                        <button
                          key={bi.id}
                          type="button"
                          onClick={() => handleImportBOQItem(bi)}
                          className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex justify-between items-center"
                        >
                          <div>
                            <span className="font-mono font-bold text-brand-600 block">{bi.item_code || "BOQ-ITEM"}</span>
                            <span className="truncate block max-w-[200px] text-slate-600 dark:text-slate-300">{bi.item_description}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-500">GH₵ {Number(bi.unit_rate || 0).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition"
                >
                  <Plus size={14} /> Add Change Item
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Item Code</th>
                    <th className="p-3">Description of Work</th>
                    <th className="p-3 text-center">Action</th>
                    <th className="p-3 text-center">Category</th>
                    <th className="p-3 text-center">UoM</th>
                    <th className="p-3 text-right">Orig Qty & Rate</th>
                    <th className="p-3 text-right">Rev Qty & Prop Rate</th>
                    <th className="p-3 text-right">Qty Diff</th>
                    <th className="p-3 text-right">Cost Impact (GH₵)</th>
                    <th className="p-3">Reason / Spec</th>
                    <th className="p-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                        No changed items added yet. Click "+ Add Change Item" or "Import BOQ Item" to itemize scope additions or omissions.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5">
                          <input
                            type="text"
                            placeholder="e.g. DST-01"
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold w-24"
                            value={it.item_code || ""}
                            onChange={e => handleUpdateLineItem(idx, "item_code", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5 min-w-[200px]">
                          <input
                            type="text"
                            placeholder="Specification of work..."
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium w-full"
                            value={it.item_description || ""}
                            onChange={e => handleUpdateLineItem(idx, "item_description", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <select
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold"
                            value={it.change_action}
                            onChange={e => handleUpdateLineItem(idx, "change_action", e.target.value)}
                          >
                            <option value="ADD">Add (+)</option>
                            <option value="MODIFY">Modify</option>
                            <option value="OMIT">Omit (-)</option>
                            <option value="REPLACE">Replace</option>
                          </select>
                        </td>
                        <td className="p-2.5 text-center">
                          <select
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                            value={it.cost_category}
                            onChange={e => handleUpdateLineItem(idx, "cost_category", e.target.value)}
                          >
                            {COST_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label.split(" ")[0]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5 text-center">
                          <select
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                            value={it.uom}
                            onChange={e => handleUpdateLineItem(idx, "uom", e.target.value)}
                          >
                            {UOM_OPTIONS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5 text-right font-mono text-[11px]">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              disabled={it.change_action === "ADD"}
                              className="w-16 text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5"
                              value={it.original_qty}
                              onChange={e => handleUpdateLineItem(idx, "original_qty", e.target.value)}
                            />
                            <span>×</span>
                            <input
                              type="number"
                              disabled={it.change_action === "ADD"}
                              className="w-16 text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5"
                              value={it.original_rate}
                              onChange={e => handleUpdateLineItem(idx, "original_rate", e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono text-[11px]">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              disabled={it.change_action === "OMIT"}
                              className="w-16 text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 font-bold"
                              value={it.revised_qty}
                              onChange={e => handleUpdateLineItem(idx, "revised_qty", e.target.value)}
                            />
                            <span>×</span>
                            <input
                              type="number"
                              className="w-16 text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 font-bold"
                              value={it.proposed_rate}
                              onChange={e => handleUpdateLineItem(idx, "proposed_rate", e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {Number(it.qty_diff || 0) > 0 ? "+" : ""}{Number(it.qty_diff || 0).toFixed(2)}
                        </td>
                        <td className={`p-2.5 text-right font-mono font-bold ${Number(it.cost_diff || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {Number(it.cost_diff || 0) >= 0 ? "+" : ""}{Number(it.cost_diff || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 min-w-[140px]">
                          <input
                            type="text"
                            placeholder="Reason / justification..."
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs w-full text-[11px]"
                            value={it.reason_and_spec || ""}
                            onChange={e => handleUpdateLineItem(idx, "reason_and_spec", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Scope Items Cost Summary Footer */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-6 font-semibold">
                <span className="text-emerald-600">Additions: +GH₵ {lineItemSummary.additions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-rose-600">Omissions: -GH₵ {lineItemSummary.omissions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Net Line Items Cost Difference:</span>
                <span className="text-base font-black font-mono text-brand-600 dark:text-brand-400">
                  {lineItemSummary.net >= 0 ? "+" : ""}GH₵ {lineItemSummary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 3. FINANCIAL IMPACT & CONTRACT BASELINE */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign size={16} className="text-brand-600" /> Section 3. Financial Impact & Contract Baseline
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Auditable contract sum tracking, pricing breakdown, and funding source reconciliation
                </p>
              </div>
            </div>

            {/* Contract Baseline Preservation Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Original Approved Contract</span>
                <p className="font-mono font-bold text-base text-slate-900 dark:text-white">
                  GH₵ {Number(projectBaseline?.contract_sum || selectedProject?.contract_sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Previously Approved Variations</span>
                <p className="font-mono font-bold text-base text-blue-600">
                  GH₵ {Number(projectBaseline?.previously_approved_variations || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Current Proposed Change</span>
                <p className="font-mono font-bold text-base text-brand-600">
                  GH₵ {Number(form.assessed_amount || form.contractor_proposed_amount || lineItemSummary.net || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Revised Contract Value (If Approved)</span>
                <p className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                  GH₵ {(
                    Number(projectBaseline?.contract_sum || selectedProject?.contract_sum || 0) +
                    Number(projectBaseline?.previously_approved_variations || 0) +
                    Number(form.assessed_amount || form.contractor_proposed_amount || lineItemSummary.net || 0)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Tri-Party Pricing & Breakdown Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Contractor Proposed Price (GH₵)
                </label>
                <input
                  type="number"
                  className="input w-full font-mono font-bold"
                  value={form.contractor_proposed_amount}
                  onChange={e => setForm({ ...form, contractor_proposed_amount: Number(e.target.value) })}
                />
                <span className="text-[10px] text-slate-400">Original price claimed by contractor</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  QS / Cost Controller Assessed Amount (GH₵)
                </label>
                <input
                  type="number"
                  className="input w-full font-mono font-bold text-blue-600"
                  value={form.assessed_amount}
                  onChange={e => setForm({ ...form, assessed_amount: Number(e.target.value) })}
                />
                <span className="text-[10px] text-slate-400">Technical quantity surveyor evaluation</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Final Approved Amount (GH₵)
                </label>
                <input
                  type="number"
                  disabled={form.status !== "APPROVED" && form.status !== "PENDING_AUTHORIZATION"}
                  className="input w-full font-mono font-bold text-emerald-600 disabled:opacity-60"
                  value={form.amount_approved}
                  onChange={e => setForm({ ...form, amount_approved: Number(e.target.value) })}
                />
                <span className="text-[10px] text-slate-400">Authorized change order value</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Funding Source
                </label>
                <select
                  className="input w-full font-semibold"
                  value={form.funding_source}
                  onChange={e => setForm({ ...form, funding_source: e.target.value })}
                >
                  <option value="CLIENT_FUNDED">Client Funded (Contract Increase)</option>
                  <option value="CONTRACTOR_ABSORBED">Contractor Absorbed / Defect Remedy</option>
                  <option value="CONTINGENCY_RESERVE">Contingency Fund Allocation</option>
                  <option value="INSURANCE_CLAIM">Insurance / Third-Party Claim</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Contingency Impact (GH₵)
                </label>
                <input
                  type="number"
                  className="input w-full font-mono"
                  value={form.contingency_impact}
                  onChange={e => setForm({ ...form, contingency_impact: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Overhead & Markup (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Overhead GHS"
                    className="input font-mono"
                    value={form.overhead_cost}
                    onChange={e => setForm({ ...form, overhead_cost: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    placeholder="Markup %"
                    className="input font-mono w-24"
                    value={form.markup_percent}
                    onChange={e => setForm({ ...form, markup_percent: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4. SCHEDULE & DELIVERY IMPACT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={16} className="text-brand-600" /> Section 4. Schedule & Delivery Impact
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Time extension claims, revised completion milestones, and critical path analysis</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Original Project Completion Date
                </label>
                <input
                  type="date"
                  className="input font-mono"
                  value={form.original_completion_date}
                  onChange={e => setForm({ ...form, original_completion_date: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Proposed Extension / Reduction (Calendar Days)
                </label>
                <input
                  type="number"
                  className="input w-full font-mono font-bold text-purple-600"
                  value={form.schedule_impact_days}
                  onChange={e => setForm({ ...form, schedule_impact_days: Number(e.target.value) })}
                />
                <span className="text-[10px] text-slate-400">Positive for extension, negative for acceleration</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Revised Completion Date (If Approved)
                </label>
                <input
                  type="date"
                  className="input w-full font-mono font-bold text-emerald-600"
                  value={form.revised_completion_date}
                  onChange={e => setForm({ ...form, revised_completion_date: e.target.value })}
                />
              </div>
            </div>

            <div className="text-xs pt-1 w-full">
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Affected Tasks, Milestones & Dependencies
              </label>
              <input
                type="text"
                placeholder="e.g. Task 14: Foundation Footing, Milestone 3: Concrete Slab Delivery"
                className="input w-full"
                value={form.affected_tasks}
                onChange={e => setForm({ ...form, affected_tasks: e.target.value })}
              />
              <span className="text-[10px] text-slate-400">Identify work breakdown structure elements on critical path</span>
            </div>
          </div>

          {/* SECTION 5. SUPPORTING INFORMATION & RISK ASSESSMENT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={16} className="text-brand-600" /> Section 5. Supporting Information & Risk Assessment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Attachments, site photographs, contractor quotes, and HSSE implications</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="w-full">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Risk Assessment & Mitigation Measures
                </label>
                <textarea
                  className="input w-full min-h-[90px] leading-relaxed"
                  placeholder="Identify commercial, structural, weather, or supply chain risks and corresponding mitigation actions..."
                  value={form.risk_assessment}
                  onChange={e => setForm({ ...form, risk_assessment: e.target.value })}
                />
              </div>

              <div className="w-full">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Health, Safety, Quality & Environmental (HSSE) Implications
                </label>
                <textarea
                  className="input w-full min-h-[90px] leading-relaxed"
                  placeholder="Special permits required, environmental assessments, hazard controls, or structural testing..."
                  value={form.hsq_implications}
                  onChange={e => setForm({ ...form, hsq_implications: e.target.value })}
                />
              </div>
            </div>

            {/* Supporting Documents File List with Cloudinary Upload */}
            <div className="pt-2 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Supporting Documents Attached ({form.supporting_documents?.length || 0})
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
                    <Cloud size={11} /> Cloudinary Storage
                  </span>
                </span>
                {form.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDocId(form.id);
                      setShowAttachModal(true);
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1"
                  >
                    <FolderArchive size={13} /> Manage in Modal
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 flex-shrink-0">
                    <Cloud size={20} />
                  </div>
                  <div>
                    <span className="font-bold block text-slate-800 dark:text-slate-200">
                      Revised Drawings, Client Instructions, Supplier Quotes & Inspection Reports
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Upload directly to Cloudinary • PDF, DWG, XLSX, DOCX, PNG, JPG (Max 25MB)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".pdf,.dwg,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.zip"
                    onChange={handleCloudinaryUpload}
                    disabled={uploadingDoc}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
                  >
                    {uploadingDoc ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Uploading to Cloudinary...
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Upload Evidence (Cloudinary)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {form.supporting_documents && form.supporting_documents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3">
                  {form.supporting_documents.map((doc, idx) => {
                    const isCloudinary = Boolean(doc.is_cloudinary || (doc.url && doc.url.includes("cloudinary.com")));
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-xs"
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${isCloudinary ? "bg-sky-50 text-sky-600 dark:bg-sky-950/50" : "bg-slate-100 text-slate-600"}`}>
                            {isCloudinary ? <Cloud size={14} /> : <Paperclip size={14} />}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold block truncate text-slate-800 dark:text-slate-200" title={doc.name}>
                              {doc.name || `Attachment_${idx + 1}`}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : "Document"} • {isCloudinary ? "Cloudinary" : "Stored"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="View Document"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setForm(f => ({
                                ...f,
                                supporting_documents: f.supporting_documents.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Remove Attachment"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 6. REVIEW, WORKFLOW APPROVALS & AUDIT TRAIL */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} className="text-brand-600" /> Section 6. Review, Workflow Approvals & Audit Trail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Formal reviews, electronic acceptance, and downstream ERP synchronization</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="w-full">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Project Manager Review Comments
                </label>
                <textarea
                  className="input w-full min-h-[85px] leading-relaxed"
                  placeholder="PM technical verification..."
                  value={form.pm_review_comments}
                  onChange={e => setForm({ ...form, pm_review_comments: e.target.value })}
                />
              </div>

              <div className="w-full">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Lead Quantity Surveyor Assessment
                </label>
                <textarea
                  className="input w-full min-h-[85px] leading-relaxed"
                  placeholder="QS commercial & rate build-up review..."
                  value={form.qs_review_comments}
                  onChange={e => setForm({ ...form, qs_review_comments: e.target.value })}
                />
              </div>

              <div className="w-full">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Finance / Budget-Holder Review
                </label>
                <textarea
                  className="input w-full min-h-[85px] leading-relaxed"
                  placeholder="Budget allocation and funding verification..."
                  value={form.finance_review_comments}
                  onChange={e => setForm({ ...form, finance_review_comments: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="w-full">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Client Approval Reference / Formal Letter Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. CLI-AUTH-2026-092"
                  className="input w-full font-mono"
                  value={form.client_approval_ref}
                  onChange={e => setForm({ ...form, client_approval_ref: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Current Workflow Stage Action
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveForm("SUBMITTED")}
                    className="btn btn-secondary text-xs flex-1"
                  >
                    Submit for Review
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVariation(form);
                      setTargetStatus("APPROVED");
                      setWorkflowModalOpen(true);
                    }}
                    className="btn btn-primary text-xs flex-1"
                  >
                    Approve Change Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADVANCE WORKFLOW / APPROVE VARIATION */}
      {/* ========================================================================= */}
      <ProjectModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        title={targetStatus === "APPROVED" ? "Approve Variation & Issue Change Order" : "Advance Variation Workflow"}
        subtitle={`Determine decision and downstream ERP impacts for ${selectedVariation?.variation_no || ""}`}
        icon={targetStatus === "APPROVED" ? CheckCircle : Sliders}
        onSubmit={handleAdvanceWorkflow}
        submitLabel={targetStatus === "APPROVED" ? "Issue Approved Change Order" : "Confirm Transition"}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold block text-slate-800 dark:text-slate-200">
              {selectedVariation?.title}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Ref: {selectedVariation?.variation_no} | Initiator: {selectedVariation?.originator || "CLIENT"}
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Target Workflow Status <span className="text-rose-500">*</span>
            </label>
            <select
              className="input font-bold"
              value={targetStatus}
              onChange={e => setTargetStatus(e.target.value)}
            >
              <option value="SUBMITTED">Submitted for Review</option>
              <option value="UNDER_ASSESSMENT">Under Technical / Commercial Assessment</option>
              <option value="PENDING_AUTHORIZATION">Pending Authorization</option>
              <option value="APPROVED">Approved / Change Order Issued</option>
              <option value="IN_IMPLEMENTATION">In Implementation</option>
              <option value="COMPLETED">Completed / Closed</option>
              <option value="RETURNED">Returned for Revision</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {targetStatus === "APPROVED" && (
            <div className="space-y-4 p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Final Approved Amount (GH₵) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    className="input font-mono font-bold text-emerald-600"
                    value={workflowApprovalData.amount_approved}
                    onChange={e => setWorkflowApprovalData({ ...workflowApprovalData, amount_approved: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Approved Schedule Impact (Days)
                  </label>
                  <input
                    type="number"
                    className="input font-mono font-bold"
                    value={workflowApprovalData.schedule_impact_days}
                    onChange={e => setWorkflowApprovalData({ ...workflowApprovalData, schedule_impact_days: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Downstream ERP Rules Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-emerald-200/80 dark:border-emerald-800 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="rounded text-brand-600"
                    checked={workflowApprovalData.update_contract_sum}
                    onChange={e => setWorkflowApprovalData({ ...workflowApprovalData, update_contract_sum: e.target.checked })}
                  />
                  <span>Update Revised Contract Sum in Project Management (Client-Funded Change)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="rounded text-brand-600"
                    checked={workflowApprovalData.update_project_budget}
                    onChange={e => setWorkflowApprovalData({ ...workflowApprovalData, update_project_budget: e.target.checked })}
                  />
                  <span>Update Internal Project Baseline Budget (Allocated Spending Authority)</span>
                </label>

                {workflowApprovalData.update_project_budget && (
                  <div className="pl-6 pt-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Internal Budget Adjustment Amount (GH₵):</label>
                    <input
                      type="number"
                      className="input font-mono w-48 text-xs py-1"
                      value={workflowApprovalData.budget_adjustment_amount}
                      onChange={e => setWorkflowApprovalData({ ...workflowApprovalData, budget_adjustment_amount: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Reviewer Decision / Technical Comments
            </label>
            <textarea
              className="input w-full min-h-[85px] leading-relaxed"
              placeholder="State reasons for approval, conditions, or rejection grounds..."
              value={workflowComments}
              onChange={e => setWorkflowComments(e.target.value)}
            />
          </div>
        </div>
      </ProjectModal>

      {/* ========================================================================= */}
      {/* PRINT PREVIEW MODAL */}
      {/* ========================================================================= */}
      <PrintPreviewModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        htmlContent={printHtml}
        title={`Official Document - ${form.variation_no || "Change Order"}`}
        onDownloadPdf={handleDownloadPdf}
        downloading={downloadingPdf}
      />

      {/* ========================================================================= */}
      {/* CLOUDINARY ATTACHMENTS MODAL (PROCUREMENT MODULE PATTERN) */}
      {/* ========================================================================= */}
      <DocumentAttachmentsModal
        open={showAttachModal}
        onClose={() => {
          setShowAttachModal(false);
          setActiveDocId(null);
        }}
        docType="variation"
        docId={activeDocId}
        allowPreview={true}
      />
    </div>
  );
}
