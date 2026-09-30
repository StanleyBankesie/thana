import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import * as mc from "../controllers/maintenance.controller.js";

const router = express.Router();
const auth = [requireAuth, requireCompanyScope, requireBranchScope];

// ===== ASSETS =====
router.get("/assets", ...auth, mc.listAssets);
router.get("/assets/:id", ...auth, mc.getAssetById);
router.post("/assets", ...auth, mc.createAsset);
router.put("/assets/:id", ...auth, mc.updateAsset);

// ===== MAINTENANCE REQUESTS =====
router.get("/maintenance-requests", ...auth, mc.listRequests);
router.get("/maintenance-requests/next-no", ...auth, mc.getNextRequestNo);
router.get("/maintenance-requests/:id", ...auth, mc.getRequestById);
router.post("/maintenance-requests", ...auth, mc.createRequest);
router.put("/maintenance-requests/:id", ...auth, mc.updateRequest);
router.post("/maintenance-requests/:id/submit", ...auth, mc.submitRequest);

// ===== JOB ORDERS =====
router.get("/job-orders", ...auth, mc.listJobOrders);
router.get("/job-orders/:id", ...auth, mc.getJobOrderById);
router.post("/job-orders", ...auth, mc.createJobOrder);
router.put("/job-orders/:id", ...auth, mc.updateJobOrder);
router.post("/job-orders/:id/send-notification", ...auth, mc.sendJobOrderNotification);

// ===== MATERIAL RECEIPTS =====
router.get("/material-receipts", ...auth, mc.listMaintMaterialReceipts);
router.get("/material-receipts/:id", ...auth, mc.getMaintMaterialReceiptById);
router.post("/material-receipts", ...auth, mc.createMaintMaterialReceipt);
router.put("/material-receipts/:id", ...auth, mc.updateMaintMaterialReceipt);

// ===== RFQ =====
router.get("/rfqs", ...auth, mc.listRFQs);
router.get("/rfqs/:id", ...auth, mc.getRFQById);
router.post("/rfqs", ...auth, mc.createRFQ);
router.put("/rfqs/:id", ...auth, mc.updateRFQ);
router.post("/rfqs/:id/send-email", ...auth, mc.sendRFQEmail);

// ===== SUPPLIER QUOTATIONS =====
router.get("/supplier-quotations", ...auth, mc.listSupplierQuotations);
router.get("/supplier-quotations/:id", ...auth, mc.getSupplierQuotationById);
router.post("/supplier-quotations", ...auth, mc.createSupplierQuotation);
router.put("/supplier-quotations/:id", ...auth, mc.updateSupplierQuotation);

// ===== JOB EXECUTIONS =====
router.get("/job-executions", ...auth, mc.listJobExecutions);
router.get("/job-executions/:id", ...auth, mc.getJobExecutionById);
router.post("/job-executions", ...auth, mc.createJobExecution);
router.put("/job-executions/:id", ...auth, mc.updateJobExecution);

// ===== MAINTENANCE BILLS =====
router.get("/bills/next-no", ...auth, mc.getNextBillNo);
router.get("/bills", ...auth, mc.listBills);
router.get("/bills/:id", ...auth, mc.getBillById);
router.post("/bills", ...auth, mc.createBill);
router.put("/bills/:id", ...auth, mc.updateBill);

// ===== SCHEDULES =====
router.get("/schedules", ...auth, mc.listSchedules);
router.get("/schedules/:id", ...auth, mc.getScheduleById);
router.post("/schedules", ...auth, mc.createSchedule);
router.put("/schedules/:id", ...auth, mc.updateSchedule);

// ===== ROSTERS =====
router.get("/rosters", ...auth, mc.listRosters);
router.get("/rosters/:id", ...auth, mc.getRosterById);
router.post("/rosters", ...auth, mc.createRoster);
router.put("/rosters/:id", ...auth, mc.updateRoster);

// ===== EQUIPMENT =====
router.get("/equipment", ...auth, mc.listEquipment);
router.get("/equipment/:id", ...auth, mc.getEquipmentById);
router.post("/equipment", ...auth, mc.createEquipment);
router.put("/equipment/:id", ...auth, mc.updateEquipment);

// ===== PARAMETERS =====
router.get("/parameters", ...auth, mc.getParameters);
router.put("/parameters", ...auth, mc.saveParameters);
router.get("/setup/catalog", ...auth, mc.getSetupCatalog);
router.post("/setup/catalog/:kind", ...auth, mc.createSetupItem);
router.put("/setup/catalog/:kind/:id", ...auth, mc.updateSetupItem);
router.delete("/setup/catalog/:kind/:id", ...auth, mc.deleteSetupItem);
router.post("/setup/section-users", ...auth, mc.createSectionUser);
router.put("/setup/section-users/:id", ...auth, mc.updateSectionUser);
router.delete("/setup/section-users/:id", ...auth, mc.deleteSectionUser);

// ===== CONTRACTS =====
router.get("/contracts", ...auth, mc.listContracts);
router.get("/contracts/:id", ...auth, mc.getContractById);
router.post("/contracts", ...auth, mc.createContract);
router.put("/contracts/:id", ...auth, mc.updateContract);

// ===== DASHBOARD =====
router.get("/dashboard/stats", ...auth, mc.getMaintenanceStats);

// ===== ASSET METERS =====
router.get("/assets/meters", ...auth, mc.listAssetMeters);
router.post("/assets/meters", ...auth, mc.createAssetMeter);

// ===== DOWNTIME =====
router.get("/assets/downtime", ...auth, mc.listDowntimeLogs);
router.post("/assets/downtime", ...auth, mc.createDowntimeLog);

// ===== REPORTS =====
router.get("/reports/downtime", ...auth, mc.getDowntimeReport);

// ===== MAINTENANCE MATERIAL REQUISITIONS =====
router.get("/material-requisitions/next-no", ...auth, mc.getNextMaintMRNo);
router.get("/material-requisitions", ...auth, mc.listMaintMaterialRequisitions);
router.get("/material-requisitions/:id", ...auth, mc.getMaintMaterialRequisitionById);
router.post("/material-requisitions", ...auth, mc.createMaintMaterialRequisition);
router.put("/material-requisitions/:id", ...auth, mc.updateMaintMaterialRequisition);
router.post("/material-requisitions/:id/submit", ...auth, mc.submitMaintMaterialRequisition);

// ===== MAINTENANCE MATERIAL RECEIPTS =====
router.get("/material-receipts", ...auth, mc.listMaintMaterialReceipts);
router.get("/material-receipts/:id", ...auth, mc.getMaintMaterialReceiptById);
router.post("/material-receipts", ...auth, mc.createMaintMaterialReceipt);
router.put("/material-receipts/:id", ...auth, mc.updateMaintMaterialReceipt);
router.get("/issue-to-requirement/maint", ...auth, mc.getPendingMaintIssueToRequirement);
router.get("/issue-to-requirement/maint/:issueId", ...auth, mc.getMaintIssueToRequirementDetail);

export default router;
