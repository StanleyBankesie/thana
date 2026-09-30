/**
 * @file visitors.routes.js
 * @description Express routes for managing visitors and entry logs.
 */
import express from "express";
import { requireAuth, requireCompanyScope, requireBranchScope } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";

const router = express.Router();

// List visitors with filters
/**
 * Retrieves all visitor records.
 * @route GET /visitors
 */
router.get(
  "/",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SERVICE.VISITORS.VIEW", "SERVICE.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { from, to, status, department, search } = req.query;
      
      const clauses = ["v.company_id = :companyId", "(:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))"];
      const params = { companyId, branchId, branchIdsStr };
      
      if (from) {
        clauses.push("v.visit_date >= :from");
        params.from = from;
      }
      if (to) {
        clauses.push("v.visit_date <= :to");
        params.to = to;
      }
      if (status) {
        clauses.push("v.status = :status");
        params.status = status;
      }
      if (department) {
        clauses.push("v.department_visited = :department");
        params.department = department;
      }
      if (search) {
        clauses.push(`(
          v.visitor_name LIKE :search 
          OR v.phone_number LIKE :search 
          OR v.organisation LIKE :search
          OR v.temp_address LIKE :search
        )`);
        params.search = `%${search}%`;
      }
      
      const items = await query(`
        SELECT 
          v.id,
          v.visitor_name,
          v.phone_number,
          v.organisation,
          v.department_visited,
          v.temp_address,
          v.time_in,
          v.time_out,
          v.visit_date,
          v.purpose,
          v.status,
          v.created_at,
          v.updated_at,
          u.username AS created_by_name
        FROM svc_visitors_log v
        LEFT JOIN adm_users u ON u.id = v.created_by
        WHERE ${clauses.join(" AND ")}
        ORDER BY v.visit_date DESC, v.time_in DESC
      `, params);
      
      res.json({ items: items || [] });
    } catch (err) {
      next(err);
    }
  }
);

// Get single visitor
router.get(
  "/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SERVICE.VISITORS.VIEW", "SERVICE.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { id } = req.params;
      
      const rows = await query(`
        SELECT 
          v.*,
          u.username AS created_by_name
        FROM svc_visitors_log v
        LEFT JOIN adm_users u ON u.id = v.created_by
        WHERE v.id = :id AND v.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr))
      `, { id, companyId, branchId, branchIdsStr });
      
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Visitor record not found" });
      }
      
      res.json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// Create visitor entry
router.post(
  "/",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SERVICE.VISITORS.MANAGE", "SERVICE.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const {
        visitorName,
        phoneNumber,
        organisation,
        departmentVisited,
        tempAddress,
        timeIn,
        timeOut,
        visitDate,
        purpose,
      } = req.body;
      
      if (!visitorName || !visitDate) {
        return res.status(400).json({ 
          message: "Visitor name and visit date are required" 
        });
      }
      
      const result = await query(`
        INSERT INTO svc_visitors_log (
          company_id, branch_id, visitor_name, phone_number, organisation,
          department_visited, temp_address, time_in, time_out, visit_date, purpose,
          status, created_by, created_at
        ) VALUES (
          :companyId, :branchId, :visitorName, :phoneNumber, :organisation,
          :departmentVisited, :tempAddress, :timeIn, :timeOut, :visitDate, :purpose,
          :status, :createdBy, NOW()
        )
      `, {
        companyId,
        branchId, branchIdsStr,
        visitorName,
        phoneNumber: phoneNumber || null,
        organisation: organisation || null,
        departmentVisited: departmentVisited || null,
        tempAddress: tempAddress || null,
        timeIn: timeIn || null,
        timeOut: timeOut || null,
        visitDate,
        purpose: purpose || null,
        status: timeOut ? "COMPLETED" : "ACTIVE",
        createdBy: req.user?.id || null,
      });
      
      res.status(201).json({ 
        id: result.insertId,
        message: "Visitor record created successfully" 
      });
    } catch (err) {
      next(err);
    }
  }
);

