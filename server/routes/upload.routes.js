import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ensureUploadDir, uploadFile } from "../controllers/upload.controller.js";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";

const router = express.Router();

// Ensure uploads directory exists via controller utility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = ensureUploadDir();

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'file-' + uniqueSuffix + ext);
  },
});

// File filter (validates extension + mimetype against dangerous extensions)
const fileFilter = (req, file, cb) => {
  const dangerousExts = [
    ".php", ".php3", ".php4", ".php5", ".phtml", ".phar",
    ".exe", ".dll", ".bat", ".cmd", ".sh", ".cgi", ".pl",
    ".js", ".jsp", ".asp", ".aspx", ".vbs", ".html", ".htm",
    ".svg", ".htaccess", ".htpasswd"
  ];
  
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ext || dangerousExts.includes(ext)) {
    return cb(new Error("Dangerous or unsupported file extension"), false);
  }

  const allowed = [
    'image/',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  if (allowed.some((p) => file.mimetype.startsWith(p) || file.mimetype === p)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Route: POST /api/upload
// Requires auth so company/branch scope is available for Cloudinary config
router.post(
  '/',
  requireAuth,
  requireCompanyScope,
  upload.single('file'),
  (req, res, next) => uploadFile(req, res, next),
);

export default router;
