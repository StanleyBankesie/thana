import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

// GET /transport/routes
export const listRoutes = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    
    const items = await query(
      `SELECT * FROM trans_routes 
       WHERE company_id = :companyId 
       ORDER BY route_name`,
      { companyId }
    );
    
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

// GET /transport/routes/:id
export const getRoute = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    const [item] = await query(
      `SELECT * FROM trans_routes WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    
    if (!item) throw httpError(404, "Route not found");
    
    res.json({ success: true, data: { item } });
  } catch (err) {
    next(err);
  }
};

// POST /transport/routes
export const createRoute = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { route_name, origin, destination, distance, estimated_time, is_active } = req.body;
    let { route_code } = req.body;
    
    if (!route_name || !origin || !destination) {
      throw httpError(400, "Route name, origin, and destination are required");
    }
    
    if (!route_code) {
      const [lastRoute] = await query(
        `SELECT route_code FROM trans_routes WHERE company_id = :companyId AND route_code LIKE 'RT-%' ORDER BY id DESC LIMIT 1`,
        { companyId }
      );
      let nextNum = 1;
      if (lastRoute && lastRoute.route_code) {
        const parts = lastRoute.route_code.split('-');
        if (parts.length > 1 && !isNaN(parts[1])) {
          nextNum = parseInt(parts[1], 10) + 1;
        }
      }
      route_code = `RT-${String(nextNum).padStart(6, '0')}`;
    }

    const active = is_active !== undefined ? is_active : 1;
    
    const result = await query(
      `INSERT INTO trans_routes 
       (company_id, branch_id, route_code, route_name, origin, destination, distance, estimated_time, base_cost, is_active)
       VALUES 
       (:companyId, :branchId, :route_code, :route_name, :origin, :destination, :distance, :estimated_time, 0, :active)`,
      { 
        companyId, 
        branchId: branchId || 1, 
        route_code, 
        route_name, 
        origin, 
        destination, 
        distance: distance || 0, 
        estimated_time: estimated_time || 0, 
        active 
      }
    );
    
    res.json({ success: true, message: "Route created successfully", data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

// PUT /transport/routes/:id
export const updateRoute = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { route_code, route_name, origin, destination, distance, estimated_time, is_active } = req.body;
    
    if (!route_name || !origin || !destination) {
      throw httpError(400, "Route name, origin, and destination are required");
    }
    
    const active = is_active !== undefined ? is_active : 1;
    
    await query(
      `UPDATE trans_routes 
       SET route_code = :route_code,
           route_name = :route_name,
           origin = :origin,
           destination = :destination,
           distance = :distance,
           estimated_time = :estimated_time,
           is_active = :active
       WHERE id = :id AND company_id = :companyId`,
      { 
        route_code: route_code || '', 
        route_name, 
        origin, 
        destination, 
        distance: distance || 0, 
        estimated_time: estimated_time || 0, 
        active,
        id,
        companyId
      }
    );
    
    res.json({ success: true, message: "Route updated successfully" });
  } catch (err) {
    next(err);
  }
};

// PUT /transport/routes/:id/toggle
export const toggleRouteStatus = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    await query(
      `UPDATE trans_routes SET is_active = NOT is_active WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    
    res.json({ success: true, message: "Route status updated" });
  } catch (err) {
    next(err);
  }
};
