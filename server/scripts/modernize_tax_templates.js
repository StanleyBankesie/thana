import { query, pool } from "../db/pool.js";

async function run() {
  console.log("Modernizing Tax Templates...");
  try {
    const templates = await query("SELECT id, name, html_content FROM document_templates").catch(() => []);
    if (!templates.length) {
      console.log("No templates found.");
      process.exit(0);
    }
    
    for (const t of templates) {
      let html = t.html_content;
      if (!html) continue;

      // Detect if it already has tax_summary loop
      if (html.includes("{{#each tax_summary}}")) {
        console.log(`Skipping ${t.name} - already modernized.`);
        continue;
      }

      // We want to replace lines like:
      // <tr><td>Tax</td><td>{{tax_amount}}</td></tr>
      // with a loop.
      
      // This is a heuristic approach. 
      // We look for <tr> that contains tax_amount and replace it.
      const patterns = [
        /<tr[^>]*>[\s\S]*?{{tax_amount}}[\s\S]*?<\/tr>/gi,
        /<tr[^>]*>[\s\S]*?{{document\.tax_amount}}[\s\S]*?<\/tr>/gi,
        /<tr[^>]*>[\s\S]*?{{sales_order\.tax_amount}}[\s\S]*?<\/tr>/gi,
        /<tr[^>]*>[\s\S]*?{{invoice\.tax_amount}}[\s\S]*?<\/tr>/gi,
        /<tr[^>]*>[\s\S]*?{{purchase_order\.tax_amount}}[\s\S]*?<\/tr>/gi
      ];

      let updated = false;
      for (const p of patterns) {
        if (p.test(html)) {
          html = html.replace(p, `
    {{#each tax_summary}}
    <tr>
      <td colspan="4" style="text-align: right; border: 1px solid #eee; padding: 8px;"><strong>{{name}} ({{rate}}%):</strong></td>
      <td style="text-align: right; border: 1px solid #eee; padding: 8px;">{{amount}}</td>
    </tr>
    {{/each}}
          `.trim());
          updated = true;
          break; 
        }
      }

      if (updated) {
        console.log(`Updating template: ${t.name} (ID: ${t.id})`);
        await query("UPDATE document_templates SET html_content = :html WHERE id = :id", { html, id: t.id });
      } else {
        // Fallback: If no TR found but placeholder exists, inject the loop before the total row
        if (html.includes("{{tax_amount}}")) {
            console.log(`Heuristic update for ${t.name} - Injecting tax_summary loop.`);
            html = html.replace(/{{\s*tax_amount\s*}}/, `
                {{#each tax_summary}}
                <div>{{name}} ({{rate}}%): {{amount}}</div>
                {{/each}}
            `);
            await query("UPDATE document_templates SET html_content = :html WHERE id = :id", { html, id: t.id });
        }
      }
    }
    console.log("Modernization complete.");
  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
