/**
 * Get the bound query function from a db object.
 * @param {Object} db - The database object.
 * @returns {Function|null} The bound query function or null.
 */
function getQueryFn(db) {
  // Check if database object has a bindable query method to execute sql
  return db && typeof db.query === "function" ? db.query.bind(db) : null;
}

/**
 * Load all existing indexes from the database schema.
 * @param {Function} q - The query function.
 * @returns {Promise<Object>} Map of table names to their indexes.
 */
async function loadExistingIndexes(q) {
  // Fetch raw statistics schema for all current database indexes
  const rows = await q(
    `SELECT s.table_name, s.index_name, s.column_name, s.seq_in_index
     FROM information_schema.STATISTICS s
     WHERE s.table_schema = DATABASE()
     ORDER BY s.table_name, s.index_name, s.seq_in_index`,
  );
  const map = {};
  // Organize row results into a structured map by table and index name
  for (const r of rows) {
    if (!map[r.table_name]) map[r.table_name] = {};
    if (!map[r.table_name][r.index_name]) map[r.table_name][r.index_name] = [];
    map[r.table_name][r.index_name].push(r.column_name);
  }
  return map;
}

/**
 * Check if a column is covered by any index on the table.
 * @param {Object} tableIndexes - Indexes for the table.
 * @param {string} column - The column name.
 * @returns {boolean} True if covered.
 */
function isColumnCovered(tableIndexes, column) {
  // Iterate over table indexes to check if the specific column is present in any index
  for (const cols of Object.values(tableIndexes)) {
    if (cols.includes(column)) return true;
  }
  return false;
}

/**
 * Check if a prefix of columns is covered by any index on the table.
 * @param {Object} tableIndexes - Indexes for the table.
 * @param {string[]} columns - Array of column names.
 * @returns {boolean} True if the prefix is covered.
 */
function isPrefixCovered(tableIndexes, columns) {
  // Validate if a sequence of columns matches the beginning of any existing index sequence
  for (const cols of Object.values(tableIndexes)) {
    if (cols.length < columns.length) continue;
    let match = true;
    for (let i = 0; i < columns.length; i++) {
      if (cols[i] !== columns[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

/**
 * Ensure standard indexes exist across all base tables.
 * @param {Object} db - Optional database object to use for queries.
 * @returns {Promise<number>} The number of indexes created.
 */
export async function ensureIndexes(db) {
  // Initialize query function from provided db object or default to import pool
  const q = getQueryFn(db) || (await import("../db/pool.js")).query;

  // Retrieve a list of all relevant base tables in the current database schema
  const tables = await q(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'
       AND table_name NOT LIKE 'v\_%'
     ORDER BY table_name`,
  );

  // Retrieve column metadata for all matching base tables to check index necessity
  const columns = await q(
    `SELECT c.table_name, c.column_name
     FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = DATABASE()
       AND t.table_type = 'BASE TABLE'
       AND c.table_name NOT LIKE 'v\_%'
     ORDER BY c.table_name, c.ordinal_position`,
  );

  // Load currently configured database indexes into memory
  const existingIndexes = await loadExistingIndexes(q);

  const tableCols = {};
  for (const row of columns) {
    if (!tableCols[row.table_name]) tableCols[row.table_name] = new Set();
    tableCols[row.table_name].add(row.column_name);
  }

  let created = 0;

  // Iterate through each base table to evaluate and queue missing indexes
  for (const { table_name } of tables) {
    const cols = tableCols[table_name];
    if (!cols) continue;

    const tblIdx = existingIndexes[table_name] || {};

    const candidates = [];

    // Check and queue composite index for company_id and branch_id
    // company_id + branch_id composite
    if (cols.has("company_id") && cols.has("branch_id")) {
      if (!isPrefixCovered(tblIdx, ["company_id", "branch_id"])) {
        candidates.push({ name: `idx_${table_name}_co_br`, columns: ["company_id", "branch_id"] });
      }
    } else if (cols.has("company_id")) {
      if (!isColumnCovered(tblIdx, "company_id")) {
        candidates.push({ name: `idx_${table_name}_company`, columns: ["company_id"] });
      }
    }

    // status column
    if (cols.has("status") && !isColumnCovered(tblIdx, "status")) {
      candidates.push({ name: `idx_${table_name}_status`, columns: ["status"] });
    }

    // created_at
    if (cols.has("created_at") && !isColumnCovered(tblIdx, "created_at")) {
      candidates.push({ name: `idx_${table_name}_created`, columns: ["created_at"] });
    }

    // is_active
    if (cols.has("is_active") && !isColumnCovered(tblIdx, "is_active")) {
      candidates.push({ name: `idx_${table_name}_active`, columns: ["is_active"] });
    }

    // is_deleted
    if (cols.has("is_deleted") && !isColumnCovered(tblIdx, "is_deleted")) {
      candidates.push({ name: `idx_${table_name}_del`, columns: ["is_deleted"] });
    }

    // deleted_at
    if (cols.has("deleted_at") && !isColumnCovered(tblIdx, "deleted_at")) {
      candidates.push({ name: `idx_${table_name}_deleted`, columns: ["deleted_at"] });
    }

    // Dynamically identify and queue indexes for all document reference columns
    // Document number columns (*_no, *_code)
    for (const col of cols) {
      if (!col.endsWith("_no") && !col.endsWith("_code")) continue;
      if (col === "company_id" || col === "branch_id") continue;
      if (isColumnCovered(tblIdx, col)) continue;
      const safeLabel = col.replace(/[^a-z0-9_]/gi, "_");
      candidates.push({ name: `idx_${table_name}_${safeLabel}`, columns: [col] });
    }

    // Attempt to sequentially create all queued missing indexes for the current table
    for (const { name, columns: colsArr } of candidates) {
      try {
        await q(
          `CREATE INDEX \`${name}\` ON \`${table_name}\` (${colsArr.join(", ")})`,
          {},
        );
        created++;
      } catch {
        // index may have been created concurrently or column may not support it
      }
    }
  }

  return created;
}
