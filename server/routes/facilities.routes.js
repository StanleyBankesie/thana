import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import * as fc from "../controllers/facilities.controller.js";
import * as adv from "../controllers/facilities.advanced.controller.js";
import * as fmb from "../controllers/facilities.servicebilling.controller.js";
import * as exp from "../controllers/facilities.expansion.controller.js";
import * as tm from "../controllers/facilities.tasks_materials.controller.js";

const router = express.Router();
const auth = [requireAuth, requireCompanyScope, requireBranchScope];

// ===== PROPERTIES & MULTI-TIER HIERARCHY =====
router.get("/properties", ...auth, fc.listProperties);
router.get("/properties/:id", ...auth, fc.getPropertyById);
router.get("/properties/:id/hierarchy", ...auth, fc.getPropertyHierarchy);
router.post("/properties", ...auth, fc.createProperty);
router.put("/properties/:id", ...auth, fc.updateProperty);

// Buildings
router.post("/buildings", ...auth, fc.createBuilding);
router.put("/buildings/:id", ...auth, fc.updateBuilding);
router.delete("/buildings/:id", ...auth, fc.deleteBuilding);

// Zones
router.post("/zones", ...auth, fc.createZone);
router.put("/zones/:id", ...auth, fc.updateZone);
router.delete("/zones/:id", ...auth, fc.deleteZone);

// Spaces
router.get("/spaces", ...auth, fc.listSpaces);
router.post("/spaces", ...auth, fc.createSpace);
router.put("/spaces/:id", ...auth, fc.updateSpace);
router.delete("/spaces/:id", ...auth, fc.deleteSpace);

// ===== FACILITIES SERVICE BILLS (FB- PREFIX) =====
router.get("/service-bills", ...auth, fmb.listFMServiceBills);
router.get("/service-bills/next-no", ...auth, fmb.getNextFMBillNo);
router.get("/service-bills/:id", ...auth, fmb.getFMServiceBillById);
router.post("/service-bills", ...auth, fmb.createFMServiceBill);
router.put("/service-bills/:id", ...auth, fmb.updateFMServiceBill);
router.delete("/service-bills/:id", ...auth, fmb.deleteFMServiceBill);

// ===== FM SERVICE CONTRACTS & SLA =====
router.get("/contracts", ...auth, fc.listContracts);
router.get("/contracts/:id", ...auth, fc.getContractById);
router.post("/contracts", ...auth, fc.createContract);
router.put("/contracts/:id", ...auth, fc.updateContract);
router.get("/contracts/coverage/check", ...auth, fc.checkContractCoverage);
router.post("/contracts/:id/generate-invoice", ...auth, fc.generateContractInvoice);

// ===== FM HELPDESK TICKETS & SLA ENGINE =====
router.get("/tickets", ...auth, fc.listFMTickets);
router.post("/tickets", ...auth, fc.createFMTicket);
router.post("/tickets/:id/pause-sla", ...auth, fc.pauseTicketSLA);
router.post("/tickets/:id/resume-sla", ...auth, fc.resumeTicketSLA);
router.post("/tickets/:id/convert-to-work-order", ...auth, fc.convertTicketToWorkOrder);

// ===== FIELD SERVICE TECHNICIAN WORKFLOW =====
router.get("/technician/jobs", ...auth, fc.getTechnicianJobs);
router.post("/jobs/:id/status-transition", ...auth, fc.transitionJobStatus);
router.post("/jobs/:id/complete", ...auth, fc.completeJobWithSignoff);

// ===== DIGITAL INSPECTIONS & CHECKLISTS =====
router.get("/checklists/templates", ...auth, fc.listChecklistTemplates);
router.get("/checklists/templates/:id", ...auth, fc.getChecklistTemplateById);
router.post("/checklists/templates", ...auth, fc.createChecklistTemplate);
router.put("/checklists/templates/:id", ...auth, fc.updateChecklistTemplate);
router.delete("/checklists/templates/:id", ...auth, fc.deleteChecklistTemplate);
router.post("/checklists/execute", ...auth, fc.executeChecklist);

// ===== SOFT FACILITIES DAILY TASKS & OPERATIONS =====
router.get("/soft-tasks", ...auth, adv.listSoftTasks);
router.post("/soft-tasks", ...auth, adv.createSoftTask);
router.put("/soft-tasks/:id/execute", ...auth, adv.executeSoftTask);
router.put("/soft-tasks/:id/verify", ...auth, adv.verifySoftTask);

