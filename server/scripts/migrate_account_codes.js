import { pool } from '../db/pool.js';
import { getNextNumericCode } from '../controllers/finance.controller.js';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('Starting migration of account codes...');

    // 1. Migrate Customers
    const [customers] = await conn.execute(`
      SELECT c.id, c.company_id, c.customer_code, c.customer_name, a.id as account_id, a.code as current_code
      FROM sal_customers c
      INNER JOIN fin_accounts a ON (a.code = c.customer_code OR a.code = CONCAT('C', LPAD(c.id, 5, '0')))
      WHERE a.company_id = c.company_id
        AND a.code NOT REGEXP '^[0-9]{4}$'
    `);
    console.log(`Found ${customers.length} customers to migrate.`);
    for (const c of customers) {
      const newCode = await getNextNumericCode(conn, {
        companyId: c.company_id,
        table: 'fin_accounts',
        nature: 'ASSET'
      });
      console.log(`Migrating Customer ${c.customer_name}: ${c.current_code} -> ${newCode}`);
      await conn.execute('UPDATE fin_accounts SET code = :newCode WHERE id = :id', { newCode, id: c.account_id });
      await conn.execute('UPDATE sal_customers SET customer_code = :newCode WHERE id = :id', { newCode, id: c.id });
    }

    // 2. Migrate Suppliers
    const [suppliers] = await conn.execute(`
      SELECT s.id, s.company_id, s.supplier_code, s.supplier_name, a.id as account_id, a.code as current_code
      FROM pur_suppliers s
      INNER JOIN fin_accounts a ON (a.code = s.supplier_code OR a.code = CONCAT('SU-', LPAD(s.id, 6, '0')))
      WHERE a.company_id = s.company_id
        AND a.code NOT REGEXP '^[0-9]{4}$'
    `);
    console.log(`Found ${suppliers.length} suppliers to migrate.`);
    for (const s of suppliers) {
      const newCode = await getNextNumericCode(conn, {
        companyId: s.company_id,
        table: 'fin_accounts',
        nature: 'LIABILITY'
      });
      console.log(`Migrating Supplier ${s.supplier_name}: ${s.current_code} -> ${newCode}`);
      await conn.execute('UPDATE fin_accounts SET code = :newCode WHERE id = :id', { newCode, id: s.account_id });
      await conn.execute('UPDATE pur_suppliers SET supplier_code = :newCode WHERE id = :id', { newCode, id: s.id });
    }

    // 3. Migrate Tax Components
    const [taxes] = await conn.execute(`
      SELECT d.id, d.company_id, d.component_name, a.id as account_id, a.code as current_code
      FROM fin_tax_details d
      INNER JOIN fin_accounts a ON a.code = CONCAT('TAX-', LPAD(d.id, 4, '0'))
      WHERE a.company_id = d.company_id
        AND a.code NOT REGEXP '^[0-9]{4}$'
    `);
    console.log(`Found ${taxes.length} tax components to migrate.`);
    for (const t of taxes) {
      const newCode = await getNextNumericCode(conn, {
        companyId: t.company_id,
        table: 'fin_accounts',
        nature: 'LIABILITY'
      });
      console.log(`Migrating Tax Component ${t.component_name}: ${t.current_code} -> ${newCode}`);
      await conn.execute('UPDATE fin_accounts SET code = :newCode WHERE id = :id', { newCode, id: t.account_id });
    }

    await conn.commit();
    console.log('Migration completed successfully.');
  } catch (e) {
    console.error('Migration failed:', e);
    if (conn) await conn.rollback();
  } finally {
    if (conn) conn.release();
    process.exit();
  }
}

migrate();
 residential_address
