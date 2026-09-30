import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = fs.existsSync(path.join(currentDir, "..", "package.json"))
  ? path.resolve(currentDir, "..")
  : currentDir;

const crashReportCandidates = ["crash_report.txt", "CRASH_REPORT.txt"];
function resolveCrashReportPath() {
  for (const name of crashReportCandidates) {
    const p = path.join(serverRoot, name);
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return path.join(serverRoot, crashReportCandidates[0]);
}

const crashReportPath = resolveCrashReportPath();

function redactSensitive(value, depth = 0) {
  if (depth > 6) return "[Truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    const s = value.trim();
    if (s.length > 2000) return `${s.slice(0, 2000)}…`;
    return s;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactSensitive(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const key = String(k);
      if (/(password|passwd|token|authorization|cookie|secret|refresh)/i.test(key)) {
        out[key] = "[REDACTED]";
        continue;
      }
      out[key] = redactSensitive(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function formatContextLines(context) {
  const safe = redactSensitive(context);
  if (!safe || typeof safe !== "object") return "";
  const keys = Object.keys(safe);
  if (!keys.length) return "";
  const lines = [];
  for (const key of keys) {
    let val = safe[key];
    if (typeof val === "object") {
      try {
        val = JSON.stringify(val);
      } catch {
        val = "[Unserializable]";
      }
    }
    lines.push(`${key}: ${String(val)}`);
  }
  return lines.join("\n");
}

function enforceSizeLimit(filePath) {
  const maxBytes = Math.max(
    256 * 1024,
    Number(process.env.CRASH_REPORT_MAX_BYTES || 2 * 1024 * 1024),
  );
  const keepBytes = Math.max(
    128 * 1024,
    Number(process.env.CRASH_REPORT_KEEP_BYTES || 1024 * 1024),
  );
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    if (stat.size <= maxBytes) return;
    const start = Math.max(0, stat.size - keepBytes);
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      fs.writeFileSync(filePath, buf.toString("utf8"), "utf8");
    } finally {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  } catch {}
}

/**
 * Appends an error log to the CRASH_REPORT.txt file.
 * @param {string} type - The type of error (e.g. "UncaughtException", "UnhandledRejection", "HTTP_500")
 * @param {Error|string} err - The error object or string to log
 * @param {Object} [context] - Additional context to log (like URL, method, etc)
 */
export function logToCrashReport(type, err, context = {}) {
  try {
    const timestamp = new Date().toISOString();
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "(no stack)";
    const safeContext = redactSensitive(context);
    const ctxLines = formatContextLines(safeContext);

    let logEntry = `\n[${timestamp}] ${String(type || "ERROR")}\n`;
    logEntry += `Summary: ${msg || "Unknown error"}\n`;
    if (safeContext && typeof safeContext === "object") {
      const method = safeContext.method ? String(safeContext.method) : "";
      const url = safeContext.url ? String(safeContext.url) : "";
      const status = safeContext.status ? String(safeContext.status) : "";
      if (method || url || status) {
        logEntry += `Request: ${[method, url].filter(Boolean).join(" ")}${status ? ` (status ${status})` : ""}\n`;
      }
    }
    if (ctxLines) {
      logEntry += `Context:\n${ctxLines}\n`;
    }
    if (stack && String(stack).trim()) {
      logEntry += `Technical details:\n${stack}\n`;
    }
    logEntry += `${"-".repeat(80)}\n`;

    enforceSizeLimit(crashReportPath);
    fs.appendFileSync(crashReportPath, logEntry, "utf8");
  } catch (appendErr) {
    console.error("Failed to write to CRASH_REPORT.txt:", appendErr);
  }
}
