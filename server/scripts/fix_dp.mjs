// Database and File System Dependencies
import { query } from "../db/pool.js";
import fs from "fs";

// Main execution script to fix the direct-purchase HTML template
async function run() {
  const path = "C:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\server\\scripts\\dp.html";
  let html = fs.readFileSync(path, "utf8");

  // 1. Fix empty pages - update @media print CSS
  html = html.replace(
    `    @media print {
      @page { size: 21cm 29.7cm; margin: 0; }
      html, body { background: #fff; width: 21cm; height: 29.7cm; }
      .page-wrap { box-shadow: none; width: 21cm; height: 29.7cm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }`,
    `    @media print {
      @page { size: 21cm 29.7cm; margin: 0; }
      html, body { background: #fff; width: 21cm; min-height: 29.7cm; height: auto; }
      .page-wrap { box-shadow: none; width: 21cm; min-height: 29.7cm; height: auto; overflow: visible; }
      .doc { width: 21cm; min-height: 29.7cm; height: auto; overflow: visible; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }`
  );

  // 2. Restore remarks field in bottom-left
  // Add bottom-left with remarks back
  html = html.replace(
    `    <div class="bottom-section">
      <div class="summary" style="margin-left:auto">`,
    `    <div class="bottom-section">
      <div class="bottom-left">
        <div class="remarks">
          <span class="lbl">Remarks</span>
          <span class="val">{{direct_purchase.remarks}}</span>
        </div>
      </div>
      <div class="summary" style="margin-left:auto">`
  );

  // 3. Remove unused meta-row CSS (still used for bottom-left remarks)
  
  // Update DB
  await query(
    `UPDATE document_templates SET html_content = :html, updated_at = NOW() WHERE document_type = 'direct-purchase'`,
    { html }
  );
  fs.writeFileSync(path, html, "utf8");
  console.log("DP template updated.");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
