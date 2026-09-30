const mysql = require('mysql2/promise');
const fs = require('fs');

async function test() {
  try {
    const cfg = JSON.parse(fs.readFileSync('./config/db.json'));
    const conn = await mysql.createConnection({
      host: cfg.host || 'localhost',
      user: cfg.user || 'root',
      password: cfg.password || '',
      database: cfg.database || 'omnisuite'
    });
    const [rows] = await conn.execute("SELECT * FROM sal_standard_prices WHERE product_id = 4");
    console.log("DB Result sal_standard_prices:", rows);
    const [rows2] = await conn.execute("SELECT * FROM inv_items WHERE id = 4");
    console.log("DB Result inv_items:", rows2);
    await conn.end();
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

test();
