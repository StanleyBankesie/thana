import { query } from "./db/pool.js";
import { validateCompanyLicense } from "./services/license.service.js";
import { httpError } from "./utils/httpError.js";

async function run() {
  try {
    const user = { id: 7, username: "esther", company_id: 1 };
    
    if (user.company_id) {
      console.log("Checking license for company", user.company_id);
      const licenseStatus = await validateCompanyLicense(user.company_id);
      console.log("License status:", licenseStatus);
      if (!licenseStatus.valid) {
        const error = httpError(403, "LICENSE_EXPIRED", licenseStatus.reason || "Your company license has expired. Please contact your administrator to renew.");
        error.companyId = user.company_id;
        throw error;
      }
      console.log("Login allowed!");
    }
  } catch (err) {
    console.error("Caught error:", err);
  } finally {
    process.exit(0);
  }
}
run();
