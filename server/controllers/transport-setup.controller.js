import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

// GET /transport/setup
export const listSetupItems = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { type } = req.query;
    
    let sql = `SELECT * FROM trans_setup_items WHERE company_id = :companyId`;
    const params = { companyId };
    
    if (type) {
      sql += ` AND setup_type = :type`;
      params.type = type;
    }
    
    sql += ` ORDER BY setup_type, setup_value`;
    
    const items = await query(sql, params);
    
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

// POST /transport/setup
export const createSetupItem = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { setup_type, setup_value, is_active } = req.body;
    
    if (!setup_type || !setup_value) {
      throw httpError(400, "Setup type and value are required");
    }
    
    const active = is_active !== undefined ? is_active : 1;
    
    const result = await query(
      `INSERT INTO trans_setup_items (company_id, setup_type, setup_value, is_active)
       VALUES (:companyId, :setup_type, :setup_value, :active)`,
      { companyId, setup_type, setup_value, active }
    );
    
    res.json({ success: true, message: "Item created successfully", data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

// PUT /transport/setup/:id
export const updateSetupItem = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { setup_value, is_active } = req.body;
    
    if (!setup_value) {
      throw httpError(400, "Setup value is required");
    }
    
    await query(
      `UPDATE trans_setup_items 
       SET setup_value = :setup_value, is_active = :is_active 
       WHERE id = :id AND company_id = :companyId`,
      { setup_value, is_active, id, companyId }
    );
    
    res.json({ success: true, message: "Item updated successfully" });
  } catch (err) {
    next(err);
  }
};

// DELETE /transport/setup/:id
export const deleteSetupItem = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    await query(
      `DELETE FROM trans_setup_items WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    next(err);
  }
};
