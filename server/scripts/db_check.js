import { query } from "./server/db/connection.js";

async function check() {
  try {
    const res = await query("DESCRIBE adm_users;");
    console.log(res);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
check();
