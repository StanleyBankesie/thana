import { query } from "./server/db/pool.js";

async function testInsert() {
  try {
    const plan_name = "Test Plan";
    const amount = 1000;
    const cloud_hosting = 100;
    const support_maintenance = 100;
    const software_license = 800;
    const duration_months = 12;
    const status = "ACTIVE";

    const result = await query(
      "INSERT INTO adm_payment_packages (plan_name, amount, cloud_hosting, support_maintenance, software_license, duration_months, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [plan_name, amount, cloud_hosting, support_maintenance, software_license, duration_months, status]
    );
    console.log("Success:", result);
  } catch (err) {
    console.error("Error inserting:", err);
  } finally {
    process.exit(0);
  }
}

testInsert();