// ===== SOFT FACILITIES SERVICES (LEGACY LOGS) =====
router.get("/janitorial-logs", ...auth, fc.listJanitorialLogs);
router.post("/janitorial-logs", ...auth, fc.createJanitorialLog);

router.get("/security-patrol-logs", ...auth, fc.listSecurityPatrolLogs);
router.post("/security-patrol-logs", ...auth, fc.createSecurityPatrolLog);

router.get("/pest-control-logs", ...auth, fc.listPestControlLogs);
router.post("/pest-control-logs", ...auth, fc.createPestControlLog);

router.get("/waste-disposal-logs", ...auth, fc.listWasteDisposalLogs);
router.post("/waste-disposal-logs", ...auth, fc.createWasteDisposalLog);

// ===== 5. HEALTH, SAFETY & COMPLIANCE =====
router.get("/hsa/incidents", ...auth, adv.listSafetyIncidents);
router.post("/hsa/incidents", ...auth, adv.createSafetyIncident);
router.get("/hsa/permits", ...auth, adv.listPermitsToWork);
router.post("/hsa/permits", ...auth, adv.createPermitToWork);
router.get("/hsa/certificates", ...auth, adv.listComplianceCertificates);
router.post("/hsa/certificates", ...auth, adv.createComplianceCertificate);

// ===== 6. UTILITIES AND ENERGY MANAGEMENT =====
router.get("/utilities/meters", ...auth, adv.listUtilityMeters);
router.post("/utilities/meters", ...auth, adv.createUtilityMeter);
router.post("/utilities/readings", ...auth, adv.createUtilityReading);
router.get("/utilities/generator-logs", ...auth, adv.listGeneratorLogs);
router.post("/utilities/generator-logs", ...auth, adv.createGeneratorLog);
router.get("/utilities/bills", ...auth, adv.listUtilityBills);
router.post("/utilities/bills", ...auth, adv.createUtilityBill);

// ===== 7. CONTRACTOR AND VENDOR MANAGEMENT =====
router.get("/vendors", ...auth, adv.listVendors);
router.post("/vendors", ...auth, adv.createVendor);
router.get("/vendors/contracts", ...auth, adv.listVendorContracts);
router.post("/vendors/rate", ...auth, adv.rateVendor);

// ===== 8. BUDGETING AND FINANCIAL MANAGEMENT =====
router.get("/budgets", ...auth, adv.listBudgets);
router.post("/budgets", ...auth, adv.createBudget);

// ===== 9. SPACE AND OCCUPANCY MANAGEMENT =====
router.get("/space/room-bookings", ...auth, adv.listRoomBookings);
router.post("/space/room-bookings", ...auth, adv.createRoomBooking);
router.get("/space/tenants", ...auth, adv.listTenants);
router.post("/space/tenants", ...auth, adv.createTenant);

// ===== 10. SUSTAINABILITY AND ENVIRONMENTAL MANAGEMENT =====
router.get("/sustainability/metrics", ...auth, adv.listSustainabilityMetrics);
router.post("/sustainability/initiatives", ...auth, adv.createGreenInitiative);

// ===== OPERATIONS SETUP (SHIFTS, SUPERVISORS, PERSONNEL) =====
router.get("/setup/overview", ...auth, adv.getSetupOverview);
router.get("/setup/hr-employees", ...auth, adv.getHREmployeesList);

router.get("/setup/shifts", ...auth, adv.listShifts);
router.post("/setup/shifts", ...auth, adv.createShift);
router.put("/setup/shifts/:id", ...auth, adv.updateShift);
router.delete("/setup/shifts/:id", ...auth, adv.deleteShift);

router.get("/setup/supervisors", ...auth, adv.listSupervisors);
router.post("/setup/supervisors", ...auth, adv.createSupervisor);
router.put("/setup/supervisors/:id", ...auth, adv.updateSupervisor);
router.delete("/setup/supervisors/:id", ...auth, adv.deleteSupervisor);

router.get("/setup/personnel", ...auth, adv.listPersonnel);
router.post("/setup/personnel", ...auth, adv.createPersonnel);
router.put("/setup/personnel/:id", ...auth, adv.updatePersonnel);
router.delete("/setup/personnel/:id", ...auth, adv.deletePersonnel);

