import { query } from "../db/pool.js";
import fs from "fs";
async function run() {
  const r = await query(`SELECT id, html_content FROM document_templates WHERE document_type = 'direct-purchase'`);
  fs.writeFileSync("C:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\server\\scripts\\dp.html", r[0].html_content, "utf8");
  console.log("Saved.");
  process.exit(0);
}
run();
