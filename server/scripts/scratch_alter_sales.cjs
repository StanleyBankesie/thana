const fs = require('fs');
const mysql = require('mysql2/promise');

async function checkAndAlter() {
  let pool;
  try {
    pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'omnisuite' });
    
    // Check sal_orders
    let [rows] = await pool.query(`SHOW COLUMNS FROM sal_orders LIKE 'sales_person_id'`);
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE sal_orders ADD COLUMN sales_person_id INT NULL`);
      console.log('Added sales_person_id to sal_orders');
    } else {
      console.log('sales_person_id already in sal_orders');
    }
    
    // Check sal_invoices
    [rows] = await pool.query(`SHOW COLUMNS FROM sal_invoices LIKE 'sales_person_id'`);
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE sal_invoices ADD COLUMN sales_person_id INT NULL`);
      console.log('Added sales_person_id to sal_invoices');
    } else {
      console.log('sales_person_id already in sal_invoices');
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
checkAndAlter();
