/**
 * @fileoverview Document templates routes.
 * Handles endpoints for creating, updating, listing, and managing HTML
 * templates for various document types (e.g., invoices, sales orders, etc.).
 */
import express from "express";
import sanitizeHtml from "sanitize-html";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { ensureTemplateTables, toNumber } from "../utils/dbUtils.js";

const router = express.Router();

function canonicalDocumentType(type) {
  const t = String(type || "")
    .trim()
    .toLowerCase();
  if (
    t === "general-template" ||
    t === "general template" ||
    t === "general_template" ||
    t === "general" ||
    t === "header" ||
    t === "report-header"
  ) {
    return "general-template";
  }
  if (
    t === "sales-order" ||
    t === "sales order" ||
    t === "sales_order" ||
    t === "so"
  ) {
    return "sales-order";
  }
  if (
    t === "invoice" ||
    t === "sales-invoice" ||
    t === "sales invoice" ||
    t === "sales_invoice"
  ) {
    return "invoice";
  }
  if (
    t === "delivery-note" ||
    t === "delivery note" ||
    t === "delivery_note" ||
    t === "dn"
  ) {
    return "delivery-note";
  }
  if (t === "quotation" || t === "quote" || t === "sales-quotation") {
    return "quotation";
  }
  if (
    t === "salary-slip" ||
    t === "salary slip" ||
    t === "salary_slip" ||
    t === "salaryslip" ||
    t === "ss" ||
    t === "payslip" ||
    t === "pay slip" ||
    t === "pay-slip" ||
    t === "pay_slip"
  ) {
    return "salary-slip";
  }
  return String(type || "").trim();
}

function docTypeSynonymsLower(type) {
  const c = canonicalDocumentType(type).toLowerCase();
  if (c === "general-template") {
    return [
      "general-template",
      "general template",
      "general_template",
      "general",
      "header",
      "report-header",
      "report header",
    ];
  }
  if (c === "sales-order") {
    return [
      "sales-order",
      "sales order",
      "sales_order",
      "sales-orders",
      "sales orders",
      "sales_orders",
      "salesorder",
      "salesorders",
      "salesorder(s)",
      "so",
      "sales_order(s)",
      "sales-order(s)",
      "sales order(s)",
      "sales order document",
    ];
  }
  if (c === "invoice") {
    return [
      "invoice",
      "invoices",
      "sales-invoice",
      "sales invoice",
      "sales_invoice",
      "sales-invoices",
      "sales invoices",
      "sales_invoices",
      "salesinvoice",
      "salesinvoices",
      "sales invoice document",
    ];
  }
  if (c === "delivery-note") {
    return [
      "delivery-note",
      "delivery note",
      "delivery_note",
      "delivery-notes",
      "delivery notes",
      "delivery_notes",
      "deliverynote",
      "deliverynotes",
      "dn",
      "delivery note document",
    ];
  }
  if (c === "quotation") {
    return [
      "quotation",
      "quotations",
      "sales-quotation",
      "sales quotation",
      "sales_quotation",
      "sales-quotations",
      "sales quotations",
      "sales_quotations",
      "quote",
      "quotes",
      "sales quote",
      "sales quotes",
      "sales_quote",
      "sales_quote(s)",
      "quotation document",
    ];
  }
  if (c === "salary-slip") {
    return [
      "salary-slip",
      "salary slip",
      "salary_slip",
      "salaryslip",
      "ss",
      "salary slip document",
      "payslip",
      "pay slip",
      "pay-slip",
      "pay_slip",
      "payslips",
      "pay slips",
      "pay-slips",
      "pay_slips",
    ];
  }
  return [c];
}

