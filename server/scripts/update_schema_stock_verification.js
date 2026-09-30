import { pool } from '../db/pool.js';

async function updateSchema() {
  const conn = await pool.getConnection();
  try {
    console.log('Starting schema update for Stock Verification...');

    // Add start_date and end_date to inv_stock_adjustments
    try {
      await conn.query(`ALTER TABLE inv_stock_adjustments ADD COLUMN start_date DATE`);
      console.log('Added start_date to inv_stock_adjustments');
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.log('start_date might already exist or error:', e.message);
    }

    try {
      await conn.query(`ALTER TABLE inv_stock_adjustments ADD COLUMN end_date DATE`);
      console.log('Added end_date to inv_stock_adjustments');
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.log('end_date might already exist or error:', e.message);
    }

    console.log('Schema update completed successfully.');
  } catch (err) {
    console.error('Schema update failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

updateSchema();
