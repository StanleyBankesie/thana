import express from "express";
import {
  getPaymentPackages,
  createPaymentPackage,
  updatePaymentPackage,
  deletePaymentPackage
} from "../controllers/paymentPackages.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

// Publicly accessible so the modal can fetch them without auth
router.get("/", getPaymentPackages);

// Admin only
router.post("/", requireAuth, requirePermission("admin.licenses.manage"), createPaymentPackage);
router.put("/:id", requireAuth, requirePermission("admin.licenses.manage"), updatePaymentPackage);
router.delete("/:id", requireAuth, requirePermission("admin.licenses.manage"), deletePaymentPackage);

export default router;
