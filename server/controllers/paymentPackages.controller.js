import { query } from "../db/pool.js";

// Get all payment packages
export const getPaymentPackages = async (req, res, next) => {
  try {
    const packages = await query("SELECT * FROM adm_payment_packages ORDER BY amount ASC");
    res.json(packages);
  } catch (error) {
    console.error("[PaymentPackages] Error fetching packages:", error);
    next(error);
  }
};

// Create a new payment package
export const createPaymentPackage = async (req, res, next) => {
  try {
    const { plan_name, amount, cloud_hosting, support_maintenance, software_license, duration_months, status } = req.body;
    if (!plan_name || amount == null || duration_months == null) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const result = await query(
      "INSERT INTO adm_payment_packages (plan_name, amount, cloud_hosting, support_maintenance, software_license, duration_months, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [plan_name, amount, cloud_hosting || 0, support_maintenance || 0, software_license || 0, duration_months, status || "ACTIVE"]
    );
    res.status(201).json({ success: true, id: result.insertId, message: "Payment package created successfully." });
  } catch (error) {
    console.error("[PaymentPackages] Error creating package:", error);
    next(error);
  }
};

// Update an existing payment package
export const updatePaymentPackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan_name, amount, cloud_hosting, support_maintenance, software_license, duration_months, status } = req.body;
    if (!plan_name || amount == null || duration_months == null) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    await query(
      "UPDATE adm_payment_packages SET plan_name = ?, amount = ?, cloud_hosting = ?, support_maintenance = ?, software_license = ?, duration_months = ?, status = ? WHERE id = ?",
      [plan_name, amount, cloud_hosting || 0, support_maintenance || 0, software_license || 0, duration_months, status || "ACTIVE", id]
    );
    res.json({ success: true, message: "Payment package updated successfully." });
  } catch (error) {
    console.error("[PaymentPackages] Error updating package:", error);
    next(error);
  }
};

// Delete a payment package
export const deletePaymentPackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM adm_payment_packages WHERE id = ?", [id]);
    res.json({ success: true, message: "Payment package deleted successfully." });
  } catch (error) {
    console.error("[PaymentPackages] Error deleting package:", error);
    next(error);
  }
};