router.get("/setup/categories", ...auth, adv.listServiceCategories);
router.post("/setup/categories", ...auth, adv.createServiceCategory);
router.put("/setup/categories/:id", ...auth, adv.updateServiceCategory);
router.delete("/setup/categories/:id", ...auth, adv.deleteServiceCategory);
router.get("/setup/service-categories", ...auth, adv.listServiceCategories);
router.post("/setup/service-categories", ...auth, adv.createServiceCategory);
router.put("/setup/service-categories/:id", ...auth, adv.updateServiceCategory);
router.delete("/setup/service-categories/:id", ...auth, adv.deleteServiceCategory);

// ===== OPERATIONS DASHBOARD & LIVE KPIS =====
router.get("/dashboard/kpis", ...auth, fc.getFacilitiesDashboardKPIs);

// ===== INDUSTRY RELEVANT FM REPORTS =====
router.get("/reports/sla-compliance", ...auth, fc.getFMSLAComplianceReport);
router.get("/reports/property-costs", ...auth, fc.getFMPropertyCostReport);
router.get("/reports/contract-profitability", ...auth, fc.getFMContractProfitabilityReport);
router.get("/reports/soft-services-compliance", ...auth, fc.getFMSoftServicesComplianceReport);
router.get("/reports/checklist-inspections", ...auth, fc.getFMChecklistInspectionsReport);
router.get("/reports/compliance", ...auth, exp.getFMComplianceReport);
router.get("/reports/workforce", ...auth, exp.getFMWorkforceReport);

// ===== EXPANDED FM ENDPOINTS =====

// Property Onboarding & Handover
router.get("/onboarding", ...auth, exp.listPropertyOnboarding);
router.get("/onboarding/:id", ...auth, exp.getPropertyOnboardingById);
router.post("/onboarding", ...auth, exp.createPropertyOnboarding);
router.put("/onboarding/:id", ...auth, exp.updatePropertyOnboarding);
router.put("/onboarding/checklist/:id", ...auth, exp.updateOnboardingChecklistItem);

// Hard Services & Building Engineering Systems
router.get("/hard-services", ...auth, exp.listHardServices);
router.post("/hard-services", ...auth, exp.createHardService);
router.put("/hard-services/:id", ...auth, exp.updateHardService);

// Helpdesk & Service Requests
router.get("/helpdesk/dashboard", ...auth, exp.getHelpdeskDashboard);
router.get("/helpdesk/tickets", ...auth, exp.listHelpdeskTickets);
router.post("/helpdesk/tickets", ...auth, exp.createHelpdeskTicket);
router.put("/helpdesk/tickets/:id", ...auth, exp.updateHelpdeskTicket);
router.get("/helpdesk/tickets/:id/notes", ...auth, exp.getTicketNotes);
router.post("/helpdesk/tickets/:id/notes", ...auth, exp.addTicketNote);

// Inspection Runs & Corrective Actions
router.get("/inspection-runs", ...auth, exp.listInspectionRuns);
router.post("/inspection-runs", ...auth, exp.createInspectionRun);
router.put("/inspection-runs/:id/complete", ...auth, exp.completeInspectionRun);
router.get("/corrective-actions", ...auth, exp.listCorrectiveActions);
router.post("/corrective-actions", ...auth, exp.createCorrectiveAction);
router.put("/corrective-actions/:id", ...auth, exp.updateCorrectiveAction);

// Security & Access Management
router.get("/security/visitors", ...auth, exp.listVisitors);
router.post("/security/visitors", ...auth, exp.createVisitor);
router.put("/security/visitors/:id/checkout", ...auth, exp.checkOutVisitor);
router.get("/security/keys", ...auth, exp.listKeyRegister);
router.post("/security/keys", ...auth, exp.createKeyRecord);
router.put("/security/keys/:id/issue", ...auth, exp.issueKey);
router.put("/security/keys/:id/return", ...auth, exp.returnKey);

// Workforce Rosters
router.get("/workforce/rosters", ...auth, exp.listWorkforceRosters);
router.post("/workforce/rosters", ...auth, exp.createWorkforceRoster);
router.put("/workforce/rosters/:id", ...auth, exp.updateWorkforceRoster);

// Compliance Obligations & Documents Register
router.get("/compliance/obligations", ...auth, exp.listComplianceObligations);
router.post("/compliance/obligations", ...auth, exp.createComplianceObligation);
router.put("/compliance/obligations/:id", ...auth, exp.updateComplianceObligation);

// SLA Policies Management
router.get("/sla-policies", ...auth, exp.listSLAPolicies);
router.post("/sla-policies", ...auth, exp.createSLAPolicy);
router.put("/sla-policies/:id", ...auth, exp.updateSLAPolicy);
router.delete("/sla-policies/:id", ...auth, exp.deleteSLAPolicy);

