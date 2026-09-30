/**
 * @fileoverview Utility script to check the adm_document_templates table.
 * @module check_adm_templates
 */

const { query } = require("./server/db/pool.js");

// Execute immediately invoked async function to check templates
(async () => {
  try {
    // Query a sample of administrative document templates from the database
    const rows = await query("SELECT id, template_name, template_type, doc_type, name, document_type, is_default FROM adm_document_templates LIMIT 20");
    // Format and output the rows to the console
    console.log(JSON.stringify(rows, null, 2));
    // Exit successfully
    process.exit(0);
  } catch (err) {
    // Log error if query fails
    console.error(err);
    // Exit with failure code
    process.exit(1);
  }
})();
