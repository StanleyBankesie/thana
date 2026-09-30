/**
 * @file backup.js
 * Deletes backups older than 7 days to conserve disk space.
 * Uploads to AWS S3, Backblaze B2, and Google Drive if configured.
 * Sends email notifications.
 */

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
import mysqldump from "mysqldump";
import dotenv from "dotenv";

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { google } from "googleapis";
import { sendMail } from "../utils/mailer.js";
import { query } from "../db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

import "../utils/loadServerEnv.js";

const BACKUP_DIR = path.join(serverRoot, "backups");
const RETENTION_DAYS = 7;

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function cleanupOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const files = await fsPromises.readdir(BACKUP_DIR);
  const now = Date.now();
  const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  
  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stat = await fsPromises.stat(filePath);
    if (now - stat.mtimeMs > maxAgeMs) {
      console.log(`[Backup] Deleting old backup: ${file}`);
      await fsPromises.unlink(filePath).catch(err => console.error(`Failed to delete ${file}:`, err));
    }
  }
}

async function backupDatabase(timestamp) {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME;
  
  if (!host || !user || password === undefined || !database) {
    throw new Error("Missing DB env vars for backup.");
  }
  
  const sqlFile = path.join(BACKUP_DIR, `db_${timestamp}.sql`);
  console.log(`[Backup] Dumping database to ${sqlFile}`);
  
  await mysqldump({
    connection: { host, port, user, password, database },
    dumpToFile: sqlFile,
  });
  console.log(`[Backup] Database dump complete!`);
  
  return sqlFile;
}



function compressFile(sourceFile, outPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(sourceFile)) return resolve();
    try {
      const zip = new AdmZip();
      zip.addLocalFile(sourceFile);
      zip.writeZip(outPath);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// Upload to S3 or Backblaze B2 (Generic S3 compatible upload)
async function uploadToS3Compatible(filePath, fileName, config, providerName) {
  try {
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error(`[Backup] ${providerName} configuration missing or incomplete. Please check your cloud storage settings.`);
    }
    
    const s3Config = {
      region: config.region || "us-east-1",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true // Needed for many S3-compatible providers
    };
    
    if (config.endpoint) {
      let endpointUrl = config.endpoint;
      if (!/^https?:\/\//i.test(endpointUrl)) {
        endpointUrl = 'https://' + endpointUrl;
      }
      s3Config.endpoint = endpointUrl;
    }
    
    const s3Client = new S3Client(s3Config);
    const fileStream = fs.createReadStream(filePath);
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: `backups/${fileName}`,
      Body: fileStream,
    });
    
    console.log(`[Backup] Uploading ${fileName} to ${providerName} bucket ${config.bucket}...`);
    await s3Client.send(command);
    console.log(`[Backup] Successfully uploaded ${fileName} to ${providerName}.`);
    return true;
  } catch (err) {
    console.error(`[Backup] Failed to upload to ${providerName}:`, err.message);
    throw new Error(`Failed to upload to ${providerName}: ${err.message}`);
  }
}

// Upload to Google Drive
async function uploadToGoogleDrive(filePath, fileName, config) {
  try {
    if (!config.clientEmail || !config.privateKey || !config.folderId) {
      throw new Error("[Backup] Google Drive configuration missing or incomplete. Please check your cloud storage settings.");
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
      name: fileName,
      parents: [config.folderId]
    };
    
    const media = {
      body: fs.createReadStream(filePath)
    };
    
    console.log(`[Backup] Uploading ${fileName} to Google Drive...`);
    await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });
    console.log(`[Backup] Successfully uploaded ${fileName} to Google Drive.`);
    return true;
  } catch (err) {
    console.error(`[Backup] Failed to upload to Google Drive:`, err.message);
    throw new Error(`Failed to upload to Google Drive: ${err.message}`);
  }
}