// Hazard Assessments
router.get("/hazards", ...auth, exp.listHazardAssessments);
router.post("/hazards", ...auth, exp.createHazardAssessment);

// FM Operations Dashboard (expanded)
router.get("/dashboard/operations", ...auth, exp.getFMOperationsDashboard);

// ===== FM TASKS & WORK EXECUTION =====
router.get("/tasks/next-no", ...auth, async (req, res, next) => {
  try {
    const no = await tm.getNextTaskNo(req.scope?.companyId, req.scope?.branchId);
    res.json({ nextNo: no, task_no: no });
  } catch (err) { next(err); }
});
router.get("/tasks", ...auth, tm.listFMTasks);
router.get("/tasks/:id", ...auth, tm.getFMTaskById);
router.post("/tasks", ...auth, tm.createFMTask);
router.put("/tasks/:id", ...auth, tm.updateFMTask);
router.delete("/tasks/:id", ...auth, tm.deleteFMTask);
router.post("/tasks/:id/reassign", ...auth, tm.reassignFMTask);

// ===== FM PURCHASE REQUISITIONS =====
router.get("/purchase-requisitions/next-no", ...auth, async (req, res, next) => {
  try {
    const no = await tm.getNextPurchaseReqNo(req.scope?.companyId, req.scope?.branchId);
    res.json({ nextNo: no, requisition_no: no });
  } catch (err) { next(err); }
});
router.get("/purchase-requisitions", ...auth, tm.listFMPurchaseRequisitions);
router.get("/purchase-requisitions/:id", ...auth, tm.getFMPurchaseRequisitionById);
router.post("/purchase-requisitions", ...auth, tm.createFMPurchaseRequisition);
router.put("/purchase-requisitions/:id", ...auth, tm.updateFMPurchaseRequisition);
router.delete("/purchase-requisitions/:id", ...auth, tm.deleteFMPurchaseRequisition);
router.post("/purchase-requisitions/:id/submit", ...auth, tm.submitFMPurchaseRequisition);

// ===== FM MATERIAL REQUISITIONS =====
router.get("/material-requisitions/next-no", ...auth, async (req, res, next) => {
  try {
    const no = await tm.getNextMaterialReqNo(req.scope?.companyId, req.scope?.branchId);
    res.json({ nextNo: no, requisition_no: no });
  } catch (err) { next(err); }
});
router.get("/material-requisitions", ...auth, tm.listFMMaterialRequisitions);
router.get("/material-requisitions/:id", ...auth, tm.getFMMaterialRequisitionById);
router.post("/material-requisitions", ...auth, tm.createFMMaterialRequisition);
router.put("/material-requisitions/:id", ...auth, tm.updateFMMaterialRequisition);
router.post("/material-requisitions/:id/submit", ...auth, tm.submitFMMaterialRequisition);

// ===== FM MATERIAL RECEIPTS =====
router.get("/material-receipts/next-no", ...auth, async (req, res, next) => {
  try {
    const no = await tm.getNextMaterialReceiptNo(req.scope?.companyId, req.scope?.branchId);
    res.json({ nextNo: no, receipt_no: no });
  } catch (err) { next(err); }
});
router.get("/material-receipts", ...auth, tm.listFMMaterialReceipts);
router.get("/material-receipts/:id", ...auth, tm.getFMMaterialReceiptById);
router.post("/material-receipts", ...auth, tm.createFMMaterialReceipt);
router.get("/issue-to-requirement/fm", ...auth, tm.getPendingIssueToRequirementFM);
router.get("/issue-to-requirement/fm/:issueId", ...auth, tm.getIssueToRequirementDetailFM);

// ===== FM MATERIAL UTILIZATIONS =====
router.get("/material-utilizations/next-no", ...auth, async (req, res, next) => {
  try {
    const no = await tm.getNextMaterialUtilizationNo(req.scope?.companyId, req.scope?.branchId);
    res.json({ nextNo: no, utilization_no: no });
  } catch (err) { next(err); }
});
router.get("/material-utilizations", ...auth, tm.listFMMaterialUtilizations);
router.get("/material-utilizations/:id", ...auth, tm.getFMMaterialUtilizationById);
router.post("/material-utilizations", ...auth, tm.createFMMaterialUtilization);
router.post("/material-utilizations/:id/confirm", ...auth, tm.confirmFMMaterialUtilization);

export default router;
