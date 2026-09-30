import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { checkFeatureAccess } from "../middleware/rbac.middleware.js";

const router = express.Router();

// Example protected route - Create Invoice
router.post(
  "/sales/invoices",
  requireAuth,
  checkFeatureAccess("sales:create-invoice", "create"),
  async (req, res, next) => {
    try {
      // Your invoice creation logic here
      res.json({ message: "Invoice created successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// Example protected route - View Invoices
router.get(
  "/sales/invoices",
  requireAuth,
  checkFeatureAccess("sales:view-invoices", "view"),
  async (req, res, next) => {
    try {
      // Your invoice listing logic here
      res.json({ invoices: [] });
    } catch (err) {
      next(err);
    }
  }
);

// Example protected route - Edit Invoice
router.put(
  "/sales/invoices/:id",
  requireAuth,
  checkFeatureAccess("sales:create-invoice", "edit"),
  async (req, res, next) => {
    try {
      // Your invoice update logic here
      res.json({ message: "Invoice updated successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// Example protected route - Delete Invoice
router.delete(
  "/sales/invoices/:id",
  requireAuth,
  checkFeatureAccess("sales:create-invoice", "delete"),
  async (req, res, next) => {
    try {
      // Your invoice deletion logic here
      res.json({ message: "Invoice deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
