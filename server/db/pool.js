/**
 * @file pool.js
 * @description Database connection pool management and query utilities.
 */
import mysql from "mysql2/promise";
import fs from "fs";
import "../utils/loadServerEnv.js";

// Environment Variable Utility
// Safely retrieves an environment variable or returns a fallback if undefined.
function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

// Number Parsing Utility
// Parses a number from a value and falls back to a default if invalid or <= 0.
function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Database Configuration
// Collects and parses configuration settings from environment variables.
const dbConfig = {
  host: String(optionalEnv("DB_HOST", "")).trim(),
  user: String(optionalEnv("DB_USER", "")).trim(),
  password:
    process.env.DB_PASSWORD === undefined ? undefined : process.env.DB_PASSWORD,
  database: String(optionalEnv("DB_NAME", "")).trim(),
  port: parseNumber(optionalEnv("DB_PORT", 3306), 3306),
  connectionLimit: parseNumber(optionalEnv("DB_CONNECTION_LIMIT", 50), 50),
  connectTimeout: parseNumber(
    optionalEnv("DB_CONNECT_TIMEOUT_MS", 30000),
    30000,
  ),
  queryTimeout: parseNumber(optionalEnv("DB_QUERY_TIMEOUT_MS", 15000), 15000),
  reconnectCooldownMs: parseNumber(
    optionalEnv("DB_RECONNECT_COOLDOWN_MS", 5000),
    5000,
  ),
};

// Pool Tracking State
// Stores the timestamp when the module was loaded for uptime calculations.
const startupTime = Date.now();

// Tracks the health, errors, and connection attempts of the database.
const dbState = {
  status: "down",
  lastError: null,
  lastErrorAt: null,
  lastSuccessAt: null,
  lastConnectAttemptAt: 0,
  lastConnectLogKey: null,
};

function previewSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function postDebugEvent(hypothesisId, location, msg, data = {}) {
  try {
    let debugServerUrl = "http://127.0.0.1:7777/event";
    let sessionId = "login-db-timeout";
    try {
      const envText = fs.readFileSync(".dbg/login-db-timeout.env", "utf8");
      debugServerUrl =
        envText.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
      sessionId =
        envText.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
    } catch {}
    fetch(debugServerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        runId: "pre-fix",
        hypothesisId,
        location,
        msg,
        data,
        ts: Date.now(),
      }),
    }).catch(() => {});
  } catch {}
}

// Singleton Pool Instances
// activePool holds the current pool, activePoolPromise tracks pending connections.
let activePool = null;
let activePoolPromise = null;

