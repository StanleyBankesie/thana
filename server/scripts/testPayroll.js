import { generatePayroll } from "./controllers/hr.controller.js";
import { query } from "./db/pool.js";

async function run() {
  try {
    const res = {
      json: (data) => console.log("SUCCESS:", data),
      status: (c) => ({ json: (d) => console.log("STATUS", c, d) })
    };
    const req = {
      scope: { companyId: 1 },
      body: { period_id: 1 } // I'll get an actual period_id
    };
    
    // get a period id
    const periods = await query("SELECT id FROM hr_payroll_periods LIMIT 1");
    if(periods.length > 0) {
      req.body.period_id = periods[0].id;
    }

    console.log("Running for period:", req.body.period_id);
    await generatePayroll(req, res, (err) => {
      console.error("ERROR FROM NEXT:", err);
    });
  } catch (err) {
    console.error("FATAL ERROR:", err);
  } finally {
    setTimeout(() => process.exit(0), 1000);
  }
}

run();