// Cleanup cloud backups older than 10 days
async function cleanupS3CompatibleOldFiles(config, providerName) {
  try {
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) return;
    
    const s3Config = {
      region: config.region || "us-east-1",
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true
    };
    if (config.endpoint) {
      let endpointUrl = config.endpoint;
      if (!/^https?:\/\//i.test(endpointUrl)) endpointUrl = 'https://' + endpointUrl;
      s3Config.endpoint = endpointUrl;
    }
    
    const s3Client = new S3Client(s3Config);
    const listCommand = new ListObjectsV2Command({ Bucket: config.bucket, Prefix: "backups/" });
    const response = await s3Client.send(listCommand);
    if (!response.Contents) return;
    
    const now = Date.now();
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
    
    for (const object of response.Contents) {
      const ageMs = now - object.LastModified.getTime();
      if (ageMs > tenDaysMs) {
        console.log(`[Backup] Deleting old cloud backup from ${providerName}: ${object.Key}`);
        const deleteCommand = new DeleteObjectCommand({ Bucket: config.bucket, Key: object.Key });
        await s3Client.send(deleteCommand);
      }
    }
  } catch (err) {
    console.error(`[Backup] Failed to cleanup old files in ${providerName}:`, err.message);
  }
}

async function cleanupGoogleDriveOldFiles(config) {
  try {
    if (!config.clientEmail || !config.privateKey || !config.folderId) return;
    
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: config.clientEmail, private_key: config.privateKey.replace(/\\n/g, '\n') },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth });
    
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const q = `'${config.folderId}' in parents and modifiedTime < '${tenDaysAgo}' and trashed = false`;
    
    const response = await drive.files.list({ q: q, fields: 'files(id, name)' });
    const files = response.data.files || [];
    
    for (const file of files) {
      console.log(`[Backup] Deleting old Google Drive backup: ${file.name}`);
      await drive.files.delete({ fileId: file.id });
    }
  } catch (err) {
    console.error(`[Backup] Failed to cleanup old Google Drive files:`, err.message);
  }
}

