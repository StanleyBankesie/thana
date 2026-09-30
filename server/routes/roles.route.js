/**
 * @fileoverview Roles routes.
 * Provides endpoints for managing and retrieving user roles and permissions.
 */
import express from "express";

import { updateRole, getUserRole } from "../controllers/roles.controller.js";
import {
  requireAuth,
  requirePermission,
  requireCompanyScope,
} from "../middleware/auth.js";
const router = express.Router();

// Update role
// Modifies role details and requires admin roles management permission.
router.put(
  "/role/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.ROLES.MANAGE"),
  updateRole,
);
// Get user role
// Retrieves the assigned role for a specific user ID.
router.get("/user/:id", getUserRole);
export default router;
