import { ensurePMQuotationTables, ensurePMInvoiceTables } from '../utils/dbUtils.js';

async function run() {
  try {
    await ensurePMQuotationTables();
    console.log("PM Quotation Tables Ensured");
    await ensurePMInvoiceTables();
    console.log("PM Invoice Tables Ensured");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
