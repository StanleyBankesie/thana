import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import * as fc from "../controllers/facilities.controller.js";

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
router.post("/spaces", ...auth, fc.createSpace);
router.put("/spaces/:id", ...auth, fc.updateSpace);
router.delete("/spaces/:id", ...auth, fc.deleteSpace);

// ===== FM SERVICE CONTRACTS & SLA =====
router.get("/contracts", ...auth, fc.listContracts);
router.get("/contracts/:id", ...auth, fc.getContractById);
router.post("/contracts", ...auth, fc.createContract);
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
router.post("/checklists/execute", ...auth, fc.executeChecklist);

// ===== SOFT FACILITIES SERVICES =====
router.get("/janitorial-logs", ...auth, fc.listJanitorialLogs);
router.post("/janitorial-logs", ...auth, fc.createJanitorialLog);

router.get("/security-patrol-logs", ...auth, fc.listSecurityPatrolLogs);
router.post("/security-patrol-logs", ...auth, fc.createSecurityPatrolLog);

router.get("/pest-control-logs", ...auth, fc.listPestControlLogs);
router.post("/pest-control-logs", ...auth, fc.createPestControlLog);

router.get("/waste-disposal-logs", ...auth, fc.listWasteDisposalLogs);
router.post("/waste-disposal-logs", ...auth, fc.createWasteDisposalLog);

// ===== OPERATIONS DASHBOARD & LIVE KPIS =====
router.get("/dashboard/kpis", ...auth, fc.getFacilitiesDashboardKPIs);

// ===== INDUSTRY RELEVANT FM REPORTS =====
router.get("/reports/sla-compliance", ...auth, fc.getFMSLAComplianceReport);
router.get("/reports/property-costs", ...auth, fc.getFMPropertyCostReport);
router.get("/reports/contract-profitability", ...auth, fc.getFMContractProfitabilityReport);
router.get("/reports/soft-services-compliance", ...auth, fc.getFMSoftServicesComplianceReport);
router.get("/reports/checklist-inspections", ...auth, fc.getFMChecklistInspectionsReport);

export default router;
