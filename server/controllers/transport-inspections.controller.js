import { query } from "../db/pool.js";

function toNumber(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export const listInspections = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const items = await query(
      `SELECT i.*, v.registration_number, v.make, v.model 
       FROM trans_inspections i
       LEFT JOIN trans_vehicles v ON i.vehicle_id = v.id
       WHERE i.company_id = :companyId AND i.deleted_at IS NULL
       ORDER BY i.inspection_date DESC, i.id DESC`,
      { companyId }
    ).catch(() => []);
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getInspectionById = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const rows = await query(
      `SELECT * FROM trans_inspections WHERE id = :id AND company_id = :companyId AND deleted_at IS NULL LIMIT 1`,
      { id, companyId }
    ).catch(() => []);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Inspection not found" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createInspection = async (req, res, next) => {
  try {
    const { companyId, userId } = req.scope || {};
    const {
      vehicle_id,
      inspection_date,
      inspection_type,
      status,
      remarks,
      check_tyres,
      check_brakes,
      check_engine,
      check_lights,
      check_horn,
      check_oil,
      check_coolant,
      check_battery,
      check_mirrors
    } = req.body;

    const resDb = await query(
      `INSERT INTO trans_inspections (
         company_id, vehicle_id, inspection_date, inspection_type, status, remarks,
         check_tyres, check_brakes, check_engine, check_lights, check_horn, check_oil,
         check_coolant, check_battery, check_mirrors, created_by
       ) VALUES (
         :companyId, :vehicle_id, :inspection_date, :inspection_type, :status, :remarks,
         :check_tyres, :check_brakes, :check_engine, :check_lights, :check_horn, :check_oil,
         :check_coolant, :check_battery, :check_mirrors, :userId
       )`,
      {
        companyId,
        vehicle_id: toNumber(vehicle_id),
        inspection_date,
        inspection_type: inspection_type || 'ROUTINE',
        status: status || 'PASSED',
        remarks: remarks || '',
        check_tyres: check_tyres ? 1 : 0,
        check_brakes: check_brakes ? 1 : 0,
        check_engine: check_engine ? 1 : 0,
        check_lights: check_lights ? 1 : 0,
        check_horn: check_horn ? 1 : 0,
        check_oil: check_oil ? 1 : 0,
        check_coolant: check_coolant ? 1 : 0,
        check_battery: check_battery ? 1 : 0,
        check_mirrors: check_mirrors ? 1 : 0,
        userId: toNumber(userId)
      }
    );

    res.json({ success: true, id: resDb.insertId, message: "Inspection created successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateInspection = async (req, res, next) => {
  try {
    const { companyId, userId } = req.scope || {};
    const id = toNumber(req.params.id);
    const {
      vehicle_id,
      inspection_date,
      inspection_type,
      status,
      remarks,
      check_tyres,
      check_brakes,
      check_engine,
      check_lights,
      check_horn,
      check_oil,
      check_coolant,
      check_battery,
      check_mirrors
    } = req.body;

    await query(
      `UPDATE trans_inspections SET 
         vehicle_id = :vehicle_id,
         inspection_date = :inspection_date,
         inspection_type = :inspection_type,
         status = :status,
         remarks = :remarks,
         check_tyres = :check_tyres,
         check_brakes = :check_brakes,
         check_engine = :check_engine,
         check_lights = :check_lights,
         check_horn = :check_horn,
         check_oil = :check_oil,
         check_coolant = :check_coolant,
         check_battery = :check_battery,
         check_mirrors = :check_mirrors,
         updated_by = :userId
       WHERE id = :id AND company_id = :companyId`,
      {
        id, companyId,
        vehicle_id: toNumber(vehicle_id),
        inspection_date,
        inspection_type: inspection_type || 'ROUTINE',
        status: status || 'PASSED',
        remarks: remarks || '',
        check_tyres: check_tyres ? 1 : 0,
        check_brakes: check_brakes ? 1 : 0,
        check_engine: check_engine ? 1 : 0,
        check_lights: check_lights ? 1 : 0,
        check_horn: check_horn ? 1 : 0,
        check_oil: check_oil ? 1 : 0,
        check_coolant: check_coolant ? 1 : 0,
        check_battery: check_battery ? 1 : 0,
        check_mirrors: check_mirrors ? 1 : 0,
        userId: toNumber(userId)
      }
    );

    res.json({ success: true, message: "Inspection updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const deleteInspection = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query("UPDATE trans_inspections SET deleted_at = NOW() WHERE id = :id AND company_id = :companyId", { id, companyId });
    res.json({ success: true, message: "Inspection deleted successfully" });
  } catch (err) {
    next(err);
  }
};