export async function runBackup(isManual = false, localOnly = false, cloudOnly = false) {
  const triggerType = isManual ? "Manual" : "Scheduled";
  console.log(`[Backup] Starting ${triggerType} backup process at ${new Date().toISOString()}`);
  
  let successFiles = [];
  
  // 0. Fetch cloud storage configs from DB
  let dbConfig = {};
  try {
    const rows = await query(`
      SELECT setting_key, setting_value FROM adm_system_settings 
      WHERE setting_key LIKE 'BACKUP_%' AND (company_id IS NULL OR company_id = 1)
    `);
    for (const r of rows) {
      dbConfig[r.setting_key] = r.setting_value;
    }
  } catch (err) {
    console.log("[Backup] Could not fetch DB config, falling back to process.env. Error:", err.message);
  }

  // AWS S3 config
  const s3Config = {
    bucket: dbConfig.BACKUP_S3_BUCKET || process.env.S3_BUCKET,
    region: dbConfig.BACKUP_S3_REGION || process.env.S3_REGION,
    endpoint: dbConfig.BACKUP_S3_ENDPOINT || process.env.S3_ENDPOINT,
    accessKeyId: dbConfig.BACKUP_S3_ACCESS_KEY || process.env.S3_ACCESS_KEY,
    secretAccessKey: dbConfig.BACKUP_S3_SECRET_KEY || process.env.S3_SECRET_KEY
  };

  // Backblaze B2 config
  const b2Config = {
    bucket: dbConfig.BACKUP_B2_BUCKET || process.env.B2_BUCKET,
    endpoint: dbConfig.BACKUP_B2_ENDPOINT || process.env.B2_ENDPOINT,
    accessKeyId: dbConfig.BACKUP_B2_ACCESS_KEY || process.env.B2_ACCESS_KEY,
    secretAccessKey: dbConfig.BACKUP_B2_SECRET_KEY || process.env.B2_SECRET_KEY
  };

  // Google Drive config
  const gdriveConfig = {
    clientEmail: dbConfig.BACKUP_GDRIVE_CLIENT_EMAIL || process.env.GDRIVE_CLIENT_EMAIL,
    folderId: dbConfig.BACKUP_GDRIVE_FOLDER_ID || process.env.GDRIVE_FOLDER_ID,
    privateKey: dbConfig.BACKUP_GDRIVE_PRIVATE_KEY || process.env.GDRIVE_PRIVATE_KEY
  };
  
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      await fsPromises.mkdir(BACKUP_DIR, { recursive: true });
    }
    
    const timestamp = ts();
    
    // 1. Database Backup
    const sqlFile = await backupDatabase(timestamp);
    const dbZipName = `db_${timestamp}.zip`;
    const sqlZipFile = path.join(BACKUP_DIR, dbZipName);
    console.log(`[Backup] Compressing database to ${sqlZipFile}`);
    await compressFile(sqlFile, sqlZipFile);
    await fsPromises.unlink(sqlFile); // Remove raw SQL file after zipping
    
    successFiles.push(dbZipName);
    
    // 1b. Upload DB to Cloud
    if (!localOnly) {
      let uploadedToAny = false;
      if (s3Config.bucket && s3Config.accessKeyId) { await uploadToS3Compatible(sqlZipFile, dbZipName, s3Config, "AWS S3"); uploadedToAny = true; }
      if (b2Config.bucket && b2Config.accessKeyId) { await uploadToS3Compatible(sqlZipFile, dbZipName, b2Config, "Backblaze B2"); uploadedToAny = true; }
      if (gdriveConfig.clientEmail && gdriveConfig.folderId) { await uploadToGoogleDrive(sqlZipFile, dbZipName, gdriveConfig); uploadedToAny = true; }
      
      if (!uploadedToAny) {
        throw new Error("No cloud storage configurations found. Please configure at least one cloud provider in Settings.");
      }
    }
    
    // Removed uploads backup as per user request
    // If cloudOnly is selected, delete the local zips
    if (cloudOnly) {
      console.log(`[Backup] Cloud Only selected. Deleting local backups...`);
      if (fs.existsSync(sqlZipFile)) await fsPromises.unlink(sqlZipFile);
      successFiles = successFiles.map(f => f + " (Cloud Only)");
    } else {
      // 3. Cleanup old local backups if we keep them locally
      await cleanupOldBackups();
    }
    
    console.log(`[Backup] ${triggerType} completed successfully.`);
    
    // 4. Send Success Email
    if (process.env.ADMIN_EMAIL) {
      try {
        await sendMail({
          to: process.env.ADMIN_EMAIL,
          subject: `[Success] ${triggerType} System Backup`,
          text: `The ${triggerType.toLowerCase()} system backup completed successfully at ${new Date().toLocaleString()}.\n\nFiles backed up:\n- ${successFiles.join("\n- ")}`
        });
      } catch (mailErr) {
        console.error(`[Backup] Failed to send success email:`, mailErr.message);
      }
    }
    
    // 5. Cleanup 10-day old cloud backups
    if (!localOnly) {
      console.log(`[Backup] Checking for cloud backups older than 10 days to delete...`);
      if (s3Config.bucket && s3Config.accessKeyId) await cleanupS3CompatibleOldFiles(s3Config, "AWS S3");
      if (b2Config.bucket && b2Config.accessKeyId) await cleanupS3CompatibleOldFiles(b2Config, "Backblaze B2");
      if (gdriveConfig.clientEmail && gdriveConfig.folderId) await cleanupGoogleDriveOldFiles(gdriveConfig);
    }
    
    return { success: true, files: successFiles };
  } catch (error) {
    console.error(`[Backup] ${triggerType} Failed:`, error);
    
    // Send Failure Email
    if (process.env.ADMIN_EMAIL) {
      try {
        await sendMail({
          to: process.env.ADMIN_EMAIL,
          subject: `[FAILED] ${triggerType} System Backup`,
          text: `The ${triggerType.toLowerCase()} system backup FAILED at ${new Date().toLocaleString()}.\n\nError details:\n${error.message || error}\n\nPlease check the server logs immediately.`
        });
      } catch (mailErr) {
        console.error(`[Backup] Failed to send failure email:`, mailErr.message);
      }
    }
    
    throw error;
  }
}

// Allow running directly via `node backup.js`
if (process.argv[1] && process.argv[1].endsWith("backup.js")) {
  runBackup(true).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
