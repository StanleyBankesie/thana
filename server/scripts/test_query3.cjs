const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
  });
  try {
    const [rows] = await pool.query("SHOW DATABASES");
    console.log(rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
test();
