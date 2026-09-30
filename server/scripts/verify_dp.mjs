import { query } from "../db/pool.js";
async function run() {
  const r = await query(`SELECT id, html_content FROM document_templates WHERE document_type = 'direct-purchase'`);
  for (const t of r) {
    console.log("ID:", t.id);
    console.log("Has remarks:", t.html_content.includes("Remarks"));
    console.log("Has min-height:", t.html_content.includes("min-height: 29.7cm"));
    console.log("Has overflow visible:", t.html_content.includes("overflow: visible"));
    console.log("Has bottom-left:", t.html_content.includes("bottom-left"));
  }
  process.exit(0);
}
run();
