/**
 * @file seed_currency_rates.js
 * @description Script to seed initial currency configurations and their exchange rates.
 * Populates the `fin_currencies` and `fin_currency_rates` tables with standard currencies 
 * (USD, GHS, EUR, GBP) and sets up sample historical rates for testing.
 */

import { pool } from "../db/pool.js";

/**
 * Main execution function to seed currencies and exchange rates.
 * Connects to the database, upserts the base and foreign currencies,
 * resolves their database IDs, and seeds standard daily rates.
 * 
 * @returns {Promise<void>} Resolves when currency and rate seeding is complete.
 */
async function seedCurrencyRates() {
  const conn = await pool.getConnection();
  try {
    const companyId = 1;

    const currencies = [
      { code: "USD", name: "US Dollar", symbol: "$", is_base: 0 },
      { code: "GHS", name: "Ghana Cedi", symbol: "GH₵", is_base: 1 },
      { code: "EUR", name: "Euro", symbol: "€", is_base: 0 },
      { code: "GBP", name: "British Pound", symbol: "£", is_base: 0 },
    ];

    for (const c of currencies) {
      await conn.execute(
        `INSERT INTO fin_currencies (company_id, code, name, symbol, is_base, is_active)
         VALUES (:companyId, :code, :name, :symbol, :isBase, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), symbol = VALUES(symbol), is_active = VALUES(is_active)`,
        {
          companyId,
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          isBase: c.is_base ? 1 : 0,
        }
      );
    }

    const [rows] = await conn.execute(
      `SELECT id, code FROM fin_currencies WHERE company_id = :companyId AND code IN ('USD','GHS','EUR','GBP')`,
      { companyId }
    );
    const idByCode = new Map(rows.map((r) => [String(r.code), Number(r.id)]));
    const USD = idByCode.get("USD");
    const GHS = idByCode.get("GHS");
    const EUR = idByCode.get("EUR");
    const GBP = idByCode.get("GBP");
    if (!USD || !GHS || !EUR || !GBP) {
      throw new Error("Missing currency IDs for USD/GHS/EUR/GBP");
    }

    const rates = [
      { from: USD, to: GHS, rate: 13.25, date: "2026-01-01" },
      { from: USD, to: GHS, rate: 13.3, date: "2026-01-02" },
      { from: USD, to: GHS, rate: 13.4, date: "2026-01-03" },
      { from: EUR, to: GHS, rate: 14.65, date: "2026-01-01" },
      { from: GBP, to: GHS, rate: 16.95, date: "2026-01-01" },
      { from: GHS, to: USD, rate: 0.07547, date: "2026-01-01" },
    ];

    for (const r of rates) {
      await conn.execute(
        `INSERT INTO fin_currency_rates (company_id, from_currency_id, to_currency_id, rate_date, rate)
         VALUES (:companyId, :fromId, :toId, :rateDate, :rate)
         ON DUPLICATE KEY UPDATE rate = VALUES(rate)`,
        {
          companyId,
          fromId: r.from,
          toId: r.to,
          rateDate: r.date,
          rate: r.rate,
        }
      );
    }

    console.log("Seeded fin_currency_rates for company_id=1.");
  } catch (err) {
    console.error("Failed to seed currency rates:", err.message || String(err));
    process.exitCode = 1;
  } finally {
    conn.release();
    process.exit();
  }
}

seedCurrencyRates();
