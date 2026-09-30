import { query, pool } from "../db/pool.js";

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log("Standardizing Chart of Accounts to 4-digit codes...");
    
    // For this script, we'll migrate for all companies found in the DB
    const companies = await query("SELECT id FROM adm_companies").catch(() => []);
    
    for (const company of companies) {
      const companyId = company.id;
      console.log(`Processing Company ID: ${companyId}`);

      // Prefix existing codes with temp string to avoid clashes during migration
      await conn.execute(
        "UPDATE fin_account_groups SET code = CONCAT('TEMP-GRP-', id) WHERE company_id = :companyId",
        { companyId },
      );
      await conn.execute(
        "UPDATE fin_accounts SET code = CONCAT('TEMP-ACC-', id) WHERE company_id = :companyId",
        { companyId },
      );

      const nextCodes = {
        ASSET: 1000,
        LIABILITY: 2000,
        EQUITY: 3000,
        INCOME: 4000,
        EXPENSE: 5000,
      };

      // 1. Fetch and Update Groups
      const [groups] = await conn.execute(
        "SELECT id, nature FROM fin_account_groups WHERE company_id = :companyId ORDER BY parent_id ASC, id ASC",
        { companyId },
      );

      for (const g of groups) {
        const nature = String(g.nature || "ASSET").toUpperCase();
        if (!nextCodes[nature]) nextCodes[nature] = 9000;
        const code = String(nextCodes[nature]++);
        await conn.execute(
          "UPDATE fin_account_groups SET code = :code WHERE id = :id",
          { code, id: g.id },
        );
      }

      // 2. Fetch and Update Accounts
      const [accounts] = await conn.execute(
        `SELECT a.id, g.nature 
         FROM fin_accounts a 
         JOIN fin_account_groups g ON g.id = a.group_id 
         WHERE a.company_id = :companyId 
         ORDER BY a.group_id ASC, a.id ASC`,
        { companyId },
      );

      for (const a of accounts) {
        const nature = String(a.nature || "ASSET").toUpperCase();
        if (!nextCodes[nature]) nextCodes[nature] = 9000;
        const code = String(nextCodes[nature]++);
        await conn.execute(
          "UPDATE fin_accounts SET code = :code WHERE id = :id",
          { code, id: a.id },
        );
      }
    }

    await conn.commit();
    console.log("Migration complete.");
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Migration Failed:", err);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

run();