// Query Sanitizer Utility
// Removes audit-related joins or selections (created_by/username) that may cause errors.
function sanitizeCreatedByAuditJoin(sql) {
  if (!sql) return sql;
  let next = String(sql);

  next = next.replace(
    /,\s*(?:[a-z_][a-z0-9_]*\.)?created_at\s*,\s*[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name/gi,
    "",
  );
  next = next.replace(
    /\b(?:[a-z_][a-z0-9_]*\.)?created_at\s*,\s*[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name\s*,\s*/gi,
    "",
  );
  next = next.replace(
    /,\s*[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name/gi,
    "",
  );
  next = next.replace(
    /[a-z_][a-z0-9_]*\.username\s+AS\s+created_by_name\s*,\s*/gi,
    "",
  );
  next = next.replace(
    /\s+(?:LEFT\s+JOIN|JOIN)\s+adm_users\s+[a-z_][a-z0-9_]*\s+ON\s+[a-z_][a-z0-9_]*\.id\s*=\s*(?:[a-z_][a-z0-9_]*\.)?created_by\b/gi,
    "",
  );
  next = next.replace(
    /\s+(?:LEFT\s+JOIN|JOIN)\s+adm_users\s+[a-z_][a-z0-9_]*\s+ON\s+[a-z_][a-z0-9_]*\.id\s*=\s*created_by\b/gi,
    "",
  );
  next = next.replace(/,\s*(FROM)\b/gi, " $1");

  return next;
}

// Database Error Formatter
// Standardizes database error objects to ensure consistent structure for logs and responses.
export function formatDbError(err) {
  if (!err) {
    return {
      code: "DB_UNKNOWN",
      errno: null,
      sqlMessage: null,
      message: "Unknown database error",
      stack: null,
    };
  }

  return {
    code: err.code || "DB_ERROR",
    errno: err.errno ?? null,
    sqlMessage: err.sqlMessage || null,
    message: err.message || String(err),
    stack: err.stack || null,
  };
}

// Database Error Logger
// Outputs formatted error details and stack trace to stderr for debugging.
export function logDbError(context, err) {
  const details = formatDbError(err);
  console.error(`[DB] ${context}`);
  console.error(
    `[DB] code=${details.code} errno=${details.errno ?? "n/a"} sqlMessage=${details.sqlMessage ?? "n/a"}`,
  );
  console.error(`[DB] message=${details.message}`);
  if (details.stack) {
    console.error(details.stack);
  }
}

// State Updaters
// Marks the database state as down and records the error details.
function setDbFailure(err) {
  dbState.status = "down";
  dbState.lastError = formatDbError(err);
  dbState.lastErrorAt = Date.now();
}

// Marks the database state as up and clears any previous errors.
function setDbSuccess() {
  dbState.status = "up";
  dbState.lastSuccessAt = Date.now();
  dbState.lastError = null;
}

// Configuration Validators
// Checks if all required database configuration fields are present.
function isConfigured() {
  return Boolean(
    dbConfig.host &&
    dbConfig.user &&
    dbConfig.database &&
    dbConfig.password !== undefined,
  );
}

// Returns a list of required environment variables that are missing.
function getMissingConfigFields() {
  const missing = [];
  if (!dbConfig.host) missing.push("DB_HOST");
  if (!dbConfig.user) missing.push("DB_USER");
  if (!dbConfig.database) missing.push("DB_NAME");
  if (dbConfig.password === undefined) missing.push("DB_PASSWORD");
  return missing;
}

// Error Factory
// Generates a standardized "Database unavailable" error using the last recorded error.
function createDbUnavailableError(baseError = null) {
  const details = formatDbError(baseError || dbState.lastError);
  const error = new Error(details.message || "Database unavailable");
  error.code = details.code || "DB_UNAVAILABLE";
  error.errno = details.errno ?? null;
  error.sqlMessage = details.sqlMessage || null;
  error.stack = details.stack || error.stack;
  return error;
}

// Connection Logging Utility
// Logs the database connection attempt, avoiding duplicate logs for the same target.
function logDbConnectionTarget() {
  const logKey = `${dbConfig.host}:${dbConfig.port}:${dbConfig.user}:${dbConfig.database}`;
  if (dbState.lastConnectLogKey === logKey) return;
  dbState.lastConnectLogKey = logKey;
  console.log(
    `DB connecting to ${dbConfig.host || "(missing-host)"}:${dbConfig.port} as ${dbConfig.user || "(missing-user)"} db=${dbConfig.database || "(missing-db)"}`,
  );
}

// Pool Factory
// Initializes and returns a new mysql2 pool with the configured settings.
function createPoolInstance() {
  return mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: dbConfig.connectionLimit,
    queueLimit: 0,
    namedPlaceholders: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: dbConfig.connectTimeout,
  });
}

// Pool Destructor
// Safely closes a given database connection pool, ignoring any errors during termination.
async function closePool(poolToClose) {
  if (!poolToClose) return;
  try {
    await poolToClose.end();
  } catch {}
}

// Error Classification
// Determines if an error represents a temporary network or connection failure.
function isReconnectableError(err) {
  const code = String(err?.code || "").toUpperCase();
  return [
    "PROTOCOL_CONNECTION_LOST",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "EPIPE",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
    "POOL_CLOSED",
  ].includes(code);
}

// Determines if an error is related to connection establishment or authentication.
function isDbConnectionFailure(err) {
  const code = String(err?.code || "").toUpperCase();
  return (
    isReconnectableError(err) ||
    [
      "ER_ACCESS_DENIED_ERROR",
      "ER_BAD_DB_ERROR",
      "ER_CON_COUNT_ERROR",
      "ER_NOT_SUPPORTED_AUTH_MODE",
    ].includes(code)
  );
}

// Query Timeout Wrapper
// Executes a promise-based operation with an enforced timeout.
function withQueryTimeout(executor, sqlText) {
  if (!dbConfig.queryTimeout) {
    return executor(); // Skip timeout if not configured
  }

  const startedAt = Date.now();
  let timeoutHandle = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      // #region debug-point E:db-timeout
      postDebugEvent(
        "E",
        "server/db/pool.js:withQueryTimeout",
        "[DEBUG] DB query timeout fired",
        {
          timeoutMs: dbConfig.queryTimeout,
          elapsedMs: Date.now() - startedAt,
          sqlPreview: previewSql(sqlText),
        },
      );
      // #endregion
      const timeoutError = new Error(
        `Database query timeout after ${dbConfig.queryTimeout}ms`,
      );
      timeoutError.code = "DB_QUERY_TIMEOUT";
      timeoutError.sqlMessage = typeof sqlText === "string" ? sqlText : null;
      reject(timeoutError);
    }, dbConfig.queryTimeout);

    // Prevent the timeout from keeping the Node.js event loop alive
    if (typeof timeoutHandle?.unref === "function") {
      timeoutHandle.unref();
    }
  });

  // Race the actual execution against the timeout promise
  return Promise.race([executor(), timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}

// Connection Manager
// Ensures an active database connection pool exists, reconnecting if necessary or forced.
async function ensurePool(forceReconnect = false) {
  if (!isConfigured()) {
    // Fail early if database config is incomplete
    const missing = getMissingConfigFields();
    const configError = new Error(
      `Database not configured: missing ${missing.join(", ")}`,
    );
    configError.code = "DB_NOT_CONFIGURED";
    setDbFailure(configError);
    logDbError("Database configuration invalid", configError);
    return null;
  }

  if (!forceReconnect && activePool) {
    return activePool; // Return existing valid pool
  }

  if (!forceReconnect && activePoolPromise) {
    return activePoolPromise; // Return pending connection promise
  }

  const now = Date.now();
  if (
    !forceReconnect &&
    !activePool &&
    dbState.lastConnectAttemptAt &&
    now - dbState.lastConnectAttemptAt < dbConfig.reconnectCooldownMs
  ) {
    return null; // Enforce cooldown before next reconnect attempt
  }

  dbState.lastConnectAttemptAt = now;

  activePoolPromise = (async () => {
    const previousPool = activePool;
    activePool = null;

    if (forceReconnect) {
      await closePool(previousPool);
      dbState.lastConnectLogKey = null;
    }

    logDbConnectionTarget();

    let candidatePool = null;
    try {
      candidatePool = createPoolInstance();
      const connection = await candidatePool.getConnection();
      try {
        await withQueryTimeout(() => connection.query("SELECT 1"), "SELECT 1");
      } finally {
        connection.release();
      }
      activePool = candidatePool;
      setDbSuccess();
      console.log("DB connected OK");
      return activePool;
    } catch (err) {
      setDbFailure(err);
      logDbError("DB connection failed", err);
      await closePool(candidatePool);
      return null;
    } finally {
      activePoolPromise = null;
    }
  })();

  return activePoolPromise;
}

// Pool Operation Wrapper
// Safely executes operations using the pool and handles reconnection retries.
async function withPoolOperation(operationName, executor, options = {}) {
  const { sqlText = null, retryOnReconnect = true } = options;
  const startedAt = Date.now();
  // #region debug-point C:db-operation-start
  postDebugEvent(
    "C",
    "server/db/pool.js:withPoolOperation",
    "[DEBUG] DB operation start",
    {
      operationName,
      sqlPreview: previewSql(sqlText || operationName),
      poolStatus: activePool
        ? "active"
        : activePoolPromise
          ? "connecting"
          : "empty",
      dbStateStatus: dbState.status,
    },
  );
  // #endregion
  const currentPool = await ensurePool();
  if (!currentPool) {
    // #region debug-point D:pool-unavailable
    postDebugEvent(
      "D",
      "server/db/pool.js:withPoolOperation",
      "[DEBUG] DB pool unavailable",
      {
        operationName,
        sqlPreview: previewSql(sqlText || operationName),
        elapsedMs: Date.now() - startedAt,
        dbStateStatus: dbState.status,
        dbErrorCode: dbState.lastError?.code || null,
        dbErrorMessage: dbState.lastError?.message || null,
      },
    );
    // #endregion
    throw createDbUnavailableError();
  }

  try {
    const result = await withQueryTimeout(
      () => executor(currentPool),
      sqlText || operationName,
    );
    if (operationName === "db-health-check") {
      setDbSuccess();
    }
    // #region debug-point C:db-operation-success
    postDebugEvent(
      "C",
      "server/db/pool.js:withPoolOperation",
      "[DEBUG] DB operation success",
      {
        operationName,
        sqlPreview: previewSql(sqlText || operationName),
        elapsedMs: Date.now() - startedAt,
      },
    );
    // #endregion
    return result;
  } catch (err) {
    // #region debug-point D:db-operation-error
    postDebugEvent(
      "D",
      "server/db/pool.js:withPoolOperation",
      "[DEBUG] DB operation error",
      {
        operationName,
        sqlPreview: previewSql(sqlText || operationName),
        elapsedMs: Date.now() - startedAt,
        errorCode: err?.code || null,
        errorMessage: err?.message || String(err),
      },
    );
    // #endregion
    if (isDbConnectionFailure(err)) {
      setDbFailure(err);
      logDbError(`${operationName} failed`, err);
    }

    if (retryOnReconnect && isReconnectableError(err)) {
      const reconnectedPool = await ensurePool(true);
      if (!reconnectedPool) {
        throw createDbUnavailableError(err);
      }
      return withQueryTimeout(
        () => executor(reconnectedPool),
        sqlText || operationName,
      );
    }

    throw err;
  }
}

// Connection Proxy
// Wraps a raw pool connection to intercept queries and sanitize parameters (e.g., removing undefined).
function wrapConnection(connection) {
  return new Proxy(connection, {
    get(target, prop, receiver) {
      if (prop === "query") {
        return (sql, params) => {
          let cleanParams = params;
          if (params) {
            if (Array.isArray(params)) {
              cleanParams = params.map((v) => (v === undefined ? null : v));
            } else if (typeof params === "object") {
              cleanParams = new Proxy(params, {
                get(target, prop) {
                  if (prop === "branchIdsStr" && target[prop] === undefined)
                    return "";
                  const val = target[prop];
                  return val === undefined ? null : val;
                },
                has(target, prop) {
                  return true;
                },
              });
            }
          }
          return withQueryTimeout(() => target.query(sql, cleanParams), sql);
        };
      }

      if (prop === "execute") {
        return (sql, params) => {
          let cleanParams = params;
          if (params) {
            if (Array.isArray(params)) {
              cleanParams = params.map((v) => (v === undefined ? null : v));
            } else if (typeof params === "object") {
              cleanParams = new Proxy(params, {
                get(target, prop) {
                  if (prop === "branchIdsStr" && target[prop] === undefined)
                    return "";
                  const val = target[prop];
                  return val === undefined ? null : val;
                },
                has(target, prop) {
                  return true;
                },
              });
            }
          }
          return withQueryTimeout(() => target.execute(sql, cleanParams), sql);
        };
      }

      if (prop === "release" || prop === "destroy") {
        return (...args) =>
          Reflect.get(target, prop, receiver).apply(target, args);
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// Singleton Pool Proxy
// Exposes a resilient pool interface that safely manages reconnections behind the scenes.
export const pool = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "query") {
        return (sql, params) =>
          withPoolOperation(
            "pool.query",
            (currentPool) => currentPool.query(sql, params),
            { sqlText: sql },
          );
      }

      if (prop === "execute") {
        return (sql, params) =>
          withPoolOperation(
            "pool.execute",
            (currentPool) => currentPool.execute(sql, params),
            { sqlText: sql },
          );
      }

      if (prop === "getConnection") {
        return async () => {
          const connection = await withPoolOperation(
            "pool.getConnection",
            (currentPool) => currentPool.getConnection(),
            { retryOnReconnect: true },
          );
          return wrapConnection(connection);
        };
      }

      if (prop === "end") {
        return async () => {
          const currentPool = activePool;
          activePool = null;
          activePoolPromise = null;
          dbState.lastConnectLogKey = null;
          await closePool(currentPool);
        };
      }

      if (!activePool) {
        return undefined;
      }

      const value = activePool[prop];
      return typeof value === "function" ? value.bind(activePool) : value;
    },
  },
);

// Helper to dispatch global workflow notifications
function interceptWorkflowNotification(sql, params, insertId) {
  if (sql && typeof sql === 'string' && sql.toUpperCase().includes('INSERT INTO ADM_DOCUMENT_WORKFLOWS')) {
    import('../services/notifications/workflowNotify.js').then(({ notifyWorkflowForward }) => {
      const companyId = params?.companyId || params?.company_id || 1;
      const workflowInstanceId = insertId;
      const assignedTo = params?.assignedTo || params?.assigned_to_user_id || params?.assignedToUserId || params?.user_id;
      const documentId = params?.documentId || params?.document_id || params?.docId || params?.id;
      let documentType = params?.docType || params?.document_type || params?.documentType || 'Document';
      
      if (documentType === 'Document') {
         const match = sql.match(/'([A-Z_]+)'/);
         if (match && match[1] && !match[1].includes('PENDING')) documentType = match[1];
      }
      
      if (workflowInstanceId && assignedTo) {
         notifyWorkflowForward({
            companyId,
            userId: assignedTo,
            workflowInstanceId,
            documentId,
            documentType,
            title: "Approval Required",
            message: `${documentType.replace(/_/g, ' ')} ${documentId ? '#' + documentId : ''} requires your approval`,
            action: "APPROVE",
            senderName: "System"
         }).catch(err => console.error("[Auto-Notify] Error:", err.message));
      }
    }).catch(() => {});
  }
}

// Main Query Utility
// A robust query execution function that supports prepared statements, auto-retries, and parameter sanitization.
export async function query(sql, params = {}) {
  if (params) {
    if (Array.isArray(params)) {
      params = params.map((v) => (v === undefined ? null : v));
    } else if (typeof params === "object") {
      params = new Proxy(params, {
        get(target, prop) {
          if (prop === "branchIdsStr" && target[prop] === undefined) return "";
          const val = target[prop];
          return val === undefined ? null : val;
        },
        has(target, prop) {
          return true;
        },
      });
    }
  }

  const isMetadata = /^\s*(SHOW|ALTER|CREATE|DROP|DESCRIBE)\s/i.test(sql);

  try {
    // Metadata queries generally do not support prepared statements properly in execute()
    if (isMetadata) {
      const [rows] = await pool.query(sql, params);
      return rows;
    }

    // Default to using prepared statements for security and performance
    const [rows] = await pool.execute(sql, params);
    interceptWorkflowNotification(sql, params, rows.insertId);
    return rows;
  } catch (err) {
    // Fallback for queries that cannot be prepared
    if (
      err.code === "ER_UNSUPPORTED_PS" ||
      (err.message &&
        (err.message.includes("prepared statement") ||
          err.message.includes("syntax to use near '?'")))
    ) {
      const [rows] = await pool.query(sql, params);
      interceptWorkflowNotification(sql, params, rows.insertId);
      return rows;
    }

    // Check if error is related to problematic audit joins (e.g. created_by fields)
    const message = String(err?.message || "").toLowerCase();
    const sqlText = String(sql || "").toLowerCase();
    const canRetryAuditJoin =
      (err?.code === "ER_BAD_FIELD_ERROR" ||
        err?.code === "ER_NON_UNIQ_ERROR" ||
        err?.code === "ER_NONUNIQ_TABLE" ||
        err?.code === "ER_PARSE_ERROR" ||
        err?.code === "ER_OPERAND_COLUMNS") &&
      (message.includes("created_by") ||
        message.includes("created_by_name") ||
        sqlText.includes("created_by") ||
        sqlText.includes("created_by_name"));

    if (canRetryAuditJoin) {
      const patchedSql = sanitizeCreatedByAuditJoin(sql);
      if (patchedSql !== sql) {
        const [rows] = await pool.query(patchedSql, params);
        interceptWorkflowNotification(sql, params, rows.insertId);
        return rows;
      }
    }

    throw err;
  }
}

// Diagnostics & Health Endpoints

// Tests the database connection and updates the internal state.
export async function testDbConnection({ silent = false } = {}) {
  try {
    const rows = await withPoolOperation(
      "db-health-check",
      (currentPool) => currentPool.query("SELECT 1 AS ok"),
      { sqlText: "SELECT 1", retryOnReconnect: true },
    );
    if (!silent) {
      console.log("DB connected OK");
    }
    return { ok: true, rows };
  } catch (err) {
    setDbFailure(err);
    if (!silent) {
      logDbError("DB health check failed", err);
    }
    return { ok: false, error: formatDbError(err) };
  }
}

// Returns the current health statistics and database connection status.
export async function getDbHealth({ probe = false } = {}) {
  if (probe) {
    await testDbConnection({ silent: true });
  }

  return {
    status: dbState.status,
    db: dbState.status === "up" ? "up" : "down",
    dbError: dbState.lastError?.message || null,
    dbErrorCode: dbState.lastError?.code || null,
    uptime: Math.floor((Date.now() - startupTime) / 1000),
    pid: process.pid,
    lastErrorAt: dbState.lastErrorAt,
    lastSuccessAt: dbState.lastSuccessAt,
  };
}

// Exposes the active database configuration (with password masked).
export function getDbConfig() {
  return {
    host: dbConfig.host || null,
    port: dbConfig.port,
    user: dbConfig.user || null,
    database: dbConfig.database || null,
    connectionLimit: dbConfig.connectionLimit,
    connectTimeout: dbConfig.connectTimeout,
    queryTimeout: dbConfig.queryTimeout,
    hasPassword: dbConfig.password !== undefined,
    isConfigured: isConfigured(),
  };
}

// Attach the proxy pool to the query function for convenience
query.pool = pool;

// Initiate an immediate connection test on startup
void testDbConnection({ silent: false });

export default pool;
