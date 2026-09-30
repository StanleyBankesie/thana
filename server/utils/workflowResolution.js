import { query } from "../db/pool.js";

/**
 * Extract a unique array of non-empty strings.
 * @param {string[]} values - Array of strings.
 * @returns {string[]} Array of unique, trimmed strings.
 */
function uniqueStrings(values = []) {
  // Utility to normalize an array of strings by removing duplicates and empty values
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Check if a workflow's amount conditions match a given amount.
 * @param {Object} workflow - The workflow object.
 * @param {number|string|null} amount - The amount to check.
 * @returns {boolean} True if amount matches or is omitted.
 */
function matchesAmount(workflow, amount) {
  // Evaluate if a given financial amount falls within the workflow thresholds
  if (amount === null || amount === undefined || amount === "") return true;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return true;
  const minOk =
    workflow.min_amount === null ||
    workflow.min_amount === undefined ||
    numericAmount >= Number(workflow.min_amount);
  const maxOk =
    workflow.max_amount === null ||
    workflow.max_amount === undefined ||
    numericAmount <= Number(workflow.max_amount);
  return minOk && maxOk;
}

/**
 * Pick the first matching workflow from an array based on amount and active status.
 * @param {Object[]} workflows - Array of workflows.
 * @param {number|string|null} amount - Amount to match against.
 * @param {number|null} activeFlag - Optional flag to require matching is_active status.
 * @returns {Object|null} The matching workflow or null.
 */
function pickMatchingWorkflow(workflows, amount, activeFlag) {
  // Scan array of workflows to find the first one satisfying all criteria
  for (const workflow of workflows || []) {
    if (activeFlag != null && Number(workflow.is_active) !== Number(activeFlag)) {
      continue;
    }
    if (matchesAmount(workflow, amount)) {
      return workflow;
    }
  }
  return null;
}

/**
 * Resolves the appropriate workflow for a given document type or route.
 * @param {Object} params - Resolution parameters.
 * @param {number} params.companyId - The company ID.
 * @param {number} [params.workflowIdOverride] - Optional manual workflow ID override.
 * @param {string} [params.docRouteBase] - The base document route.
 * @param {string[]} [params.typeSynonyms] - Array of possible document types.
 * @param {number} [params.amount] - Transaction amount for threshold matching.
 * @returns {Promise<{activeWorkflow: Object|null, inactiveWorkflow: Object|null}>} The resolved workflows.
 */
export async function resolveWorkflowSelection({
  companyId,
  workflowIdOverride = null,
  docRouteBase = null,
  typeSynonyms = [],
  amount = null,
}) {
  // Determine the appropriate workflow rule to apply for a document
  const normalizedTypes = uniqueStrings(typeSynonyms);
  const routeWorkflows = docRouteBase
    ? await query(
        `SELECT *
         FROM adm_workflows
         WHERE company_id = :companyId
           AND document_route = :docRouteBase
         ORDER BY id ASC`,
        { companyId, docRouteBase },
      )
    : [];

  let typeWorkflows = [];
  // Build dynamic SQL OR clauses to fetch workflows matching any document synonyms
  if (normalizedTypes.length > 0) {
    const typeClauses = normalizedTypes
      .map((_, index) => `document_type = :type${index}`)
      .join(" OR ");
    const params = { companyId };
    normalizedTypes.forEach((value, index) => {
      params[`type${index}`] = value;
    });
    typeWorkflows = await query(
      `SELECT *
       FROM adm_workflows
       WHERE company_id = :companyId
         AND (${typeClauses})
       ORDER BY id ASC`,
      params,
    );
  }

  if (workflowIdOverride) {
    // Handle explicit manual workflow overrides by checking validity against route or type
    const overrideRows = await query(
      `SELECT *
       FROM adm_workflows
       WHERE id = :workflowId
         AND company_id = :companyId
       LIMIT 1`,
      { workflowId: workflowIdOverride, companyId },
    );
    const overrideWorkflow = overrideRows[0] || null;
    const overrideMatches =
      overrideWorkflow &&
      ((docRouteBase &&
        String(overrideWorkflow.document_route || "") === String(docRouteBase)) ||
        normalizedTypes.includes(String(overrideWorkflow.document_type || "")));
    if (overrideMatches) {
      return {
        activeWorkflow:
          Number(overrideWorkflow.is_active) === 1 ? overrideWorkflow : null,
        inactiveWorkflow:
          Number(overrideWorkflow.is_active) === 1 ? null : overrideWorkflow,
      };
    }
  }

  // Prioritize route-based matches over type-based matches for active workflows
  const activeWorkflow =
    pickMatchingWorkflow(routeWorkflows, amount, 1) ||
    pickMatchingWorkflow(typeWorkflows, amount, 1);
  if (activeWorkflow) {
    return { activeWorkflow, inactiveWorkflow: null };
  }

  const inactiveWorkflow =
    pickMatchingWorkflow(routeWorkflows, amount, 0) ||
    pickMatchingWorkflow(typeWorkflows, amount, 0);

  return { activeWorkflow: null, inactiveWorkflow };
}

/**
 * Gets the behavior to fall back on if no active workflow is resolved.
 * @param {Object|null} workflow - The inactive workflow, if any.
 * @returns {string|null} The fallback behavior, e.g. "AUTO_APPROVE".
 */
export function getInactiveWorkflowBehavior(workflow) {
  // Define fallback logic when no valid active workflow is configured
  if (!workflow) return null;
  const behavior = String(workflow.default_behavior || "").trim().toUpperCase();
  return behavior || "AUTO_APPROVE";
}
