const mysql = require('mysql2/promise');

async function fix() {
  try {
    const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });
    await conn.query("CREATE USER IF NOT EXISTS 'admin'@'localhost' IDENTIFIED BY 'admin'");
    await conn.query("GRANT ALL PRIVILEGES ON *.* TO 'admin'@'localhost'");
    await conn.query("FLUSH PRIVILEGES");
    console.log('MySQL user admin@localhost created and privileges granted');
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}

fix();
