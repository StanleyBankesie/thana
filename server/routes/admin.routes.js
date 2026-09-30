import express from "express";
import {
  getRoles,
  createRole,
  updateRole,
  getRoleModules,
  saveRoleModules,
  getRolePermissions,
  saveRolePermissions,
} from "../controllers/rbac.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ROLES ROUTES
// GET /roles - Fetch all roles for the company
router.get("/roles", requireAuth, getRoles);
// POST /roles - Create a new role
router.post("/roles", requireAuth, createRole);
// PUT /roles/:id - Update an existing role
router.put("/roles/:id", requireAuth, updateRole);

// ROLE MODULES ROUTES
// GET /role-modules/:roleId - Fetch modules assigned to a role
router.get("/role-modules/:roleId", requireAuth, getRoleModules);
// POST /role-modules - Save or update modules for a role
router.post("/role-modules", requireAuth, saveRoleModules);

// ROLE PERMISSIONS ROUTES
// GET /role-permissions/:roleId - Fetch permissions assigned to a role
router.get("/role-permissions/:roleId", requireAuth, getRolePermissions);
// POST /role-permissions - Save or update permissions for a role
router.post("/role-permissions", requireAuth, saveRolePermissions);

export default router;
