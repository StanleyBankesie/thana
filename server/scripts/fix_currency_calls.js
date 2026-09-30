import fs from 'fs';

const filePath = 'server/routes/purchase.routes.js';
let content = fs.readFileSync(filePath, 'utf8');

// Update resolvePurchaseOrderCurrencyBindings calls
const replacements = [
  {
    target: /const currencyBindings = await resolvePurchaseOrderCurrencyBindings\(\{\s+companyId,\s+currency: body\.currency,\s+exchangeRate: body\.exchange_rate,\s+\}\);/g,
    replacement: 'const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_orders", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });'
  },
  {
    target: /const currencyBindings = await resolvePurchaseOrderCurrencyBindings\(\{\s+companyId,\s+currency: body\.currency,\s+exchangeRate: body\.exchange_rate,\s+\}\);/g,
    replacement: 'const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_direct_purchase_hdr", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });'
  }
];

// Wait, the above regex is ambiguous if multiple exist.
// Let's do it more specifically.

// POST /orders (around line 7200)
// PUT /orders/:id (around line 7340)
// POST /direct-purchases (around line 9870)
// PUT /direct-purchases/:id (around line 2100)

// I'll use a more surgical approach.

const lines = content.split('\n');

// 2108: PUT /direct-purchases/:id
if (lines[2107]?.includes('resolvePurchaseOrderCurrencyBindings')) {
    lines[2107] = '      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_direct_purchase_hdr", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });';
}

// 7345: PUT /orders/:id (was 7346)
if (lines[7345]?.includes('resolvePurchaseOrderCurrencyBindings')) {
    lines[7345] = '      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_orders", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });';
} else if (lines[7346]?.includes('resolvePurchaseOrderCurrencyBindings')) {
    lines[7346] = '      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_orders", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });';
}

// 9877: POST /direct-purchases (was 9878)
if (lines[9877]?.includes('resolvePurchaseOrderCurrencyBindings')) {
    lines[9877] = '      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_direct_purchase_hdr", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });';
} else if (lines[9878]?.includes('resolvePurchaseOrderCurrencyBindings')) {
    lines[9878] = '      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_direct_purchase_hdr", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });';
}

// Note: I need to handle the lines after these if they were part of the multi-line object.
// But since I'm replacing the WHOLE call with a single line, I need to remove the following lines that were part of the old call.

// Utility function to clean up multi-line function calls after replacement
function cleanUp(startIdx) {
    // Check if the starting line opens an object
    if (lines[startIdx]?.includes('({')) {
        let i = startIdx + 1;
        // Loop through subsequent lines until the closing bracket is found
        while (i < lines.length && !lines[i].includes('});')) {
            lines[i] = ''; // clear it
            i++;
        }
        // Clear the final closing bracket line if found
        if (i < lines.length && lines[i].includes('});')) {
            lines[i] = ''; // clear the closing
        }
    }
}

// Re-do with cleanup
content = lines.join('\n');
// Actually, this is getting complex. I'll just use a simple string replace for each specific block.

const blocks = [
    {
        old: `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`,
        new: `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_orders", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });`,
        count: 0
    },
    {
        old: `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`,
        new: `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_direct_purchase_hdr", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });`,
        count: 0
    }
];

// Surgical string replacement is hard because they are identical.
// I'll use index based replacement.

// Utility function to replace a substring at a specific index
function replaceAtIndex(str, oldSub, newSub, index) {
    return str.substring(0, index) + newSub + str.substring(index + oldSub.length);
}

let lastIdx = 0;
// First two are pur_orders (POST and PUT /orders)
// Wait, I already updated POST /orders. So the first one remaining is PUT /orders.
// Then the next two are direct_purchase.

let idx1 = content.indexOf(`      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`, 0);

if (idx1 !== -1) {
    console.log("Found PUT /orders call at", idx1);
    content = replaceAtIndex(content, `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`, `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_orders", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });`, idx1);
}

let idx2 = content.indexOf(`      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`, 0);

if (idx2 !== -1) {
    console.log("Found POST /direct-purchases call at", idx2);
    content = replaceAtIndex(content, `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`, `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_direct_purchase_hdr", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });`, idx2);
}

let idx3 = content.indexOf(`      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`, 0);

if (idx3 !== -1) {
    console.log("Found PUT /direct-purchases call at", idx3);
    content = replaceAtIndex(content, `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({
        companyId,
        currency: body.currency,
        exchangeRate: body.exchange_rate,
      });`, `      const currencyBindings = await resolvePurchaseOrderCurrencyBindings({ tableName: "pur_direct_purchase_hdr", companyId, currency: body.currency, currencyId: body.currency_id, exchangeRate: body.exchange_rate });`, idx3);
}

fs.writeFileSync(filePath, content);
console.log("Replacement complete.");
