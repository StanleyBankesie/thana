/**
 * @fileoverview Build script for the server application. Copies relevant files
 * from the source directory to the dist directory, ignoring specific files and directories.
 * Also includes the frontend build (client/dist) into dist/public.
 * @module scripts/build
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Directories to ignore during copy
const excludedDirs = new Set([".git", "node_modules", "scratch"]);
// Specific environment files to ignore
const excludedFiles = new Set([
  ".env",
  ".env.local",
  "server.env",
  "server.env.local",
]);
// File name patterns to ignore (e.g., logs, debug files)
const excludedFilePatterns = [
  /\.log$/i,
  /^debug_.*\.(txt|log)$/i,
  /^db_check.*\.txt$/i,
  /^\.trae_.*\.txt$/i,
];

/**
 * Recursively copies a directory and its contents from the source to the destination,
 * excluding predefined files, patterns, and directories.
 *
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 * @returns {Promise<void>} Resolves when the directory has been copied.
 */
async function copyDir(src, dest) {
  // Create destination directory if it doesn't exist
  await fs.mkdir(dest, { recursive: true });
  // Iterate through directory contents
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    // Skip excluded directories
    if (entry.isDirectory() && excludedDirs.has(entry.name)) {
      continue;
    }
    if (entry.isFile() && excludedFiles.has(entry.name)) {
      continue;
    }
    // Skip files matching excluded patterns
    if (
      entry.isFile() &&
      excludedFilePatterns.some((pattern) => pattern.test(entry.name))
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

/**
 * Copies the entire contents of a directory without exclusions.
 *
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 * @returns {Promise<void>} Resolves when the directory has been copied.
 */
async function copyDirFull(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirFull(s, d);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

/**
 * Main build execution function. Removes the existing dist directory and triggers the copy.
 *
 * @returns {Promise<void>} Resolves when the build is complete.
 */
// Main build process orchestration
async function run() {
  // Resolve source and destination directories
  const srcDir = path.resolve(__dirname, "../");
  const distDir = path.resolve(__dirname, "../../dist");
  try {
    await fs.rm(distDir, { recursive: true, force: true });
  } catch {}
  await copyDir(srcDir, distDir);

  // Copy client/dist into dist/public so the frontend is served in production
  const clientDistDir = path.resolve(__dirname, "../../client/dist");
  const destPublic = path.join(distDir, "public");
  try {
    await fs.access(clientDistDir);
    await copyDirFull(clientDistDir, destPublic);
    process.stdout.write(
      `frontend copied: ${clientDistDir} → ${destPublic}\n`,
    );
  } catch {
    process.stderr.write(
      `WARNING: client/dist not found at ${clientDistDir}. ` +
        `Run "npm run build" in the client directory first.\n`,
    );
  }

  process.stdout.write("dist ready\n");
}
run().catch((e) => {
  process.stderr.write(String(e && e.message ? e.message : e));
  process.exit(1);
});

