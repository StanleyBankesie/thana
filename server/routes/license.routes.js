import express from "express";
import { 
  getLicense, 
  saveLicense, 
  saveModules, 
  getCompaniesForLicense,
  initializePaystackPayment,
  verifyPaystackPayment,
  getInvoiceTemplate,
  saveInvoiceTemplate,
  getReceiptTemplate,
  saveReceiptTemplate,
  getGlobalLicenseStatus
} from "../controllers/license.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

// Allow fetching the designated super admin ID without the manage permission
// and allow unauthenticated Paystack endpoints for license renewal on login page
router.get("/super-admin", requireAuth, (req, res) => {
  const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
  const parsedId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
  res.json({ superAdminId: isNaN(parsedId) ? 1 : parsedId });
});

// Paystack payment routes (PUBLICly accessible for expired license renewal on login)
router.post("/paystack/initialize", initializePaystackPayment);
router.get("/paystack/verify", verifyPaystackPayment);
router.get("/system-state", getGlobalLicenseStatus);

// All other license endpoints require authentication
router.use(requireAuth);

router.get("/company/:companyId", getLicense);

// Ensure only super admin (or users with specific permission) can manage licenses
router.use(requirePermission("admin.licenses.manage"));

router.get("/companies", getCompaniesForLicense);
router.post("/", saveLicense);
router.post("/company/:companyId/modules", saveModules);
router.get("/invoice-template", getInvoiceTemplate);
router.post("/invoice-template", saveInvoiceTemplate);
router.get("/receipt-template", getReceiptTemplate);
router.post("/receipt-template", saveReceiptTemplate);

export default router;
