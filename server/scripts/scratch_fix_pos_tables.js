import { query } from "./db/pool.js";

async function fix() {
  const tables = [
    "pos_payment_modes",
    "pos_tax_settings",
    "pos_receipt_settings",
    "pos_terminals",
    "pos_terminal_users",
    "pos_return_reasons",
    "pos_sale_lines",
    "pos_return_lines"
  ];

  for (const t of tables) {
    try {
      await query(`ALTER TABLE \`${t}\` ADD COLUMN created_by BIGINT UNSIGNED NULL`);
      console.log(`Added created_by to ${t}`);
    } catch (e) {
      if (!e.message.includes("Duplicate column name")) {
        console.error(`Error adding created_by to ${t}:`, e.message);
      } else {
        console.log(`${t} already has created_by`);
      }
    }

    try {
      await query(`ALTER TABLE \`${t}\` ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      console.log(`Added created_at to ${t}`);
    } catch (e) {
      if (!e.message.includes("Duplicate column name")) {
        console.error(`Error adding created_at to ${t}:`, e.message);
      } else {
        console.log(`${t} already has created_at`);
      }
    }
  }
  process.exit(0);
}

fix();