// Update visitor entry
router.put(
  "/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SERVICE.VISITORS.MANAGE", "SERVICE.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { id } = req.params;
      const {
        visitorName,
        phoneNumber,
        organisation,
        departmentVisited,
        tempAddress,
        timeIn,
        timeOut,
        visitDate,
        purpose,
        status,
      } = req.body;
      
      const existing = await query(`
        SELECT id FROM svc_visitors_log 
        WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `, { id, companyId, branchId, branchIdsStr });
      
      if (!existing || existing.length === 0) {
        return res.status(404).json({ message: "Visitor record not found" });
      }
      
      await query(`
        UPDATE svc_visitors_log SET
          visitor_name = :visitorName,
          phone_number = :phoneNumber,
          organisation = :organisation,
          department_visited = :departmentVisited,
          temp_address = :tempAddress,
          time_in = :timeIn,
          time_out = :timeOut,
          visit_date = :visitDate,
          purpose = :purpose,
          status = :status,
          updated_at = NOW()
        WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `, {
        id,
        companyId,
        branchId, branchIdsStr,
        visitorName,
        phoneNumber: phoneNumber || null,
        organisation: organisation || null,
        departmentVisited: departmentVisited || null,
        tempAddress: tempAddress || null,
        timeIn: timeIn || null,
        timeOut: timeOut || null,
        visitDate,
        purpose: purpose || null,
        status: status || (timeOut ? "COMPLETED" : "ACTIVE"),
      });
      
      res.json({ message: "Visitor record updated successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// Delete visitor entry
router.delete(
  "/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SERVICE.VISITORS.MANAGE", "SERVICE.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { id } = req.params;
      
      const existing = await query(`
        SELECT id FROM svc_visitors_log 
        WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `, { id, companyId, branchId, branchIdsStr });
      
      if (!existing || existing.length === 0) {
        return res.status(404).json({ message: "Visitor record not found" });
      }
      
      await query(`
        DELETE FROM svc_visitors_log 
        WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `, { id, companyId, branchId, branchIdsStr });
      
      res.json({ message: "Visitor record deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// Get dashboard stats
router.get(
  "/dashboard/stats",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SERVICE.VISITORS.VIEW", "SERVICE.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      
      const stats = await query(`
        SELECT 
          COUNT(*) AS total_visitors,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_visitors,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_visits,
          SUM(CASE WHEN visit_date = CURDATE() THEN 1 ELSE 0 END) AS today_visitors
        FROM svc_visitors_log
        WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `, { companyId, branchId, branchIdsStr });
      
      const byDepartment = await query(`
        SELECT 
          department_visited AS department,
          COUNT(*) AS count
        FROM svc_visitors_log
        WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND department_visited IS NOT NULL
        GROUP BY department_visited
        ORDER BY count DESC
      `, { companyId, branchId, branchIdsStr });
      
      res.json({ 
        stats: stats[0] || {},
        byDepartment: byDepartment || []
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get report data
router.get(
  "/reports/summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SERVICE.VISITORS.VIEW", "SERVICE.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { from, to, department } = req.query;
      
      const clauses = ["v.company_id = :companyId", "(:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))"];
      const params = { companyId, branchId, branchIdsStr };
      
      if (from) {
        clauses.push("v.visit_date >= :from");
        params.from = from;
      }
      if (to) {
        clauses.push("v.visit_date <= :to");
        params.to = to;
      }
      if (department) {
        clauses.push("v.department_visited = :department");
        params.department = department;
      }
      
      const items = await query(`
        SELECT 
          v.id,
          v.visitor_name,
          v.phone_number,
          v.organisation,
          v.department_visited,
          v.temp_address,
          v.time_in,
          v.time_out,
          v.visit_date,
          v.purpose,
          v.status,
          CASE 
            WHEN v.time_out IS NOT NULL THEN 
              TIMESTAMPDIFF(MINUTE, CONCAT(v.visit_date, ' ', v.time_in), CONCAT(v.visit_date, ' ', v.time_out))
            ELSE NULL
          END AS duration_minutes,
          v.created_at,
          u.username AS created_by_name
        FROM svc_visitors_log v
        LEFT JOIN adm_users u ON u.id = v.created_by
        WHERE ${clauses.join(" AND ")}
        ORDER BY v.visit_date DESC, v.time_in DESC
      `, params);
      
      // Calculate summary metrics
      const summary = {
        total_visitors: items.length,
        active_visitors: items.filter(i => i.status === "ACTIVE").length,
        completed_visits: items.filter(i => i.status === "COMPLETED").length,
        avg_duration: items.length > 0 
          ? Math.round(items.reduce((sum, i) => sum + (i.duration_minutes || 0), 0) / items.filter(i => i.duration_minutes).length || 0)
          : 0
      };
      
      res.json({ items: items || [], summary });
    } catch (err) {
      next(err);
    }
  }
);

// Get unique departments for filter
router.get(
  "/metadata/departments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      
      const departments = await query(`
        SELECT DISTINCT department_visited AS name
        FROM svc_visitors_log
        WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND department_visited IS NOT NULL
        ORDER BY department_visited
      `, { companyId, branchId, branchIdsStr });
      
      res.json({ items: departments.map(d => d.name) });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

