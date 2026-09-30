/**
 * @fileoverview DocumentTemplatesPage component.
 * Provides functionality for DocumentTemplatesPage.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "api/client";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import { toast } from "react-toastify";
import { Select } from "antd";
import PrintPreviewModal from "../../../../components/PrintPreviewModal.jsx";

const DOC_TYPES = [
  { value: "general-template", label: "Report Header" },
  { value: "sales-order", label: "Sales Order" },
  { value: "invoice", label: "Invoice" },
  { value: "quotation", label: "Quotation" },
  { value: "delivery-note", label: "Delivery Note" },
  { value: "salary-slip", label: "Salary Slip" },
  { value: "payment-voucher", label: "Payment Voucher" },
  { value: "receipt-voucher", label: "Receipt Voucher" },
  { value: "bank-reconciliation-report", label: "Bank Reconciliation Report" },
  { value: "purchase-order", label: "Purchase Order" },
  { value: "grn", label: "Goods Receipt Note" },
  { value: "purchase-bill", label: "Purchase Bill" },
  { value: "direct-purchase", label: "Direct Purchase" },
];

// All available feature/page names across the system
// Grouped by module so users can easily identify which feature a template maps to
const FEATURE_PAGES = [
  {
    "label": "ADMINISTRATION",
    "options": [
      {
        "label": "ExceptionalPermissionsList",
        "value": "exceptional-permissions-list"
      },
      {
        "label": "BranchList",
        "value": "branch-list"
      },
      {
        "label": "CompanyList",
        "value": "company-list"
      },
      {
        "label": "UserList",
        "value": "user-list"
      },
      {
        "label": "WorkflowList",
        "value": "workflow-list"
      }
    ]
  },
  {
    "label": "BUSINESS-INTELLIGENCE",
    "options": [
      {
        "label": "DashboardList",
        "value": "dashboard-list"
      }
    ]
  },
  {
    "label": "FINANCE",
    "options": [
      {
        "label": "BankReconciliationList",
        "value": "bank-reconciliation-list"
      },
      {
        "label": "PdcPostingsList",
        "value": "pdc-postings-list"
      },
      {
        "label": "JournalVoucherList",
        "value": "journal-voucher-list"
      },
      {
        "label": "ContraVoucherList",
        "value": "contra-voucher-list"
      },
      {
        "label": "CreditNoteList",
        "value": "credit-note-list"
      },
      {
        "label": "DebitNoteList",
        "value": "debit-note-list"
      },
      {
        "label": "JournalVoucherList",
        "value": "journal-voucher-list"
      },
      {
        "label": "PaymentVoucherList",
        "value": "payment-voucher-list"
      },
      {
        "label": "PurchaseVoucherList",
        "value": "purchase-voucher-list"
      },
      {
        "label": "ReceiptVoucherList",
        "value": "receipt-voucher-list"
      },
      {
        "label": "SalesVoucherList",
        "value": "sales-voucher-list"
      },
      {
        "label": "VoucherListPage",
        "value": "voucher-list"
      }
    ]
  },
  {
    "label": "HUMAN-RESOURCES",
    "options": [
      {
        "label": "AllowanceList",
        "value": "allowance-list"
      },
      {
        "label": "AttendanceList",
        "value": "attendance-list"
      },
      {
        "label": "PolicyList",
        "value": "policy-list"
      },
      {
        "label": "EmployeeList",
        "value": "employee-list"
      },
      {
        "label": "LeaveApplicationsList",
        "value": "leave-applications-list"
      },
      {
        "label": "LeaveSetupList",
        "value": "leave-setup-list"
      },
      {
        "label": "LoanList",
        "value": "loan-list"
      },
      {
        "label": "MedicalPolicyList",
        "value": "medical-policy-list"
      },
      {
        "label": "PayslipList",
        "value": "payslip-list"
      },
      {
        "label": "PromotionList",
        "value": "promotion-list"
      },
      {
        "label": "CandidatesList",
        "value": "candidates-list"
      },
      {
        "label": "InterviewsList",
        "value": "interviews-list"
      },
      {
        "label": "OffersList",
        "value": "offers-list"
      },
      {
        "label": "RequisitionList",
        "value": "requisition-list"
      },
      {
        "label": "SalaryConfigList",
        "value": "salary-config-list"
      },
      {
        "label": "ShiftList",
        "value": "shift-list"
      },
      {
        "label": "TaxConfigList",
        "value": "tax-config-list"
      },
      {
        "label": "TrainingList",
        "value": "training-list"
      }
    ]
  },
  {
    "label": "INVENTORY",
    "options": [
      {
        "label": "GRNImportList",
        "value": "grnimport-list"
      },
      {
        "label": "GRNLocalList",
        "value": "grnlocal-list"
      },
      {
        "label": "IssueToRequirementList",
        "value": "issue-to-requirement-list"
      },
      {
        "label": "ItemBatchesList",
        "value": "item-batches-list"
      },
      {
        "label": "ItemGroupsList",
        "value": "item-groups-list"
      },
      {
        "label": "ItemsList",
        "value": "items-list"
      },
      {
        "label": "MaterialRequisitionList",
        "value": "material-requisition-list"
      },
      {
        "label": "PurchaseReturnList",
        "value": "purchase-return-list"
      },
      {
        "label": "ReturnToStoresList",
        "value": "return-to-stores-list"
      },
      {
        "label": "ServiceConfirmationsList",
        "value": "service-confirmations-list"
      },
      {
        "label": "StockAdjustmentList",
        "value": "stock-adjustment-list"
      },
      {
        "label": "StockTakeList",
        "value": "stock-take-list"
      },
      {
        "label": "StockTransferList",
        "value": "stock-transfer-list"
      },
      {
        "label": "StockUpdationList",
        "value": "stock-updation-list"
      },
      {
        "label": "StockVerificationList",
        "value": "stock-verification-list"
      },
      {
        "label": "TransferAcceptanceList",
        "value": "transfer-acceptance-list"
      },
      {
        "label": "UnitConversionsList",
        "value": "unit-conversions-list"
      },
      {
        "label": "WarehousesList",
        "value": "warehouses-list"
      }
    ]
  },
  {
    "label": "MAINTENANCE",
    "options": [
      {
        "label": "AssetList",
        "value": "asset-list"
      },

      {
        "label": "MaintenanceContractList",
        "value": "maintenance-contract-list"
      },
      {
        "label": "EquipmentList",
        "value": "equipment-list"
      },
      {
        "label": "JobExecutionList",
        "value": "job-execution-list"
      },
      {
        "label": "MaintenanceJobOrdersList",
        "value": "maintenance-job-orders-list"
      },
      {
        "label": "MaintenanceBillList",
        "value": "maintenance-bill-list"
      },
      {
        "label": "MaintenanceRequestsList",
        "value": "maintenance-requests-list"
      },
      {
        "label": "PmScheduleList",
        "value": "pm-schedule-list"
      },
      {
        "label": "MaintenanceRFQList",
        "value": "maintenance-rfqlist"
      },
      {
        "label": "MaintenanceRosterList",
        "value": "maintenance-roster-list"
      },
      {
        "label": "MaintenanceScheduleList",
        "value": "maintenance-schedule-list"
      },
      {
        "label": "SupplierQuotationsList",
        "value": "supplier-quotations-list"
      },
      {
        "label": "MaintenanceWorkOrderList",
        "value": "maintenance-work-order-list"
      }
    ]
  },
  {
    "label": "POS",
    "options": [
      {
        "label": "PosInvoiceList",
        "value": "pos-invoice-list"
      },
      {
        "label": "CustomerAccounts",
        "value": "pos-customer-history"
      },
      {
        "label": "PosReturns",
        "value": "pos-returns"
      },
      {
        "label": "PosReports",
        "value": "pos-reports"
      },
      {
        "label": "OnHoldSales",
        "value": "pos-on-hold"
      }
    ]
  },
  {
    "label": "PRODUCTION",
    "options": [
      {
        "label": "BomList",
        "value": "bom-list"
      },
      {
        "label": "JobCardList",
        "value": "job-card-list"
      },
      {
        "label": "MaterialReceiptList",
        "value": "material-receipt-list"
      },
      {
        "label": "MaterialRequisitionList",
        "value": "material-requisition-list"
      },
      {
        "label": "ProductionTransferList",
        "value": "production-transfer-list"
      },
      {
        "label": "StockJournalList",
        "value": "stock-journal-list"
      },
      {
        "label": "DailyPlanList",
        "value": "daily-plan-list"
      },
      {
        "label": "RoutingList",
        "value": "routing-list"
      },
      {
        "label": "MachineList",
        "value": "machine-list"
      },
      {
        "label": "ProcessList",
        "value": "process-list"
      },
      {
        "label": "ShiftList",
        "value": "shift-list"
      },
      {
        "label": "WorkOrderList",
        "value": "work-order-list"
      }
    ]
  },
  {
    "label": "PROJECT-MANAGEMENT",
    "options": [
      {
        "label": "ExpenseList",
        "value": "expense-list"
      },
      {
        "label": "MaterialReceiptList",
        "value": "material-receipt-list"
      },
      {
        "label": "MaterialRequisitionList",
        "value": "material-requisition-list"
      },
      {
        "label": "MaterialUtilizationList",
        "value": "material-utilization-list"
      },
      {
        "label": "ProjectList",
        "value": "project-list"
      },
      {
        "label": "TaskList",
        "value": "task-list"
      },
      {
        "label": "TimesheetList",
        "value": "timesheet-list"
      }
    ]
  },
  {
    "label": "PURCHASE",
    "options": [
      {
        "label": "DirectPurchaseList",
        "value": "direct-purchase-list"
      },
      {
        "label": "GeneralRequisitionList",
        "value": "general-requisition-list"
      },
      {
        "label": "PortClearancesList",
        "value": "port-clearances-list"
      },
      {
        "label": "PurchaseBillsList",
        "value": "purchase-bills-list"
      },
      {
        "label": "PurchaseOrdersImportList",
        "value": "purchase-orders-import-list"
      },
      {
        "label": "PurchaseOrdersLocalList",
        "value": "purchase-orders-local-list"
      },
      {
        "label": "RequestForQuotationList",
        "value": "request-for-quotation-list"
      },
      {
        "label": "ShippingAdviceList",
        "value": "shipping-advice-list"
      },
      {
        "label": "SupplierQuotationsList",
        "value": "supplier-quotations-list"
      },
      {
        "label": "SuppliersList",
        "value": "suppliers-list"
      }
    ]
  },
  {
    "label": "SALES",
    "options": [
      {
        "label": "CustomerCreditList",
        "value": "customer-credit-list"
      },
      {
        "label": "CustomerList",
        "value": "customer-list"
      },
      {
        "label": "DeliveryList",
        "value": "delivery-list"
      },
      {
        "label": "DiscountSchemeList",
        "value": "discount-scheme-list"
      },
      {
        "label": "InvoiceList",
        "value": "invoice-list"
      },
      {
        "label": "PotentialCustomerList",
        "value": "potential-customer-list"
      },
      {
        "label": "QuotationList",
        "value": "quotation-list"
      },
      {
        "label": "SalesReturnList",
        "value": "sales-return-list"
      },
      {
        "label": "SalesOrderList",
        "value": "sales-order-list"
      }
    ]
  },
  {
    "label": "SERVICE-MANAGEMENT",
    "options": [
      {
        "label": "ServiceBillsList",
        "value": "service-bills-list"
      },
      {
        "label": "ServiceConfirmationsList",
        "value": "service-confirmations-list"
      },
      {
        "label": "ServiceExecutionsList",
        "value": "service-executions-list"
      },
      {
        "label": "ServiceOrdersList",
        "value": "service-orders-list"
      },
      {
        "label": "ServiceRequestsList",
        "value": "service-requests-list"
      },
      {
        "label": "VisitorsLogList",
        "value": "visitors-log-list"
      }
    ]
  }
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DocumentTemplatesPage() {
  const [searchParams] = useSearchParams();
  const initialType = useMemo(() => {
    const t = String(searchParams.get("type") || "").trim();
    const match = DOC_TYPES.find((d) => d.value === t);
    return match ? match.value : DOC_TYPES[0].value;
  }, [searchParams]);
  const [docType, setDocType] = useState(initialType);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    feature_names: [],
    html_content: "",
    is_default: false,
    header_logo_url: "",
    header_name: "",
    header_address: "",
    header_address2: "",
    header_phone: "",
    header_email: "",
    header_website: "",
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [docType]);

  async function loadTemplates() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/templates/${docType}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setTemplates(items);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setEditing(null);
    setForm({
      name: "",
      feature_names: [],
      html_content: "",
      is_default: false,
      header_logo_url: "",
      header_name: "",
      header_address: "",
      header_address2: "",
      header_phone: "",
      header_email: "",
      header_website: "",
    });
  }

  function startEdit(t) {
    setEditing(t);
    setForm({
      name: String(t.name || ""),
      feature_names: Array.isArray(t.feature_names) ? t.feature_names : (t.feature_names ? (typeof t.feature_names === "string" ? JSON.parse(t.feature_names) : t.feature_names) : ((t.feature_names && t.feature_names.length > 0) || t.feature_name ? [t.feature_name] : [])),
      html_content: "",
      is_default: Number(t.is_default) === 1,
      header_logo_url: "",
      header_name: "",
      header_address: "",
      header_address2: "",
      header_phone: "",
      header_email: "",
      header_website: "",
    });
    setFormLoading(true);
    api
      .get(`/templates/item/${t.id}`)
      .then((res) => {
        const item = res.data?.item || {};
        setForm((p) => ({
          ...p,
          html_content: String(item.html_content || ""),
          feature_names: Array.isArray(item.feature_names) ? item.feature_names : (item.feature_names ? (typeof item.feature_names === "string" ? JSON.parse(item.feature_names) : item.feature_names) : (item.feature_name ? [item.feature_name] : [])),
          header_logo_url: String(item.header_logo_url || ""),
          header_name: String(item.header_name || ""),
          header_address: String(item.header_address || ""),
          header_address2: String(item.header_address2 || ""),
          header_phone: String(item.header_phone || ""),
          header_email: String(item.header_email || ""),
          header_website: String(item.header_website || ""),
        }));
      })
      .catch((err) => {
        toast.error("Failed to fetch template details");
      })
      .finally(() => {
        setFormLoading(false);
      });
  }

  async function save() {
    try {
      const name = String(form.name || "").trim();
      const content = String(form.html_content || "").trim();
      if (!name || !content) {
        toast.info("Enter name and HTML content");
        return;
      }
      if (!editing) {
        const res = await api.post(`/templates`, {
          name,
          document_type: docType,
          feature_names: form.feature_names || [],
          html_content: content,
          is_default: form.is_default ? 1 : 0,
          header_logo_url: form.header_logo_url || "",
          header_name: form.header_name || "",
          header_address: form.header_address || "",
          header_address2: form.header_address2 || "",
          header_phone: form.header_phone || "",
          header_email: form.header_email || "",
          header_website: form.header_website || "",
        });
        toast.success("Template created");
      } else {
        await api.put(`/templates/${editing.id}`, {
          name,
          feature_names: form.feature_names || [],
          html_content: content,
          is_default: form.is_default ? 1 : 0,
          header_logo_url: form.header_logo_url || "",
          header_name: form.header_name || "",
          header_address: form.header_address || "",
          header_address2: form.header_address2 || "",
          header_phone: form.header_phone || "",
          header_email: form.header_email || "",
          header_website: form.header_website || "",
        });
        toast.success("Template updated");
      }
      await loadTemplates();
      startNew();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    }
  }

  async function setDefault(t) {
    try {
      await api.put(`/templates/${t.id}`, {
        name: t.name,
        html_content: t.html_content || "",
        is_default: 1,
      });
      toast.success("Default set");
      await loadTemplates();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to set default");
    }
  }

  async function remove(t) {
    try {
      await api.delete(`/templates/${t.id}`);
      toast.success("Template deleted");
      await loadTemplates();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete");
    }
  }

  async function openPreview(t) {
    try {
      const idNum = Number(sampleId);
      const res =
        !Number.isFinite(idNum) || idNum <= 0
          ? await api.post(`/documents/${docType}/preview`, {
              format: "html",
            })
          : await api.post(`/documents/${docType}/${idNum}/render`, {
              format: "html",
            });
      setPreviewHtml(String(res.data || ""));
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to render");
    }
  }

  async function downloadPdf() {
    try {
      setDownloading(true);
      const idNum = Number(sampleId);
      const isSample = !Number.isFinite(idNum) || idNum <= 0;
      const endpointUrl = isSample
        ? `/documents/${docType}/preview`
        : `/documents/${docType}/${idNum}/render`;

      const resp = await api.post(
        endpointUrl,
        { format: "html" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const fileName = `${docType}-${!isSample ? idNum : "preview"}.pdf`;
      await renderHtmlToPdf(html, fileName);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to download");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Settings
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Document Templates
        </h1>
        <p className="text-sm mt-1">
          Create, edit, preview, and set default templates
        </p>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex items-center gap-3">
            <label className="label">Document Type</label>
            <select
              className="input w-64"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="number"
                className="input w-40"
                placeholder="Sample ID"
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
              />
              <button
                className="btn-outline"
                disabled={loading}
                onClick={() => loadTemplates()}
              >
                Refresh
              </button>
              <button className="btn-success" onClick={startNew}>
                + New Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {error ? (
                <div className="text-sm text-red-600 mb-3">{error}</div>
              ) : null}
              <div className="overflow-auto border rounded">
                <table className="min-w-full">
                  <thead className="text-black">
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-black">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-black">
                        Feature
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-black">
                        Default
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-black">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-2 text-sm">{t.name}</td>
                        <td className="px-3 py-2 text-sm">
                          {(t.feature_names && t.feature_names.length > 0) || t.feature_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                              {(() => { const names = Array.isArray(t.feature_names) ? t.feature_names : (t.feature_names ? (typeof t.feature_names === "string" ? JSON.parse(t.feature_names) : t.feature_names) : (t.feature_name ? [t.feature_name] : [])); const allOpts = FEATURE_PAGES.flatMap(g => g.options); return names.map(n => allOpts.find(o => o.value === n)?.label || n).join(", "); })()}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {Number(t.is_default) === 1 ? "Yes" : "No"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn-outline"
                              onClick={() => startEdit(t)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-brand hover:text-brand-600 text-xs font-medium"
                              onClick={() => openPreview(t)}
                            >
                              Preview
                            </button>
                            <button
                              className="text-brand hover:text-brand-600 text-xs font-medium ml-2"
                              disabled={downloading}
                              onClick={() => {
                                setSampleId(String(t.id));
                                downloadPdf();
                              }}
                            >
                              PDF
                            </button>
                            {Number(t.is_default) !== 1 ? (
                              <button
                                className="btn-primary"
                                onClick={() => setDefault(t)}
                              >
                                Set Default
                              </button>
                            ) : null}
                            {Number(t.is_default) !== 1 ? (
                              <button
                                className="btn-danger"
                                onClick={() => remove(t)}
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!templates.length ? (
                      <tr>
                        <td
                          className="px-3 py-3 text-sm text-slate-500"
                          colSpan={4}
                        >
                          No templates for this type
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="relative">
              {formLoading && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Loading Template...
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Name</label>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Feature / Page Name</label>
                    <Select
  mode="multiple"
  style={{ width: '100%' }}
  placeholder="-- Not linked to any page --"
  value={form.feature_names}
  onChange={(val) => setForm((p) => ({ ...p, feature_names: val }))}
  options={FEATURE_PAGES}
/>
                    <div className="text-xs text-slate-500 mt-1">
                      When a page's Print/PDF button is clicked, this template will be used if linked here.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Header Company Name</label>
                    <input
                      className="input"
                      value={form.header_name}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Phone</label>
                    <input
                      className="input"
                      value={form.header_phone}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Address</label>
                    <input
                      className="input"
                      value={form.header_address}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_address: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Address 2</label>
                    <input
                      className="input"
                      value={form.header_address2}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_address2: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Email</label>
                    <input
                      className="input"
                      value={form.header_email}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Website</label>
                    <input
                      className="input"
                      value={form.header_website}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_website: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Header Logo URL</label>
                    <input
                      className="input"
                      placeholder="/api/admin/companies/{id}/logo"
                      value={form.header_logo_url}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_logo_url: e.target.value,
                        }))
                      }
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      Omit to use the company logo automatically
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="label">HTML Content</label>
                  <textarea
                    className="input min-h-[280px] w-full"
                    value={form.html_content}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, html_content: e.target.value }))
                    }
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Use placeholders like {"{{company.name}}"} and loops like{" "}
                    {"{{#each sales_order.items}}"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="default"
                    type="checkbox"
                    className="w-4 h-4"
                    checked={form.is_default}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, is_default: e.target.checked }))
                    }
                  />
                  <label htmlFor="default" className="label">
                    Set as default
                  </label>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={save}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        html={previewHtml}
        downloading={downloading}
        onDownload={downloadPdf}
      />
    </div>
  );
}

function getSampleTemplate(type) {
  const commonHead = `
<style>
  :root { --text: #000; }
  body { font-family: Arial, sans-serif; color: var(--text); font-size: 11px; margin: 0; padding: 0; }
  .doc { width: 19cm; margin: 0 auto; padding: 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .logo { height: 90px; object-fit: contain; }
  .company { font-size: 10px; line-height: 1.4; text-align: right; }
  .company .name { font-weight: bold; font-size: 18px; margin-bottom: 4px; }
  .titlebar { display: flex; align-items: center; justify-content: space-between; margin: 12px 0 16px; }
  .line { flex-grow: 1; border-top: 2px solid #000; height: 0; }
  .title { font-weight: bold; font-size: 16px; margin: 0 16px; white-space: nowrap; }
  .info { display: flex; justify-content: space-between; margin-bottom: 16px; }
  .info-left, .info-mid { flex: 1; }
  .info-right { display: flex; flex-direction: column; align-items: flex-end; width: 100px; }
  .kv { font-size: 11px; line-height: 1.4; display: table; }
  .kv-row { display: table-row; }
  .kv-label { display: table-cell; font-weight: bold; padding-right: 8px; white-space: nowrap; vertical-align: top; }
  .kv-sep { display: table-cell; padding-right: 8px; vertical-align: top; }
  .kv-val { display: table-cell; vertical-align: top; text-transform: uppercase; }
  .qr-box { width: 80px; height: 80px; }
  .qr-box img { width: 100%; height: 100%; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
  thead th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; vertical-align: bottom; }
  thead th.left { text-align: left; }
  thead th.center { text-align: center; }
  tbody td { padding: 4px; border-bottom: 1px dashed #000; vertical-align: top; }
  tbody tr:last-child td { border-bottom: 2px solid #000; }
  td.num { text-align: right; }
  td.center { text-align: center; }
  .bottom-section { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 40px; }
  .bottom-left { flex: 1; padding-right: 16px; }
  .bottom-right { width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #000; }
  .summary-row:last-child { border-bottom: 2px dashed #000; }
  .summary-row .s-label { font-weight: bold; }
  .summary-row .s-val { text-align: right; }
  .footer-prepared { margin-top: 24px; font-size: 11px; padding-top: 8px; border-top: 2px solid #000; }
  .footer-prepared .lbl { font-weight: bold; }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0 !important; padding: 0 !important; }
    .doc { max-width: 19cm; margin: 0 auto; }
  }
</style>`;

  if (type === "sales-order") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <div><img class="logo" src="{{company.logo}}" alt="Logo"/></div>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div>Contact No: {{company.phone}}</div>
      <div>Email: {{company.email}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Sales Order *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="info-left">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Customer Name</div><div class="kv-sep">:</div><div class="kv-val">{{customer.name}}</div></div>
        <div class="kv-row"><div class="kv-label">Address</div><div class="kv-sep">:</div><div class="kv-val">{{customer.address}}<br/>{{customer.address2}}</div></div>
        <div class="kv-row"><div class="kv-label">City</div><div class="kv-sep">:</div><div class="kv-val">{{customer.city}}</div></div>
        <div class="kv-row"><div class="kv-label">State</div><div class="kv-sep">:</div><div class="kv-val">{{customer.state}}</div></div>
        <div class="kv-row"><div class="kv-label">Country</div><div class="kv-sep">:</div><div class="kv-val">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="info-mid">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Order No.</div><div class="kv-sep">:</div><div class="kv-val">{{sales_order.number}}</div></div>
        <div class="kv-row"><div class="kv-label">Order Date</div><div class="kv-sep">:</div><div class="kv-val">{{formatDate sales_order.date}}</div></div>
        <div class="kv-row"><div class="kv-label">Payment Term</div><div class="kv-sep">:</div><div class="kv-val">{{sales_order.payment_terms}}</div></div>
      </div>
    </div>
    <div class="info-right">
      <div class="qr-box"><img src="{{sales_order.qr_code}}" alt="QR"/></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center">Sr.<br/>No.</th>
        <th class="left">Product<br/>Code</th>
        <th class="left">Product Description</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Discount</th>
        <th>Tax</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {{#each sales_order.items}}
      <tr>
        <td class="center">{{inc @index}}</td>
        <td>{{code}}</td>
        <td>{{name}}</td>
        <td class="num">{{quantity}}</td>
        <td class="num">{{price}}</td>
        <td class="num">{{discount}}</td>
        <td class="num">{{tax}}</td>
        <td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="bottom-section">
    <div class="bottom-left">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 40px; margin-bottom: 8px;">
        <div><span style="font-weight: bold;">Item Count :</span> {{sales_order.item_count}}</div>
        <div><span style="font-weight: bold;">Total Quantity :</span> {{sales_order.total_quantity}}</div>
      </div>
      <div style="display: flex; margin-bottom: 16px;">
        <div style="font-weight: bold; white-space: nowrap; margin-right: 8px;">Amount in Words :</div>
        <div style="text-transform: uppercase;">{{sales_order.amount_in_words}}</div>
      </div>
      <div style="margin-bottom: 16px;">
        <span style="font-weight: bold;">Remarks :</span> <br/>
        {{sales_order.remarks}}
      </div>
      <div>
        <span style="font-weight: bold;">Terms and Condition :</span> <br/>
        {{sales_order.terms_and_conditions}}
      </div>
    </div>
    <div class="bottom-right">
      <div class="summary-row"><div class="s-label">Sales Account</div><div class="s-val">{{sales_order.sub_total}}</div></div>
      <div class="summary-row"><div class="s-label">Discount</div><div class="s-val">{{sales_order.discount_amount}}</div></div>
      <div class="summary-row"><div class="s-label">Tax</div><div class="s-val">{{sales_order.tax_amount}}</div></div>
      <div class="summary-row"><div class="s-label">Net Order Value</div><div class="s-val" style="font-weight: bold;">{{sales_order.total}}</div></div>
    </div>
  </div>
  <div class="footer-prepared">
    <span class="lbl">Prepared By :</span> {{prepared_by}}
  </div>
</div>
`;
  }
  if (type === "invoice") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <div><img class="logo" src="{{company.logo}}" alt="Logo"/></div>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div>Contact No: {{company.phone}}</div>
      <div>Email: {{company.email}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Sales Invoice *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="info-left">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Customer Name</div><div class="kv-sep">:</div><div class="kv-val">{{customer.name}}</div></div>
        <div class="kv-row"><div class="kv-label">Address</div><div class="kv-sep">:</div><div class="kv-val">{{customer.address}}<br/>{{customer.address2}}</div></div>
        <div class="kv-row"><div class="kv-label">City</div><div class="kv-sep">:</div><div class="kv-val">{{customer.city}}</div></div>
        <div class="kv-row"><div class="kv-label">State</div><div class="kv-sep">:</div><div class="kv-val">{{customer.state}}</div></div>
        <div class="kv-row"><div class="kv-label">Country</div><div class="kv-sep">:</div><div class="kv-val">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="info-mid">
      <div class="kv">
        <div class="kv-row"><div class="kv-label">Invoice No.</div><div class="kv-sep">:</div><div class="kv-val">{{invoice.number}}</div></div>
        <div class="kv-row"><div class="kv-label">Invoice Date</div><div class="kv-sep">:</div><div class="kv-val">{{formatDate invoice.date}}</div></div>
        <div class="kv-row"><div class="kv-label">Payment Term</div><div class="kv-sep">:</div><div class="kv-val">{{invoice.payment_term}}</div></div>
      </div>
    </div>
    <div class="info-right">
      <div class="qr-box"><img src="{{invoice.qr_code}}" alt="QR"/></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center">Sr.<br/>No.</th>
        <th class="left">Product<br/>Code</th>
        <th class="left">Product Description</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Discount</th>
        <th>Tax</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {{#each invoice.items}}
      <tr>
        <td class="center">{{inc @index}}</td>
        <td>{{code}}</td>
        <td>{{name}}</td>
        <td class="num">{{quantity}}</td>
        <td class="num">{{price}}</td>
        <td class="num">{{discount}}</td>
        <td class="num">{{tax}}</td>
        <td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="bottom-section">
    <div class="bottom-left">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 40px; margin-bottom: 8px;">
        <div><span style="font-weight: bold;">Item Count :</span> {{invoice.item_count}}</div>
        <div><span style="font-weight: bold;">Total Quantity :</span> {{invoice.total_quantity}}</div>
      </div>
      <div style="display: flex; margin-bottom: 16px;">
        <div style="font-weight: bold; white-space: nowrap; margin-right: 8px;">Amount in Words :</div>
        <div style="text-transform: uppercase;">{{invoice.amount_in_words}}</div>
      </div>
      <div style="margin-bottom: 16px;">
        <span style="font-weight: bold;">Remarks :</span> <br/>
        {{invoice.remarks}}
      </div>
      <div>
        <span style="font-weight: bold;">Terms and Condition :</span> <br/>
        {{invoice.terms_and_conditions}}
      </div>
    </div>
    <div class="bottom-right">
      <div class="summary-row"><div class="s-label">Sales Account</div><div class="s-val">{{invoice.net_total}}</div></div>
      <div class="summary-row"><div class="s-label">NHIL [2.5%]</div><div class="s-val">{{invoice.nhil}}</div></div>
      <div class="summary-row"><div class="s-label">GET FUND 2.5% ON<br/>SALES</div><div class="s-val">{{invoice.get_fund}}</div></div>
      <div class="summary-row"><div class="s-label">VAT 15%</div><div class="s-val">{{invoice.vat}}</div></div>
      <div class="summary-row"><div class="s-label">Net Invoice Value</div><div class="s-val" style="font-weight: bold;">{{invoice.total}}</div></div>
    </div>
  </div>
  <div class="footer-prepared">
    <span class="lbl">Prepared By :</span> {{prepared_by}}
  </div>
</div>
`;
  }
  if (type === "delivery-note") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="title">Delivery Note</div>
  <div class="info">
    <div class="card">
      <div><strong>Customer</strong></div>
      <div>{{customer.name}}</div>
      <div class="meta">{{customer.address}}</div>
    </div>
    <div class="card">
      <div><strong>Delivery Info</strong></div>
      <div>Number: {{delivery_note.number}}</div>
      <div>Date: {{formatDate delivery_note.date}}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th></tr>
    </thead>
    <tbody>
      {{#each delivery_note.items}}
      <tr>
        <td>{{@index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="footer">
    <div>
      <div>Received By</div>
      <div class="sign"></div>
    </div>
    <div>
      <div>Signature</div>
      <div class="sign"></div>
    </div>
  </div>
</div>
`;
  }
  if (type === "payment-voucher") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Cash Payment Voucher *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div><strong>Voucher Info</strong></div>
      <div>Number: {{payment_voucher.number}}</div>
      <div>Date: {{formatDate payment_voucher.date}}</div>
      <div class="meta">Type: {{payment_voucher.type_code}} • {{payment_voucher.type_name}}</div>
    </div>
    <div class="card">
      <div><strong>Narration</strong></div>
      <div class="meta">{{payment_voucher.narration}}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Account Code</th><th>Account Name</th><th>Description</th><th>Debit</th><th>Credit</th><th>Ref</th></tr>
    </thead>
    <tbody>
      {{#each payment_voucher.items}}
      <tr>
        <td>{{@index}}</td><td>{{account_code}}</td><td>{{account_name}}</td><td>{{description}}</td><td class="num">{{debit}}</td><td class="num">{{credit}}</td><td>{{reference_no}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Total Debit: {{payment_voucher.total_debit}}</div>
      <div><strong>Total Credit: {{payment_voucher.total_credit}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
    </div>
    <div>
      <div>Receiver Signature</div>
      <div class="sign"></div>
    </div>
  </div>
</div>
`;
  }
  if (type === "quotation") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Quotation *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Customer Name:</div><div class="value">{{customer.name}}</div></div>
        <div class="row"><div class="label">Address:</div><div class="value">{{customer.address}}</div></div>
        <div class="row"><div class="label">City:</div><div class="value">{{customer.city}}</div></div>
        <div class="row"><div class="label">State:</div><div class="value">{{customer.state}}</div></div>
        <div class="row"><div class="label">Country:</div><div class="value">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Quotation No.:</div><div class="value">{{quotation.number}}</div></div>
        <div class="row"><div class="label">Quotation Date:</div><div class="value">{{formatDate quotation.date}}</div></div>
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Price</th><th>Disc%</th><th>Tax</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {{#each quotation.items}}
      <tr>
        <td>{{@index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{discount}}</td><td class="num">{{tax}}</td><td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Sub Total: {{quotation.sub_total}}</div>
      <div>Tax: {{quotation.tax_amount}}</div>
      <div><strong>Total: {{quotation.total}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
      <div class="meta">{{prepared_by}}</div>
    </div>
    <div>
      <div>Remarks</div>
      <div class="meta">{{quotation.remarks}}</div>
    </div>
  </div>
</div>
`;
  }
  if (type === "receipt-voucher") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Receipt Voucher *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div><strong>Voucher Info</strong></div>
      <div>Number: {{receipt_voucher.number}}</div>
      <div>Date: {{formatDate receipt_voucher.date}}</div>
      <div class="meta">Type: {{receipt_voucher.type_code}} • {{receipt_voucher.type_name}}</div>
    </div>
    <div class="card">
      <div><strong>Narration</strong></div>
      <div class="meta">{{receipt_voucher.narration}}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Account Code</th><th>Account Name</th><th>Description</th><th>Debit</th><th>Credit</th><th>Ref</th></tr>
    </thead>
    <tbody>
      {{#each receipt_voucher.items}}
      <tr>
        <td>{{@index}}</td><td>{{account_code}}</td><td>{{account_name}}</td><td>{{description}}</td><td class="num">{{debit}}</td><td class="num">{{credit}}</td><td>{{reference_no}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Total Debit: {{receipt_voucher.total_debit}}</div>
      <div><strong>Total Credit: {{receipt_voucher.total_credit}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
    </div>
    <div>
      <div>Receiver Signature</div>
      <div class="sign"></div>
    </div>
  </div>
</div>
`;
  }
  if (type === "bank-reconciliation-report") {
    return `
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .header h1 { margin: 0; font-size: 20px; }
  .info { display: flex; justify-content: space-between; margin-bottom: 15px; background: #f9f9f9; padding: 10px; border-radius: 5px; }
  .info-item { margin-bottom: 5px; }
  .info-label { font-weight: bold; width: 120px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 10px; }
  td { border: 1px solid #ddd; padding: 8px; font-size: 10px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .status-reconciled { color: green; font-weight: bold; }
  .status-unpresented { color: orange; font-weight: bold; }
  .status-uncleared { color: blue; font-weight: bold; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; }
  .signature-box { border-top: 1px solid #333; width: 150px; text-align: center; padding-top: 5px; margin-top: 40px; }
  .summary { margin-top: 20px; border: 1px solid #ddd; padding: 10px; width: 300px; margin-left: auto; }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
</style>

<div class="header">
  <h1>Bank Reconciliation Detail Report</h1>
  <p>{{company_name}}</p>
</div>

<div class="info">
  <div>
    <div class="info-item"><span class="info-label">Bank Account:</span> {{bank_account_name}}</div>
    <div class="info-item"><span class="info-label">Account Number:</span> {{account_number}}</div>
    <div class="info-item"><span class="info-label">Currency:</span> {{currency_code}}</div>
  </div>
  <div>
    <div class="info-item"><span class="info-label">Period From:</span> {{from_date}}</div>
    <div class="info-item"><span class="info-label">Period To:</span> {{to_date}}</div>
    <div class="info-item"><span class="info-label">Print Date:</span> {{print_date}}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Voucher No</th>
      <th>Date</th>
      <th>Narration</th>
      <th>Offset Account</th>
      <th class="text-right">Debit</th>
      <th class="text-right">Credit</th>
      <th>Cheque No</th>
      <th>Cheque Date</th>
      <th class="text-center">Status</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{voucher_no}}</td>
      <td>{{voucher_date}}</td>
      <td>{{narration}}</td>
      <td>{{offset_account_name}}</td>
      <td class="text-right">{{debit}}</td>
      <td class="text-right">{{credit}}</td>
      <td>{{cheque_no}}</td>
      <td>{{cheque_date}}</td>
      <td class="text-center">
        <span class="status-{{status_class}}">{{status}}</span>
      </td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div class="summary">
  <div class="summary-row"><span>Total Debit:</span> <strong>{{total_debit}}</strong></div>
  <div class="summary-row"><span>Total Credit:</span> <strong>{{total_credit}}</strong></div>
  <div class="summary-row"><span>Net Movement:</span> <strong>{{net_movement}}</strong></div>
</div>

<div class="footer">
  <div>
    <div class="signature-box">Prepared By</div>
  </div>
  <div>
    <div class="signature-box">Reviewed By</div>
  </div>
  <div>
    <div class="signature-box">Authorized By</div>
  </div>
</div>
`;
  }
  return "<div>Define your template here</div>";
}
