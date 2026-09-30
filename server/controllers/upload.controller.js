/**
 * @file upload.controller.js
 * @description Controller for file uploads, primarily handling Cloudinary integration and local fallback.
 */
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { query } from "../db/pool.js";

/**
 * Ensures the local uploads directory exists, creating it if necessary.
 * 
 * @returns {string} The absolute path to the uploads directory.
 */
export const ensureUploadDir = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = path.join(__dirname, "../../uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

/**
 * Retrieves a system setting value from the database, falling back through branch/company hierarchy.
 *
 * @param {string} key - The setting key to look up.
 * @param {number|null} companyId - Optional company ID.
 * @param {number|null} branchId - Optional branch ID.
 * @returns {Promise<string|null>} The setting value or null.
 */
async function getSystemSetting(key, companyId = null, branchId = null) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS adm_system_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NULL,
        branch_id BIGINT UNSIGNED NULL,
        setting_key VARCHAR(150) NOT NULL,
        setting_value TEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_setting (company_id, branch_id, setting_key),
        KEY idx_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch {}
  const rows = await query(`
    SELECT setting_value
         FROM adm_system_settings
         WHERE setting_key = :key 
      AND (company_id = :companyId OR company_id IS NULL)
      AND (branch_id = :branchId OR branch_id IS NULL)
    ORDER BY company_id DESC, branch_id DESC
    LIMIT 1
    `,
    {
      key,
      companyId: companyId ?? null,
      branchId: branchId ?? null,
    },
  ).catch(() => []);
  return rows?.[0]?.setting_value || null;
}

/**
 * Fetches Cloudinary configuration settings from the system database.
 *
 * @param {object} scope - The request scope containing companyId and branchId.
 * @returns {Promise<object|null>} Cloudinary config object or null if incomplete.
 */
async function getCloudinaryConfig(scope) {
  const companyId = scope?.companyId ?? null;
  const branchId = scope?.branchId ?? null;
  const cloud_name =
    process.env.CLOUDINARY_CLOUD_NAME ||
    (await getSystemSetting("CLOUDINARY_CLOUD_NAME", companyId, branchId));
  const api_key =
    process.env.CLOUDINARY_API_KEY ||
    (await getSystemSetting("CLOUDINARY_API_KEY", companyId, branchId));
  const api_secret =
    process.env.CLOUDINARY_API_SECRET ||
    (await getSystemSetting("CLOUDINARY_API_SECRET", companyId, branchId));
  const folder =
    process.env.CLOUDINARY_UPLOAD_FOLDER ||
    (await getSystemSetting("CLOUDINARY_UPLOAD_FOLDER", companyId, branchId)) ||
    null;
  if (cloud_name && api_key && api_secret) {
    return { cloud_name, api_key, api_secret, folder };
  }
  return null;
}

/**
 * Handles file uploads, preferring Cloudinary if configured, otherwise falls back to local uploads directory.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const reqFolder = req.body?.folder || req.query?.folder || null;
    
    // Attempt Cloudinary upload if configured
    const cfg = await getCloudinaryConfig(req.scope || {});
    if (cfg) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const paramsToSign = new URLSearchParams();
        paramsToSign.append("timestamp", String(timestamp));
        const finalFolder = reqFolder || cfg.folder;
        if (finalFolder) paramsToSign.append("folder", finalFolder);
        const signatureBase = Array.from(paramsToSign.entries())
          .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
          .map(([k, v]) => `${k}=${v}`)
          .join("&");
        const signature = crypto
          .createHash("sha1")
          .update(signatureBase + cfg.api_secret)
          .digest("hex");
        // Cloudinary accepts base64 data URIs in x-www-form-urlencoded
        const buffer = fs.readFileSync(req.file.path);
        const base64 = buffer.toString("base64");
        const dataUri = `data:${req.file.mimetype || "application/octet-stream"};base64,${base64}`;
        const form = new URLSearchParams();
        form.append("file", dataUri);
        form.append("api_key", cfg.api_key);
        form.append("timestamp", String(timestamp));
        form.append("signature", signature);
        if (finalFolder) form.append("folder", finalFolder);
        const endpoint = `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/auto/upload`;
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        });
        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          throw new Error(
            `Cloudinary upload failed: ${resp.status} ${resp.statusText} ${t}`,
          );
        }
        const data = await resp.json();
        const secureUrl = data.secure_url || data.url || null;
        res.json({
          message: "File uploaded successfully",
          url: secureUrl,
          path: secureUrl,
          filename: req.file.originalname || req.file.filename,
          public_id: data.public_id || null,
          resource_type: data.resource_type || null,
        });
        // Cleanup local temp file
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
        return;
      } catch (e) {
        console.warn("Cloudinary upload failed, falling back to local file storage:", e.message);
      }
    }
    
    // Fallback: local file storage
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({
      message: "File uploaded successfully",
      url: fileUrl,
      path: fileUrl,
      filename: req.file.originalname || req.file.filename,
    });
  } catch (e) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    next(e);
  }
};
