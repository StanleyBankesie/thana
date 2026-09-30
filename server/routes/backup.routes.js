import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runBackup } from "../scripts/backup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.resolve(__dirname, "..", "backups");

const router = express.Router();

// GET /api/backups - List all available backups
router.get("/", async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ backups: [] });
    }
    
    const files = await fs.promises.readdir(BACKUP_DIR);
    const backups = [];
    
    for (const file of files) {
      if (file.endsWith(".zip")) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = await fs.promises.stat(filePath);
        backups.push({
          filename: file,
          type: file.startsWith("db_") ? "Database" : "Uploads",
          size: stats.size,
          createdAt: stats.mtime
        });
      }
    }
    
    // Sort newest first
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ backups });
  } catch (error) {
    console.error("[Backup API] Error listing backups:", error);
    res.status(500).json({ error: "Failed to list backups" });
  }
});

// POST /api/backups/trigger - Trigger manual backup
router.post("/trigger", async (req, res) => {
  try {
    const { localOnly, cloudOnly } = req.body || {};
    // Run backup synchronously for immediate feedback, or asynchronously
    // We will await it to give a definitive response to the admin
    const result = await runBackup(true, !!localOnly, !!cloudOnly);
    res.json({ message: "Backup completed successfully", ...result });
  } catch (error) {
    console.error("[Backup API] Error triggering backup:", error);
    const statusCode =
      error.message.includes("No cloud storage configurations") ||
      error.message.includes("Missing DB env vars")
        ? 400
        : 500;
    res.status(statusCode).json({ error: "Failed to trigger backup", details: error.message });
  }
});

// GET /api/backups/download/:filename - Download specific backup
router.get("/download/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    
    // Prevent directory traversal
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    
    const filePath = path.join(BACKUP_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup file not found" });
    }
    
    res.download(filePath);
  } catch (error) {
    console.error("[Backup API] Error downloading backup:", error);
    res.status(500).json({ error: "Failed to download backup" });
  }
});

// DELETE /api/backups/:filename - Delete specific backup
router.delete("/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Prevent directory traversal
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    
    const filePath = path.join(BACKUP_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup file not found" });
    }
    
    await fs.promises.unlink(filePath);
    res.json({ message: "Backup deleted successfully" });
  } catch (error) {
    console.error("[Backup API] Error deleting backup:", error);
    res.status(500).json({ error: "Failed to delete backup" });
  }
});

export default router;