router.get(
  "/:documentType",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const document_type = String(req.params.documentType || "").trim();
      const template_name = req.query.name
        ? String(req.query.name).trim()
        : null;
      if (!document_type)
        throw httpError(400, "VALIDATION_ERROR", "Invalid type");
      // Search by synonyms (case-insensitive) so admin can see templates even if type naming differs
      const aliases = docTypeSynonymsLower(document_type);
      const placeholders = aliases.map((_, i) => `:dt${i}`).join(", ");
      const params = { companyId, branchId, branchIdsStr };
      aliases.forEach((val, i) => (params[`dt${i}`] = val));

      // Build WHERE clause - add name filter if provided
      let whereClause = `WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND LOWER(document_type) IN (${placeholders})`;
      if (template_name) {
        whereClause += ` AND LOWER(name) = :templateName`;
        params.templateName = template_name.toLowerCase();
      }

      let items = await query(
        `SELECT id, name, document_type, feature_names, is_default, created_at, updated_at,
          u.username AS created_by_name
         FROM document_templates
          ${whereClause}
        LEFT JOIN adm_users u ON u.id = created_by
         ORDER BY is_default DESC, updated_at DESC`,
        params,
      ).catch(() => []);
      // Parse feature_names for each item
      if (Array.isArray(items)) {
        for (const it of items) {
          try {
            const raw = it.feature_names || "[]";
            it.feature_names = typeof raw === "string" ? JSON.parse(raw) : raw;
          } catch {
            it.feature_names = [];
          }
        }
      }

      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/item/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [item] = await query(
        `SELECT id, name, document_type, html_content, feature_names, is_default, created_at, updated_at,
                header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!item) throw httpError(404, "NOT_FOUND", "Template not found");
      try {
        const raw = item.feature_names || "[]";
        item.feature_names = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        item.feature_names = [];
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("ADMIN.TEMPLATES.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const {
        name,
        document_type,
        html_content,
        is_default,
        header_logo_url,
        header_name,
        header_address,
        header_address2,
        header_phone,
        header_email,
        header_website,
        feature_names,
      } = req.body || {};
      const n = String(name || "").trim();
      const dt = String(document_type || "").trim();
      const rawHtml = String(html_content || "");
      if (!n || !dt || !rawHtml)
        throw httpError(400, "VALIDATION_ERROR", "Missing fields");
      const sanitized = sanitizeHtml(rawHtml, {
        allowedTags: false, // Allow all tags for document templates as they are Admin-only and require full document structure
        allowedAttributes: false, // Allow all attributes
        allowVulnerableTags: true,
      });

      const result = await query(
        `INSERT INTO document_templates 
               (company_id, branch_id, name, document_type, html_content, is_default, created_by,
                header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                feature_names) 
             VALUES 
               (:companyId, :branchId, :n, :dt, :sanitized, :is_default, :userId,
                :header_logo_url, :header_name, :header_address, :header_address2, :header_phone, :header_email, :header_website,
                :feature_names)`,
        {
          companyId,
          branchId, branchIdsStr,
          n,
          dt,
          sanitized,
          is_default: Number(Boolean(is_default)),
          userId: req.user?.id || null,
          header_logo_url: header_logo_url ? String(header_logo_url) : null,
          header_name: header_name ? String(header_name) : null,
          header_address: header_address ? String(header_address) : null,
          header_address2: header_address2 ? String(header_address2) : null,
          header_phone: header_phone ? String(header_phone) : null,
          header_email: header_email ? String(header_email) : null,
          header_website: header_website ? String(header_website) : null,
          feature_names: Array.isArray(feature_names)
            ? JSON.stringify(feature_names)
            : "[]",
        },
      );
      if (Number(Boolean(is_default))) {
        await query(
          `UPDATE document_templates 
             SET is_default = 0 
           WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND document_type = :dt AND id <> :id`,
          { companyId, branchId, dt, id: result.insertId },
        );
      }
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("ADMIN.TEMPLATES.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const {
        name,
        html_content,
        is_default,
        header_logo_url,
        header_name,
        header_address,
        header_address2,
        header_phone,
        header_email,
        header_website,
        feature_names,
      } = req.body || {};
      const n = String(name || "").trim();
      const rawHtml = typeof html_content === "string" ? html_content : null;
      const [existing] = await query(
        `SELECT id, name, html_content, document_type, feature_names, is_default,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Template not found");
      const dt = existing.document_type;
      const newName = n || existing.name;
      const sanitized =
        rawHtml != null
          ? sanitizeHtml(String(rawHtml), {
              allowedTags: false, // Allow all tags for document templates
              allowedAttributes: false, // Allow all attributes
              allowVulnerableTags: true,
            })
          : existing.html_content;

      const result = await query(
        `UPDATE document_templates 
           SET name = :newName, html_content = :sanitized, is_default = :is_default,
               header_logo_url = :header_logo_url,
               header_name = :header_name,
               header_address = :header_address,
               header_address2 = :header_address2,
               header_phone = :header_phone,
               header_email = :header_email,
               header_website = :header_website,
               feature_names = :feature_names
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          newName,
          sanitized,
          is_default: Number(Boolean(is_default)),
          header_logo_url:
            header_logo_url !== undefined
              ? String(header_logo_url || "")
              : existing.header_logo_url || null,
          header_name:
            header_name !== undefined
              ? String(header_name || "")
              : existing.header_name || null,
          header_address:
            header_address !== undefined
              ? String(header_address || "")
              : existing.header_address || null,
          header_address2:
            header_address2 !== undefined
              ? String(header_address2 || "")
              : existing.header_address2 || null,
          header_phone:
            header_phone !== undefined
              ? String(header_phone || "")
              : existing.header_phone || null,
          header_email:
            header_email !== undefined
              ? String(header_email || "")
              : existing.header_email || null,
          header_website:
            header_website !== undefined
              ? String(header_website || "")
              : existing.header_website || null,
          feature_names: feature_names !== undefined
            ? Array.isArray(feature_names)
              ? JSON.stringify(feature_names)
              : "[]"
            : existing.feature_names || "[]",
        },
      );

      if (result.affectedRows === 0) {
        throw httpError(
          404,
          "NOT_FOUND",
          "Template not found or no changes made (check branch scope)",
        );
      }

      if (Number(Boolean(is_default))) {
        await query(
          `UPDATE document_templates 
             SET is_default = 0 
           WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND document_type = :dt AND id <> :id`,
          { companyId, branchId, dt, id },
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("ADMIN.TEMPLATES.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [existing] = await query(
        `SELECT id, is_default,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Template not found");
      if (Number(existing.is_default) === 1)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Default template cannot be deleted",
        );
      await query(
        `DELETE FROM document_templates WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { id, companyId, branchId, branchIdsStr },
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
