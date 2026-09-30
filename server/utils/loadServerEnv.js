import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let dotenv = null;
try {
  dotenv = require("dotenv");
} catch (e) {
  // dotenv module not found, fallback parser will be used
}

let loaded = false;

function parseEnvContent(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      result[key] = val;
    }
  }
  return result;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  if (dotenv && typeof dotenv.parse === "function") {
    try {
      return dotenv.parse(fs.readFileSync(filePath, "utf8")) || {};
    } catch {
      return {};
    }
  } else {
    try {
      return parseEnvContent(fs.readFileSync(filePath, "utf8"));
    } catch {
      return {};
    }
  }
}

function resolveServerRoot(metaUrl) {
  // Determine the server root directory by checking for the presence of package.json
  const currentDir = path.dirname(fileURLToPath(metaUrl));
  if (fs.existsSync(path.join(currentDir, "package.json"))) {
    return currentDir;
  }
  return path.resolve(currentDir, "..");
}

function loadIfExists(filePath, override = false) {
  // Helper function to conditionally load a .env file if it exists on disk
  if (!fs.existsSync(filePath)) return;
  if (dotenv && typeof dotenv.config === "function") {
    dotenv.config({ path: filePath, override });
  } else {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = parseEnvContent(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (override || process.env[k] === undefined) {
          process.env[k] = v;
        }
      }
    } catch (err) {
      console.warn(`[loadServerEnv] Failed reading ${filePath}:`, err.message);
    }
  }
}

/**
 * Loads environment variables from a .env file located at or above the given module path.
 *
 * @param {string} [metaUrl=import.meta.url] - The meta URL of the caller module to start the search from.
 * @returns {void}
 */
export function loadServerEnv(metaUrl = import.meta.url) {
  // Prevent multiple executions of the environment loader
  if (loaded) return;

  const runtimeNodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
  const runtimeIsProd = runtimeNodeEnv === "production";

  const serverRoot = resolveServerRoot(metaUrl);

  // Define file paths for base, local, and production environment configurations
  const baseCandidates = [
    path.join(serverRoot, "server.env"),
    path.join(serverRoot, ".env"),
  ];
  const localCandidates = [
    path.join(serverRoot, "server.env.local"),
    path.join(serverRoot, ".env.local"),
  ];
  const prodCandidates = [
    path.join(serverRoot, "server.env.production"),
    path.join(serverRoot, ".env.production"),
  ];



  // Load base environment variable files without overriding existing ones
  for (const filePath of baseCandidates) {
    loadIfExists(filePath, false);
  }

  const baseNodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
  const baseIsProd = baseNodeEnv === "production";

  const hasLocalEnvFile = localCandidates.some((filePath) =>
    fs.existsSync(filePath),
  );

  // Determine environment overrides by pre-checking .env.local
  let forceLocal =
    !runtimeIsProd && String(process.env.DEV_FORCE_LOCAL_ENV || "").trim() === "1";
  if (!runtimeIsProd && !forceLocal) {
    for (const filePath of localCandidates) {
      if (fs.existsSync(filePath)) {
        const parsedLocal = parseEnvFile(filePath);
        if (String(parsedLocal.DEV_FORCE_LOCAL_ENV || "").trim() === "1") {
          forceLocal = true;
          break;
        }
      }
    }
  }

  const originalPort = process.env.PORT;

  // Pre-check if any production candidate sets NODE_ENV=production
  let prodSetsNodeEnv = false;
  if (!runtimeIsProd) {
    for (const filePath of prodCandidates) {
      if (fs.existsSync(filePath)) {
        const parsedProd = parseEnvFile(filePath);
        if (String(parsedProd.NODE_ENV || "").toLowerCase() === "production") {
          prodSetsNodeEnv = true;
          break;
        }
      }
    }
  }

  const effectiveIsProd = runtimeIsProd || baseIsProd || prodSetsNodeEnv;

  // Conditionally load local or production overrides based on current mode
  if (forceLocal) {
    for (const filePath of localCandidates) {
      loadIfExists(filePath, true);
    }
  } else if (effectiveIsProd) {
    for (const filePath of prodCandidates) {
      loadIfExists(filePath, true);
    }
  } else if (hasLocalEnvFile) {
    for (const filePath of localCandidates) {
      loadIfExists(filePath, true);
    }
  }

  if (originalPort !== undefined && String(originalPort).trim() !== "") {
    process.env.PORT = originalPort;
  }

  loaded = true;
}

loadServerEnv(import.meta.url);
