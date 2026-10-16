import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

// Helper to sanitize numeric values
function toNum(val, defaultVal = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : defaultVal;
}

// Helper to format date-time string
function toIsoDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

/* =========================================================================
   1. PROPERTY & MULTI-TIER HIERARCHY CONTROLLERS
   ========================================================================= */

/**
 * List all properties with high-level statistics (buildings, zones, spaces, assets count)
 */
export async function listProperties(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { clientId, propertyType, status, search } = req.query;

    const conditions = ["p.company_id = ?"];
    const params = [companyId];

    if (clientId) {
      conditions.push("p.client_id = ?");
      params.push(clientId);
    }
    if (propertyType) {
      conditions.push("p.property_type = ?");
      params.push(propertyType);
    }
    if (status) {
      conditions.push("p.status = ?");
      params.push(status);
    }
    if (search) {
      conditions.push("(p.property_name LIKE ? OR p.property_code LIKE ? OR p.city LIKE ? OR p.address LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const sql = `
      SELECT 
        p.*,
        c.customer_name AS client_name,
        c.customer_code AS client_code,
        (SELECT COUNT(*) FROM fm_buildings b WHERE b.property_id = p.id) AS building_count,
        (SELECT COUNT(*) FROM fm_zones z WHERE z.property_id = p.id) AS zone_count,
        (SELECT COUNT(*) FROM fm_spaces s WHERE s.property_id = p.id) AS space_count,
        (SELECT COUNT(*) FROM maint_assets a WHERE a.property_id = p.id) AS asset_count,
        (SELECT COUNT(*) FROM maint_requests r WHERE r.property_id = p.id AND r.status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')) AS open_tickets_count
      FROM fm_properties p
      LEFT JOIN sal_customers c ON c.id = p.client_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.property_name ASC
    `;

    const properties = await query(sql, params);
    res.json({ success: true, data: properties });
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed property with its nested hierarchy (buildings, zones, spaces)
 */
export async function getPropertyById(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;

    const [props] = await pool.query(
      `SELECT p.*, c.customer_name AS client_name, c.customer_code AS client_code
       FROM fm_properties p
       LEFT JOIN sal_customers c ON c.id = p.client_id
       WHERE p.id = ? AND p.company_id = ?`,
      [id, companyId]
    );

    if (props.length === 0) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const property = props[0];

    // Fetch buildings
    const buildings = await query(
      "SELECT * FROM fm_buildings WHERE property_id = ? ORDER BY building_name ASC",
      [id]
    );

    // Fetch zones
    const zones = await query(
      "SELECT * FROM fm_zones WHERE property_id = ? ORDER BY floor_number ASC, zone_name ASC",
      [id]
    );

    // Fetch spaces
    const spaces = await query(
      "SELECT * FROM fm_spaces WHERE property_id = ? ORDER BY space_name ASC",
      [id]
    );

    // Fetch assets at this property
    const assets = await query(
      `SELECT id, asset_no, asset_name, category, make, model, capacity_rating, status, criticality, building_id, zone_id, space_id
       FROM maint_assets WHERE property_id = ? ORDER BY asset_name ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...property,
        buildings,
        zones,
        spaces,
        assets
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get full visual tree hierarchy for a property
 */
export async function getPropertyHierarchy(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;

    const [props] = await pool.query(
      "SELECT * FROM fm_properties WHERE id = ? AND company_id = ?",
      [id, companyId]
    );
    if (!props.length) return res.status(404).json({ success: false, message: "Property not found" });

    const property = props[0];
    const buildings = await query("SELECT * FROM fm_buildings WHERE property_id = ?", [id]);
    const zones = await query("SELECT * FROM fm_zones WHERE property_id = ?", [id]);
    const spaces = await query("SELECT * FROM fm_spaces WHERE property_id = ?", [id]);
    const assets = await query("SELECT * FROM maint_assets WHERE property_id = ?", [id]);

    // Build nested tree structure
    const tree = {
      id: property.id,
      code: property.property_code,
      name: property.property_name,
      type: "PROPERTY",
      property_type: property.property_type,
      buildings: buildings.map(bld => {
        const bldZones = zones.filter(z => z.building_id === bld.id);
        return {
          id: bld.id,
          code: bld.building_code,
          name: bld.building_name,
          type: "BUILDING",
          zones: bldZones.map(zn => {
            const znSpaces = spaces.filter(s => s.zone_id === zn.id);
            return {
              id: zn.id,
              code: zn.zone_code,
              name: zn.zone_name,
              floor: zn.floor_number,
              type: "ZONE",
              spaces: znSpaces.map(sp => {
                const spAssets = assets.filter(a => a.space_id === sp.id);
                return {
                  id: sp.id,
                  code: sp.space_code,
                  name: sp.space_name,
                  type: "SPACE",
                  space_type: sp.space_type,
                  occupant: sp.occupant_tenant_name,
                  assets: spAssets.map(ast => ({
                    id: ast.id,
                    code: ast.asset_no,
                    name: ast.asset_name,
                    category: ast.category,
                    criticality: ast.criticality,
                    status: ast.status,
                    type: "ASSET"
                  }))
                };
              })
            };
          })
        };
      })
    };

    res.json({ success: true, data: tree });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new Property
 */
export async function createProperty(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const {
      client_id,
      property_code,
      property_name,
      property_type = 'COMMERCIAL_OFFICE',
      address,
      city,
      state,
      country = 'Ghana',
      postal_code,
      gps_lat,
      gps_lng,
      total_area_sqm,
      contact_person_name,
      contact_person_phone,
      contact_person_email,
      property_manager_id,
      property_manager_name,
      status = 'ACTIVE',
      notes
    } = req.body;

    if (!property_name?.trim()) {
      return res.status(400).json({ success: false, message: "Property name is required" });
    }

    // Generate property code if omitted
    let finalCode = property_code?.trim();
    if (!finalCode) {
      const prefix = "PROP-";
      const [countResult] = await pool.query(
        "SELECT COUNT(*) AS count FROM fm_properties WHERE company_id = ?",
        [companyId]
      );
      finalCode = `${prefix}${String((countResult[0]?.count || 0) + 1).padStart(4, '0')}`;
    }

    const [result] = await pool.query(
      `INSERT INTO fm_properties 
       (company_id, branch_id, client_id, property_code, property_name, property_type, address, city, state, country, postal_code, gps_lat, gps_lng, total_area_sqm, contact_person_name, contact_person_phone, contact_person_email, property_manager_id, property_manager_name, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        branchId || null,
        client_id || null,
        finalCode,
        property_name.trim(),
        property_type,
        address || null,
        city || null,
        state || null,
        country || 'Ghana',
        postal_code || null,
        toNum(gps_lat) || null,
        toNum(gps_lng) || null,
        toNum(total_area_sqm) || null,
        contact_person_name || null,
        contact_person_phone || null,
        contact_person_email || null,
        property_manager_id || null,
        property_manager_name || null,
        status,
        notes || null,
        req.user?.id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      propertyId: result.insertId,
      property_code: finalCode
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update an existing Property
 */
export async function updateProperty(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;

    const updates = req.body;
    const allowedFields = [
      'client_id', 'property_code', 'property_name', 'property_type', 'address',
      'city', 'state', 'country', 'postal_code', 'gps_lat', 'gps_lng',
      'total_area_sqm', 'contact_person_name', 'contact_person_phone',
      'contact_person_email', 'property_manager_id', 'property_manager_name',
      'status', 'notes'
    ];

    const setClauses = [];
    const params = [];

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        setClauses.push(`\`${key}\` = ?`);
        params.push(updates[key]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided for update" });
    }

    params.push(id, companyId);
    await pool.query(
      `UPDATE fm_properties SET ${setClauses.join(", ")} WHERE id = ? AND company_id = ?`,
      params
    );

    res.json({ success: true, message: "Property updated successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * Buildings CRUD
 */
export async function createBuilding(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, building_code, building_name, total_floors = 1, basement_floors = 0, gross_floor_area_sqm, status = 'ACTIVE' } = req.body;

    if (!property_id || !building_name) {
      return res.status(400).json({ success: false, message: "property_id and building_name are required" });
    }

    const code = building_code || `BLD-${Date.now().toString().slice(-4)}`;
    const [result] = await pool.query(
      `INSERT INTO fm_buildings (company_id, property_id, building_code, building_name, total_floors, basement_floors, gross_floor_area_sqm, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, property_id, code, building_name, toNum(total_floors, 1), toNum(basement_floors, 0), toNum(gross_floor_area_sqm) || null, status]
    );

    res.status(201).json({ success: true, buildingId: result.insertId });
  } catch (err) {
    next(err);
  }
}

export async function updateBuilding(req, res, next) {
  try {
    const { id } = req.params;
    const { building_name, building_code, total_floors, basement_floors, gross_floor_area_sqm, status } = req.body;
    await pool.query(
      `UPDATE fm_buildings SET building_name = COALESCE(?, building_name), building_code = COALESCE(?, building_code), total_floors = COALESCE(?, total_floors), basement_floors = COALESCE(?, basement_floors), gross_floor_area_sqm = COALESCE(?, gross_floor_area_sqm), status = COALESCE(?, status) WHERE id = ?`,
      [building_name, building_code, total_floors, basement_floors, gross_floor_area_sqm, status, id]
    );
    res.json({ success: true, message: "Building updated" });
  } catch (err) {
    next(err);
  }
}

export async function deleteBuilding(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM fm_buildings WHERE id = ?", [id]);
    res.json({ success: true, message: "Building deleted" });
  } catch (err) {
    next(err);
  }
}

/**
 * Zones CRUD
 */
export async function createZone(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, building_id, zone_code, zone_name, floor_number = 0, zone_type = 'FLOOR', status = 'ACTIVE' } = req.body;
    if (!property_id || !building_id || !zone_name) {
      return res.status(400).json({ success: false, message: "property_id, building_id, and zone_name are required" });
    }

    const code = zone_code || `ZN-${Date.now().toString().slice(-4)}`;
    const [result] = await pool.query(
      `INSERT INTO fm_zones (company_id, property_id, building_id, zone_code, zone_name, floor_number, zone_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, property_id, building_id, code, zone_name, toNum(floor_number, 0), zone_type, status]
    );

    res.status(201).json({ success: true, zoneId: result.insertId });
  } catch (err) {
    next(err);
  }
}

export async function updateZone(req, res, next) {
  try {
    const { id } = req.params;
    const { zone_name, zone_code, floor_number, zone_type, status } = req.body;
    await pool.query(
      `UPDATE fm_zones SET zone_name = COALESCE(?, zone_name), zone_code = COALESCE(?, zone_code), floor_number = COALESCE(?, floor_number), zone_type = COALESCE(?, zone_type), status = COALESCE(?, status) WHERE id = ?`,
      [zone_name, zone_code, floor_number, zone_type, status, id]
    );
    res.json({ success: true, message: "Zone updated" });
  } catch (err) {
    next(err);
  }
}

export async function deleteZone(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM fm_zones WHERE id = ?", [id]);
    res.json({ success: true, message: "Zone deleted" });
  } catch (err) {
    next(err);
  }
}

/**
 * Spaces CRUD
 */
export async function createSpace(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, building_id, zone_id, space_code, space_name, space_type = 'OFFICE_SUITE', occupant_tenant_name, area_sqm, status = 'ACTIVE' } = req.body;
    if (!property_id || !building_id || !zone_id || !space_name) {
      return res.status(400).json({ success: false, message: "property_id, building_id, zone_id, and space_name are required" });
    }

    const code = space_code || `SPC-${Date.now().toString().slice(-4)}`;
    const [result] = await pool.query(
      `INSERT INTO fm_spaces (company_id, property_id, building_id, zone_id, space_code, space_name, space_type, occupant_tenant_name, area_sqm, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, property_id, building_id, zone_id, code, space_name, space_type, occupant_tenant_name || null, toNum(area_sqm) || null, status]
    );

    res.status(201).json({ success: true, spaceId: result.insertId });
  } catch (err) {
    next(err);
  }
}

export async function updateSpace(req, res, next) {
  try {
    const { id } = req.params;
    const { space_name, space_code, space_type, occupant_tenant_name, area_sqm, status } = req.body;
    await pool.query(
      `UPDATE fm_spaces SET space_name = COALESCE(?, space_name), space_code = COALESCE(?, space_code), space_type = COALESCE(?, space_type), occupant_tenant_name = COALESCE(?, occupant_tenant_name), area_sqm = COALESCE(?, area_sqm), status = COALESCE(?, status) WHERE id = ?`,
      [space_name, space_code, space_type, occupant_tenant_name, area_sqm, status, id]
    );
    res.json({ success: true, message: "Space updated" });
  } catch (err) {
    next(err);
  }
}

export async function deleteSpace(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM fm_spaces WHERE id = ?", [id]);
    res.json({ success: true, message: "Space deleted" });
  } catch (err) {
    next(err);
  }
}

/* =========================================================================
   2. FACILITIES SERVICE CONTRACTS & SLA ENGINE
   ========================================================================= */

/**
 * List all FM Service Contracts with client info, covered properties count, and SLA specs
 */
export async function listContracts(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { clientId, status } = req.query;

    const conditions = ["ctr.company_id = ?"];
    const params = [companyId];

    if (clientId) {
      conditions.push("ctr.client_id = ?");
      params.push(clientId);
    }
    if (status) {
      conditions.push("ctr.contract_status = ?");
      params.push(status);
    }

    const contracts = await query(
      `SELECT 
        ctr.*,
        c.customer_name AS client_name,
        c.customer_code AS client_code,
        (SELECT COUNT(*) FROM fm_contract_properties cp WHERE cp.contract_id = ctr.id) AS property_count,
        (SELECT COUNT(*) FROM fm_contract_service_lines csl WHERE csl.contract_id = ctr.id AND csl.is_covered = 1) AS covered_service_lines_count
       FROM fm_service_contracts ctr
       LEFT JOIN sal_customers c ON c.id = ctr.client_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ctr.end_date DESC`,
      params
    );

    res.json({ success: true, data: contracts });
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed contract with covered properties and service lines
 */
export async function getContractById(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;

    const [ctrList] = await pool.query(
      `SELECT ctr.*, c.customer_name AS client_name, c.customer_code AS client_code
       FROM fm_service_contracts ctr
       LEFT JOIN sal_customers c ON c.id = ctr.client_id
       WHERE ctr.id = ? AND ctr.company_id = ?`,
      [id, companyId]
    );

    if (ctrList.length === 0) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    const contract = ctrList[0];

    // Covered properties
    const properties = await query(
      `SELECT cp.id AS link_id, cp.notes, p.id AS property_id, p.property_code, p.property_name, p.property_type, p.city, p.address
       FROM fm_contract_properties cp
       JOIN fm_properties p ON p.id = cp.property_id
       WHERE cp.contract_id = ?`,
      [id]
    );

    // Covered service lines
    const serviceLines = await query(
      "SELECT * FROM fm_contract_service_lines WHERE contract_id = ?",
      [id]
    );

    // Specific SLA policies
    const slaPolicies = await query(
      "SELECT * FROM fm_sla_policies WHERE contract_id = ?",
      [id]
    );

    res.json({
      success: true,
      data: {
        ...contract,
        properties,
        service_lines: serviceLines,
        sla_policies: slaPolicies
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new FM Service Contract
 */
export async function createContract(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId } = req.scope || {};
    const {
      contract_no,
      contract_title,
      client_id,
      start_date,
      end_date,
      billing_frequency = 'MONTHLY',
      billing_amount = 0,
      contract_value = 0,
      payment_terms = '30 Days Net',
      emergency_callout_included = 1,
      emergency_callout_limit = 0,
      sla_standard_response_hours = 4.0,
      sla_standard_resolution_hours = 24.0,
      sla_critical_response_hours = 1.0,
      sla_critical_resolution_hours = 4.0,
      contract_status = 'ACTIVE',
      renewal_reminder_days = 30,
      terms_and_conditions,
      property_ids = [],
      service_lines = []
    } = req.body;

    if (!contract_title || !client_id || !start_date || !end_date) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Contract title, client, start date, and end date are required" });
    }

    let finalContractNo = contract_no?.trim();
    if (!finalContractNo) {
      finalContractNo = `FMC-${Date.now().toString().slice(-6)}`;
    }

    const [resHeader] = await conn.query(
      `INSERT INTO fm_service_contracts 
       (company_id, branch_id, contract_no, contract_title, client_id, start_date, end_date, billing_frequency, billing_amount, contract_value, payment_terms, emergency_callout_included, emergency_callout_limit, sla_standard_response_hours, sla_standard_resolution_hours, sla_critical_response_hours, sla_critical_resolution_hours, contract_status, renewal_reminder_days, terms_and_conditions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        branchId || null,
        finalContractNo,
        contract_title.trim(),
        client_id,
        start_date,
        end_date,
        billing_frequency,
        toNum(billing_amount),
        toNum(contract_value),
        payment_terms,
        emergency_callout_included ? 1 : 0,
        toNum(emergency_callout_limit, 0),
        toNum(sla_standard_response_hours, 4.0),
        toNum(sla_standard_resolution_hours, 24.0),
        toNum(sla_critical_response_hours, 1.0),
        toNum(sla_critical_resolution_hours, 4.0),
        contract_status,
        toNum(renewal_reminder_days, 30),
        terms_and_conditions || null,
        req.user?.id || null
      ]
    );

    const contractId = resHeader.insertId;

    // Insert linked properties
    for (const propId of property_ids) {
      await conn.query(
        "INSERT INTO fm_contract_properties (contract_id, property_id) VALUES (?, ?)",
        [contractId, propId]
      );
    }

    // Insert covered service lines
    for (const sl of service_lines) {
      await conn.query(
        `INSERT INTO fm_contract_service_lines (contract_id, service_line, is_covered, coverage_scope_notes, max_included_labor_hours, parts_included)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          contractId,
          sl.service_line,
          sl.is_covered !== undefined ? (sl.is_covered ? 1 : 0) : 1,
          sl.coverage_scope_notes || null,
          toNum(sl.max_included_labor_hours, 0),
          sl.parts_included ? 1 : 0
        ]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "FM Service Contract created successfully",
      contractId,
      contract_no: finalContractNo
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * Check if a specific service line on a property is covered by an active contract
 */
export async function checkContractCoverage(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, service_line } = req.query;

    if (!property_id || !service_line) {
      return res.status(400).json({ success: false, message: "property_id and service_line are required" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const sql = `
      SELECT 
        ctr.id AS contract_id,
        ctr.contract_no,
        ctr.contract_title,
        ctr.client_id,
        ctr.emergency_callout_included,
        ctr.emergency_callout_limit,
        ctr.emergency_callouts_used,
        ctr.sla_standard_response_hours,
        ctr.sla_standard_resolution_hours,
        ctr.sla_critical_response_hours,
        ctr.sla_critical_resolution_hours,
        csl.is_covered,
        csl.parts_included,
        csl.max_included_labor_hours,
        csl.coverage_scope_notes
      FROM fm_contract_properties cp
      JOIN fm_service_contracts ctr ON ctr.id = cp.contract_id
      LEFT JOIN fm_contract_service_lines csl ON csl.contract_id = ctr.id AND csl.service_line = ?
      WHERE cp.property_id = ? 
        AND ctr.company_id = ?
        AND ctr.contract_status = 'ACTIVE'
        AND ? BETWEEN ctr.start_date AND ctr.end_date
      LIMIT 1
    `;

    const coverage = await query(sql, [service_line, property_id, companyId, today]);

    if (coverage.length === 0) {
      return res.json({
        success: true,
        covered: false,
        billable_type: 'BILLABLE_EXTRA',
        message: "No active service contract covers this property/service line. Work will be billed separately."
      });
    }

    const c = coverage[0];
    const isCovered = c.is_covered === 1;

    res.json({
      success: true,
      covered: isCovered,
      billable_type: isCovered ? 'CONTRACT_COVERED' : 'BILLABLE_EXTRA',
      contract: {
        id: c.contract_id,
        contract_no: c.contract_no,
        contract_title: c.contract_title,
        client_id: c.client_id,
        parts_included: c.parts_included === 1,
        emergency_callouts_remaining: c.emergency_callout_limit > 0 ? Math.max(0, c.emergency_callout_limit - c.emergency_callouts_used) : 'Unlimited',
        sla_standard_response_hours: c.sla_standard_response_hours,
        sla_standard_resolution_hours: c.sla_standard_resolution_hours,
        sla_critical_response_hours: c.sla_critical_response_hours,
        sla_critical_resolution_hours: c.sla_critical_resolution_hours
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Generate recurring client contract invoice into Finance (srv_service_invoices)
 */
export async function generateContractInvoice(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId } = req.scope || {};
    const { id } = req.params;
    const { billing_period = 'Current Period' } = req.body;

    const [contracts] = await conn.query(
      "SELECT * FROM fm_service_contracts WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    if (contracts.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    const ctr = contracts[0];
    if (toNum(ctr.billing_amount) <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Contract billing amount is 0.00" });
    }

    const invNo = `INV-FM-${Date.now().toString().slice(-6)}`;
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [invRes] = await conn.query(
      `INSERT INTO srv_service_invoices
       (company_id, branch_id, invoice_no, invoice_date, customer_id, due_date, status, remarks, total_amount, net_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
      [
        companyId,
        branchId || null,
        invNo,
        today,
        ctr.client_id,
        dueDate,
        `Facilities Management Contract Fee (${billing_period}) - Contract #${ctr.contract_no}: ${ctr.contract_title}`,
        ctr.billing_amount,
        ctr.billing_amount,
        req.user?.id || null
      ]
    );

    const invoiceId = invRes.insertId;

    // Insert invoice detail line item
    await conn.query(
      `INSERT INTO srv_service_invoice_details
       (invoice_id, item_id, quantity, unit_price, total_amount, net_amount, uom, remarks, created_by)
       VALUES (?, 0, 1, ?, ?, ?, 'PERIOD', ?, ?)`,
      [
        invoiceId,
        ctr.billing_amount,
        ctr.billing_amount,
        ctr.billing_amount,
        `Facilities Management Service Fee - ${ctr.contract_title}`,
        req.user?.id || null
      ]
    );

    await conn.commit();
    res.json({
      success: true,
      message: "Contract billing invoice generated in Finance successfully",
      invoiceId,
      invoice_no: invNo
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/* =========================================================================
   3. FM HELPDESK TICKETS & SLA ENGINE
   ========================================================================= */

/**
 * List FM Service Tickets with SLA countdown and breach calculations
 */
export async function listFMTickets(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status, priority, serviceLine, search } = req.query;

    const conditions = ["r.company_id = ?"];
    const params = [companyId];

    if (propertyId) {
      conditions.push("r.property_id = ?");
      params.push(propertyId);
    }
    if (status) {
      conditions.push("r.status = ?");
      params.push(status);
    }
    if (priority) {
      conditions.push("r.priority = ?");
      params.push(priority);
    }
    if (serviceLine) {
      conditions.push("r.service_line = ?");
      params.push(serviceLine);
    }
    if (search) {
      conditions.push("(r.request_no LIKE ? OR r.description LIKE ? OR r.requester_name LIKE ? OR p.property_name LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const sql = `
      SELECT 
        r.*,
        p.property_name,
        p.property_code,
        b.building_name,
        z.zone_name,
        s.space_name,
        c.customer_name AS client_name,
        (SELECT COUNT(*) FROM maint_job_orders jo WHERE jo.request_id = r.id) AS work_order_count
      FROM maint_requests r
      LEFT JOIN fm_properties p ON p.id = r.property_id
      LEFT JOIN fm_buildings b ON b.id = r.building_id
      LEFT JOIN fm_zones z ON z.id = r.zone_id
      LEFT JOIN fm_spaces s ON s.id = r.space_id
      LEFT JOIN sal_customers c ON c.id = r.client_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.id DESC
    `;

    const tickets = await query(sql, params);

    // Compute SLA live compliance status
    const now = new Date();
    const enriched = tickets.map(t => {
      let slaStatus = 'ON_TRACK';
      if (t.status === 'COMPLETED' || t.status === 'CLOSED') {
        slaStatus = t.sla_resolution_breached ? 'BREACHED' : 'MET';
      } else if (t.sla_paused_at) {
        slaStatus = 'PAUSED';
      } else if (t.sla_resolution_due && new Date(t.sla_resolution_due) < now) {
        slaStatus = 'BREACHED';
      } else if (t.sla_resolution_due && (new Date(t.sla_resolution_due).getTime() - now.getTime()) < 2 * 60 * 60 * 1000) {
        slaStatus = 'AT_RISK';
      }
      return { ...t, computed_sla_status: slaStatus };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

/**
 * Create FM Ticket with SLA response & resolution target calculation
 */
export async function createFMTicket(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const {
      property_id,
      building_id,
      zone_id,
      space_id,
      client_id,
      contract_id,
      asset_id,
      service_line = 'GENERAL_BUILDING_FABRIC',
      priority = 'MEDIUM',
      requester_name,
      department,
      tenant_contact_name,
      tenant_contact_phone,
      tenant_unit,
      description,
      notes,
      billable_type = 'CONTRACT_COVERED'
    } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: "Issue description is required" });
    }

    const requestNo = `SR-FM-${Date.now().toString().slice(-6)}`;
    const today = new Date().toISOString().slice(0, 10);

    // Calculate SLA Targets based on Priority (or Contract terms if supplied)
    let responseHours = 4.0;
    let resolutionHours = 24.0;

    if (contract_id) {
      const [ctr] = await pool.query("SELECT * FROM fm_service_contracts WHERE id = ?", [contract_id]);
      if (ctr.length > 0) {
        if (priority === 'EMERGENCY' || priority === 'CRITICAL') {
          responseHours = toNum(ctr[0].sla_critical_response_hours, 1.0);
          resolutionHours = toNum(ctr[0].sla_critical_resolution_hours, 4.0);
        } else {
          responseHours = toNum(ctr[0].sla_standard_response_hours, 4.0);
          resolutionHours = toNum(ctr[0].sla_standard_resolution_hours, 24.0);
        }
      }
    } else {
      switch (priority.toUpperCase()) {
        case 'EMERGENCY':
          responseHours = 1.0;
          resolutionHours = 4.0;
          break;
        case 'CRITICAL':
          responseHours = 2.0;
          resolutionHours = 8.0;
          break;
        case 'HIGH':
          responseHours = 4.0;
          resolutionHours = 16.0;
          break;
        case 'LOW':
          responseHours = 24.0;
          resolutionHours = 48.0;
          break;
        case 'MEDIUM':
        default:
          responseHours = 8.0;
          resolutionHours = 24.0;
          break;
      }
    }

    const nowTime = Date.now();
    const slaResponseDue = new Date(nowTime + responseHours * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    const slaResolutionDue = new Date(nowTime + resolutionHours * 3600000).toISOString().slice(0, 19).replace('T', ' ');

    let assetName = null;
    if (asset_id) {
      const [a] = await pool.query("SELECT asset_name FROM maint_assets WHERE id = ?", [asset_id]);
      assetName = a[0]?.asset_name || null;
    }

    const [result] = await pool.query(
      `INSERT INTO maint_requests 
       (company_id, branch_id, request_no, request_date, property_id, building_id, zone_id, space_id, client_id, contract_id, asset_id, asset_name, service_line, priority, sla_priority, sla_response_due, sla_resolution_due, billable_type, requester_name, department, tenant_contact_name, tenant_contact_phone, tenant_unit, description, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)`,
      [
        companyId,
        branchId || 1,
        requestNo,
        today,
        property_id || null,
        building_id || null,
        zone_id || null,
        space_id || null,
        client_id || null,
        contract_id || null,
        asset_id || null,
        assetName,
        service_line,
        priority,
        priority,
        slaResponseDue,
        slaResolutionDue,
        billable_type,
        requester_name || tenant_contact_name || 'Anonymous',
        department || null,
        tenant_contact_name || null,
        tenant_contact_phone || null,
        tenant_unit || null,
        description.trim(),
        notes || null,
        req.user?.id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "FM Service Ticket created successfully with SLA targets",
      ticketId: result.insertId,
      request_no: requestNo,
      sla_response_due: slaResponseDue,
      sla_resolution_due: slaResolutionDue
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Pause Ticket SLA Clock (e.g. Awaiting client access, waiting for parts)
 */
export async function pauseTicketSLA(req, res, next) {
  try {
    const { id } = req.params;
    const { pause_reason = 'Awaiting Client Approval / Spare Parts' } = req.body;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      `UPDATE maint_requests 
       SET sla_paused_at = ?, sla_pause_reason = ?, status = 'AWAITING_PARTS'
       WHERE id = ? AND sla_paused_at IS NULL`,
      [now, pause_reason, id]
    );

    res.json({ success: true, message: "SLA paused successfully", paused_at: now });
  } catch (err) {
    next(err);
  }
}

/**
 * Resume Ticket SLA Clock (extends targets by paused duration)
 */
export async function resumeTicketSLA(req, res, next) {
  try {
    const { id } = req.params;

    const [tickets] = await pool.query(
      "SELECT sla_paused_at, sla_response_due, sla_resolution_due, total_paused_minutes FROM maint_requests WHERE id = ?",
      [id]
    );

    if (tickets.length === 0 || !tickets[0].sla_paused_at) {
      return res.status(400).json({ success: false, message: "Ticket is not currently paused" });
    }

    const t = tickets[0];
    const pausedTime = new Date(t.sla_paused_at).getTime();
    const resumeTime = Date.now();
    const pausedMinutes = Math.max(0, Math.round((resumeTime - pausedTime) / 60000));
    const totalPaused = (t.total_paused_minutes || 0) + pausedMinutes;

    // Shift targets forward by paused duration
    let newResponseDue = t.sla_response_due;
    if (newResponseDue) {
      newResponseDue = new Date(new Date(t.sla_response_due).getTime() + pausedMinutes * 60000).toISOString().slice(0, 19).replace('T', ' ');
    }
    let newResolutionDue = t.sla_resolution_due;
    if (newResolutionDue) {
      newResolutionDue = new Date(new Date(t.sla_resolution_due).getTime() + pausedMinutes * 60000).toISOString().slice(0, 19).replace('T', ' ');
    }

    await pool.query(
      `UPDATE maint_requests 
       SET sla_paused_at = NULL, 
           sla_resumed_at = CURRENT_TIMESTAMP,
           total_paused_minutes = ?,
           sla_response_due = ?,
           sla_resolution_due = ?,
           status = 'IN_PROGRESS'
       WHERE id = ?`,
      [totalPaused, newResponseDue, newResolutionDue, id]
    );

    res.json({
      success: true,
      message: `SLA resumed. Targets adjusted by ${pausedMinutes} minutes`,
      sla_resolution_due: newResolutionDue
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Convert FM Ticket directly into a Work Order
 */
export async function convertTicketToWorkOrder(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { assigned_technician, assigned_team, scheduled_date, estimated_hours = 2.0, instructions } = req.body;

    const [tickets] = await conn.query("SELECT * FROM maint_requests WHERE id = ?", [id]);
    if (tickets.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const t = tickets[0];
    const orderNo = `WO-FM-${Date.now().toString().slice(-6)}`;
    const today = new Date().toISOString().slice(0, 10);

    const [resWo] = await conn.query(
      `INSERT INTO maint_job_orders 
       (company_id, branch_id, order_no, order_date, request_id, property_id, building_id, zone_id, space_id, client_id, contract_id, asset_id, asset_name, service_line, priority, order_type, job_order_type, assigned_team, assigned_technician, scheduled_date, estimated_hours, instructions, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CORRECTIVE', 'FACILITIES_MAINTENANCE', ?, ?, ?, ?, ?, 'ASSIGNED', ?)`,
      [
        t.company_id,
        t.branch_id || 1,
        orderNo,
        today,
        t.id,
        t.property_id || null,
        t.building_id || null,
        t.zone_id || null,
        t.space_id || null,
        t.client_id || null,
        t.contract_id || null,
        t.asset_id || null,
        t.asset_name || null,
        t.service_line || 'GENERAL_BUILDING_FABRIC',
        t.priority || 'MEDIUM',
        assigned_team || 'Field Operations Team',
        assigned_technician || null,
        scheduled_date || today,
        toNum(estimated_hours, 2.0),
        instructions || t.description,
        req.user?.id || null
      ]
    );

    // Update ticket status to IN_PROGRESS
    await conn.query(
      "UPDATE maint_requests SET status = 'IN_PROGRESS', responded_at = COALESCE(responded_at, CURRENT_TIMESTAMP) WHERE id = ?",
      [id]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Work Order created successfully from FM Ticket",
      workOrderId: resWo.insertId,
      order_no: orderNo
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/* =========================================================================
   4. FIELD TECHNICIAN MOBILE WORKFLOW & SERVICE REPORTS
   ========================================================================= */

/**
 * Get active jobs assigned to technician
 */
export async function getTechnicianJobs(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { technicianName, status } = req.query;

    const conditions = ["jo.company_id = ?"];
    const params = [companyId];

    if (technicianName) {
      conditions.push("jo.assigned_technician = ?");
      params.push(technicianName);
    }
    if (status) {
      conditions.push("jo.status = ?");
      params.push(status);
    } else {
      conditions.push("jo.status NOT IN ('CLOSED', 'CANCELLED')");
    }

    const sql = `
      SELECT 
        jo.*,
        p.property_name,
        p.property_code,
        p.address AS property_address,
        p.gps_lat,
        p.gps_lng,
        b.building_name,
        z.zone_name,
        s.space_name,
        c.customer_name AS client_name,
        r.request_no,
        r.sla_resolution_due
      FROM maint_job_orders jo
      LEFT JOIN fm_properties p ON p.id = jo.property_id
      LEFT JOIN fm_buildings b ON b.id = jo.building_id
      LEFT JOIN fm_zones z ON z.id = jo.zone_id
      LEFT JOIN fm_spaces s ON s.id = jo.space_id
      LEFT JOIN sal_customers c ON c.id = jo.client_id
      LEFT JOIN maint_requests r ON r.id = jo.request_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY jo.id DESC
    `;

    const jobs = await query(sql, params);
    res.json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
}

/**
 * Field technician status transitions (ASSIGNED -> TRAVELING -> ON_SITE -> IN_PROGRESS -> COMPLETED)
 */
export async function transitionJobStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { new_status, safety_briefing_acknowledged, risk_assessment_notes, vehicle_id } = req.body;

    const allowed = ['ASSIGNED', 'TRAVELING', 'ON_SITE', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'];
    if (!allowed.includes(new_status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${new_status}` });
    }

    const updates = ["status = ?"];
    const params = [new_status];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (new_status === 'TRAVELING') {
      updates.push("travel_start_time = ?");
      params.push(now);
      if (vehicle_id) {
        updates.push("vehicle_id = ?");
        params.push(vehicle_id);
      }
    } else if (new_status === 'ON_SITE') {
      updates.push("arrival_time = ?");
      params.push(now);
    } else if (new_status === 'IN_PROGRESS') {
      updates.push("job_start_time = COALESCE(job_start_time, ?)");
      params.push(now);
      if (safety_briefing_acknowledged) {
        updates.push("safety_briefing_acknowledged = 1");
      }
      if (risk_assessment_notes) {
        updates.push("risk_assessment_notes = ?");
        params.push(risk_assessment_notes);
      }
    } else if (new_status === 'COMPLETED') {
      updates.push("job_end_time = ?");
      params.push(now);
    }

    params.push(id);
    await pool.query(`UPDATE maint_job_orders SET ${updates.join(", ")} WHERE id = ?`, params);

    res.json({ success: true, message: `Work order transitioned to ${new_status}`, status: new_status });
  } catch (err) {
    next(err);
  }
}

/**
 * Complete Field Service Work Order with Customer Sign-off & Report
 */
export async function completeJobWithSignoff(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const {
      actual_hours = 1.0,
      completion_notes,
      work_performed,
      root_cause,
      corrective_action,
      customer_signature_name,
      customer_signature_data,
      customer_satisfaction_rating = 5,
      customer_feedback,
      before_photos = [],
      after_photos = [],
      total_material_cost = 0
    } = req.body;

    const [wos] = await conn.query("SELECT * FROM maint_job_orders WHERE id = ?", [id]);
    if (wos.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Work order not found" });
    }

    const wo = wos[0];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Update work order
    await conn.query(
      `UPDATE maint_job_orders 
       SET status = 'COMPLETED',
           actual_hours = ?,
           completion_notes = ?,
           customer_signature_name = ?,
           customer_signature_data = ?,
           customer_satisfaction_rating = ?,
           customer_feedback = ?,
           before_photos = ?,
           after_photos = ?,
           job_end_time = ?
       WHERE id = ?`,
      [
        toNum(actual_hours, 1.0),
        completion_notes || work_performed,
        customer_signature_name || null,
        customer_signature_data || null,
        toNum(customer_satisfaction_rating, 5),
        customer_feedback || null,
        JSON.stringify(before_photos),
        JSON.stringify(after_photos),
        now,
        id
      ]
    );

    // Create formal FM Service Report
    const reportNo = `FSR-${Date.now().toString().slice(-6)}`;
    await conn.query(
      `INSERT INTO fm_service_reports 
       (work_order_id, company_id, report_no, property_id, client_id, technician_name, work_performed, root_cause, corrective_action, safety_protocols_followed, total_labor_hours, total_material_cost, customer_representative_name, customer_signature_data, customer_feedback, customer_rating, signed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        wo.company_id,
        reportNo,
        wo.property_id || null,
        wo.client_id || null,
        wo.assigned_technician || 'Technician',
        work_performed || completion_notes || 'Service successfully completed',
        root_cause || null,
        corrective_action || null,
        toNum(actual_hours, 1.0),
        toNum(total_material_cost, 0),
        customer_signature_name || 'Client Representative',
        customer_signature_data || null,
        customer_feedback || null,
        toNum(customer_satisfaction_rating, 5),
        now
      ]
    );

    // If linked to a request, mark request RESOLVED/COMPLETED
    if (wo.request_id) {
      const [reqs] = await conn.query("SELECT sla_resolution_due FROM maint_requests WHERE id = ?", [wo.request_id]);
      const isBreached = reqs[0]?.sla_resolution_due ? new Date() > new Date(reqs[0].sla_resolution_due) : false;

      await conn.query(
        `UPDATE maint_requests 
         SET status = 'COMPLETED', resolved_at = ?, sla_resolution_breached = ?
         WHERE id = ?`,
        [now, isBreached ? 1 : 0, wo.request_id]
      );
    }

    await conn.commit();
    res.json({
      success: true,
      message: "Job completed with official customer sign-off report",
      report_no: reportNo
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/* =========================================================================
   5. DIGITAL INSPECTIONS & CHECKLISTS ENGINE
   ========================================================================= */

/**
 * List Checklist Templates
 */
export async function listChecklistTemplates(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { serviceLine } = req.query;

    const conditions = ["company_id = ?", "is_active = 1"];
    const params = [companyId];

    if (serviceLine) {
      conditions.push("service_line = ?");
      params.push(serviceLine);
    }

    const templates = await query(
      `SELECT t.*, (SELECT COUNT(*) FROM fm_checklist_template_items i WHERE i.template_id = t.id) AS item_count
       FROM fm_checklist_templates t
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.template_name ASC`,
      params
    );

    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Checklist Template with Items
 */
export async function getChecklistTemplateById(req, res, next) {
  try {
    const { id } = req.params;
    const [templates] = await pool.query("SELECT * FROM fm_checklist_templates WHERE id = ?", [id]);
    if (!templates.length) return res.status(404).json({ success: false, message: "Template not found" });

    const items = await query(
      "SELECT * FROM fm_checklist_template_items WHERE template_id = ? ORDER BY item_sequence ASC, id ASC",
      [id]
    );

    res.json({ success: true, data: { ...templates[0], items } });
  } catch (err) {
    next(err);
  }
}

/**
 * Create Checklist Template with Items
 */
export async function createChecklistTemplate(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId } = req.scope || {};
    const { template_code, template_name, service_line, description, items = [] } = req.body;

    if (!template_name || !service_line) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "template_name and service_line are required" });
    }

    const code = template_code || `TPL-${service_line.slice(0, 4)}-${Date.now().toString().slice(-4)}`;

    const [tplRes] = await conn.query(
      `INSERT INTO fm_checklist_templates (company_id, template_code, template_name, service_line, description)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, code, template_name, service_line, description || null]
    );

    const templateId = tplRes.insertId;

    let seq = 1;
    for (const item of items) {
      await conn.query(
        `INSERT INTO fm_checklist_template_items 
         (template_id, item_sequence, section_header, item_text, field_type, min_reading, max_reading, unit_of_measure, is_critical, failure_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          templateId,
          item.item_sequence || seq++,
          item.section_header || null,
          item.item_text,
          item.field_type || 'PASS_FAIL',
          toNum(item.min_reading) || null,
          toNum(item.max_reading) || null,
          item.unit_of_measure || null,
          item.is_critical ? 1 : 0,
          item.failure_action || 'CREATE_WORK_ORDER'
        ]
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: "Checklist template created", templateId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * Execute/Submit Inspection Checklist on a Work Order
 * (Evaluates Pass/Fail & Numeric Ranges; triggers corrective Work Order on critical failures!)
 */
export async function executeChecklist(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const {
      work_order_id,
      template_id,
      overall_notes,
      item_values = []
    } = req.body;

    if (!work_order_id || !template_id) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "work_order_id and template_id are required" });
    }

    const [tplList] = await conn.query("SELECT * FROM fm_checklist_templates WHERE id = ?", [template_id]);
    const templateName = tplList[0]?.template_name || "Inspection Checklist";

    // Fetch existing work order info
    const [woList] = await conn.query("SELECT * FROM maint_job_orders WHERE id = ?", [work_order_id]);
    const wo = woList[0] || {};

    let hasCriticalFail = false;
    let anyFail = false;
    const correctiveActionItems = [];

    // Create execution header
    const [clRes] = await conn.query(
      `INSERT INTO fm_work_order_checklists 
       (work_order_id, template_id, template_name, completed_by, completed_at, overall_notes)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [work_order_id, template_id, templateName, req.user?.id || null, overall_notes || null]
    );

    const checklistId = clRes.insertId;

    // Process each item value
    for (const val of item_values) {
      let isOutOfRange = 0;
      let isItemFailed = false;

      if (val.field_type === 'PASS_FAIL' && val.status_result === 'FAIL') {
        isItemFailed = true;
      } else if (val.field_type === 'YES_NO_NA' && val.status_result === 'NO') {
        isItemFailed = true;
      } else if (val.field_type === 'NUMERIC_READING') {
        const num = toNum(val.numeric_value);
        if (val.min_reading !== undefined && val.min_reading !== null && num < Number(val.min_reading)) {
          isOutOfRange = 1;
          isItemFailed = true;
        }
        if (val.max_reading !== undefined && val.max_reading !== null && num > Number(val.max_reading)) {
          isOutOfRange = 1;
          isItemFailed = true;
        }
      }

      if (isItemFailed) {
        anyFail = true;
        if (val.is_critical) {
          hasCriticalFail = true;
          correctiveActionItems.push(val.item_text);
        }
      }

      await conn.query(
        `INSERT INTO fm_work_order_checklist_values 
         (checklist_id, template_item_id, item_text, field_type, status_result, numeric_value, text_value, photo_url, is_out_of_range)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          checklistId,
          val.template_item_id,
          val.item_text,
          val.field_type,
          val.status_result || null,
          toNum(val.numeric_value) || null,
          val.text_value || null,
          val.photo_url || null,
          isOutOfRange
        ]
      );
    }

    const overallResult = hasCriticalFail ? 'FAIL' : (anyFail ? 'CONDITIONAL_PASS' : 'PASS');
    await conn.query(
      "UPDATE fm_work_order_checklists SET overall_result = ? WHERE id = ?",
      [overallResult, checklistId]
    );

    // Auto-create Corrective Work Order if critical failure occurred!
    let correctiveWorkOrderId = null;
    if (hasCriticalFail && wo.company_id) {
      const correctiveOrderNo = `WO-CORR-${Date.now().toString().slice(-6)}`;
      const today = new Date().toISOString().slice(0, 10);
      const instructions = `CORRECTIVE WORK REQUIRED from Inspection ${templateName} on WO #${wo.order_no}:\nFailed Items:\n- ${correctiveActionItems.join("\n- ")}`;

      const [resCorr] = await conn.query(
        `INSERT INTO maint_job_orders 
         (company_id, branch_id, order_no, order_date, property_id, building_id, zone_id, space_id, client_id, contract_id, asset_id, asset_name, service_line, priority, order_type, job_order_type, assigned_team, scheduled_date, instructions, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CRITICAL', 'CORRECTIVE', 'FACILITIES_MAINTENANCE', ?, ?, ?, 'ASSIGNED', ?)`,
        [
          wo.company_id,
          wo.branch_id || 1,
          correctiveOrderNo,
          today,
          wo.property_id || null,
          wo.building_id || null,
          wo.zone_id || null,
          wo.space_id || null,
          wo.client_id || null,
          wo.contract_id || null,
          wo.asset_id || null,
          wo.asset_name || null,
          wo.service_line || 'GENERAL_BUILDING_FABRIC',
          wo.assigned_team || 'Corrective Action Team',
          today,
          instructions,
          req.user?.id || null
        ]
      );
      correctiveWorkOrderId = resCorr.insertId;
    }

    await conn.commit();
    res.json({
      success: true,
      message: `Checklist recorded with result: ${overallResult}`,
      overall_result: overallResult,
      checklistId,
      corrective_work_order_id: correctiveWorkOrderId
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/* =========================================================================
   6. SOFT FACILITIES SERVICES LOGS (Janitorial, Security, Pest, Waste)
   ========================================================================= */

// Janitorial Logs
export async function listJanitorialLogs(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, fromDate, toDate } = req.query;

    const conditions = ["j.company_id = ?"];
    const params = [companyId];

    if (propertyId) {
      conditions.push("j.property_id = ?");
      params.push(propertyId);
    }
    if (fromDate && toDate) {
      conditions.push("j.log_date BETWEEN ? AND ?");
      params.push(fromDate, toDate);
    }

    const logs = await query(
      `SELECT j.*, p.property_name, s.space_name 
       FROM fm_janitorial_logs j
       LEFT JOIN fm_properties p ON p.id = j.property_id
       LEFT JOIN fm_spaces s ON s.id = j.space_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY j.log_date DESC, j.id DESC`,
      params
    );
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function createJanitorialLog(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, space_id, cleaner_name, log_date, shift = 'MORNING', restrooms_sanitized = 1, floors_mopped = 1, trash_emptied = 1, soap_paper_restocked = 1, supervisor_rating = 5, supervisor_name, notes } = req.body;

    if (!property_id || !cleaner_name || !log_date) {
      return res.status(400).json({ success: false, message: "property_id, cleaner_name, and log_date are required" });
    }

    const [resLog] = await pool.query(
      `INSERT INTO fm_janitorial_logs 
       (company_id, property_id, space_id, cleaner_name, log_date, shift, restrooms_sanitized, floors_mopped, trash_emptied, soap_paper_restocked, supervisor_rating, supervisor_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, property_id, space_id || null, cleaner_name, log_date, shift, restrooms_sanitized ? 1 : 0, floors_mopped ? 1 : 0, trash_emptied ? 1 : 0, soap_paper_restocked ? 1 : 0, toNum(supervisor_rating, 5), supervisor_name || null, notes || null]
    );

    res.status(201).json({ success: true, message: "Janitorial log recorded", logId: resLog.insertId });
  } catch (err) {
    next(err);
  }
}

// Security Patrol Logs
export async function listSecurityPatrolLogs(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status } = req.query;

    const conditions = ["sec.company_id = ?"];
    const params = [companyId];

    if (propertyId) {
      conditions.push("sec.property_id = ?");
      params.push(propertyId);
    }
    if (status) {
      conditions.push("sec.checkpoint_status = ?");
      params.push(status);
    }

    const logs = await query(
      `SELECT sec.*, p.property_name 
       FROM fm_security_patrol_logs sec
       LEFT JOIN fm_properties p ON p.id = sec.property_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY sec.patrol_time DESC`,
      params
    );
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function createSecurityPatrolLog(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, guard_name, checkpoint_name, checkpoint_status = 'SECURE', incident_description, action_taken, photo_url } = req.body;

    if (!property_id || !guard_name || !checkpoint_name) {
      return res.status(400).json({ success: false, message: "property_id, guard_name, and checkpoint_name are required" });
    }

    const [resLog] = await pool.query(
      `INSERT INTO fm_security_patrol_logs 
       (company_id, property_id, guard_name, patrol_time, checkpoint_name, checkpoint_status, incident_description, action_taken, photo_url)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`,
      [companyId, property_id, guard_name, checkpoint_name, checkpoint_status, incident_description || null, action_taken || null, photo_url || null]
    );

    res.status(201).json({ success: true, message: "Security patrol log recorded", logId: resLog.insertId });
  } catch (err) {
    next(err);
  }
}

// Pest Control Logs
export async function listPestControlLogs(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId } = req.query;

    const conditions = ["pest.company_id = ?"];
    const params = [companyId];

    if (propertyId) {
      conditions.push("pest.property_id = ?");
      params.push(propertyId);
    }

    const logs = await query(
      `SELECT pest.*, p.property_name 
       FROM fm_pest_control_logs pest
       LEFT JOIN fm_properties p ON p.id = pest.property_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY pest.treatment_date DESC`,
      params
    );
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function createPestControlLog(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, treatment_date, technician_name, target_pest = 'RODENTS', chemicals_applied, dosage_and_method, bait_stations_checked = 0, bait_stations_activity_detected = 0, risk_level = 'LOW', next_scheduled_date, notes } = req.body;

    if (!property_id || !treatment_date || !technician_name) {
      return res.status(400).json({ success: false, message: "property_id, treatment_date, and technician_name are required" });
    }

    const [resLog] = await pool.query(
      `INSERT INTO fm_pest_control_logs 
       (company_id, property_id, treatment_date, technician_name, target_pest, chemicals_applied, dosage_and_method, bait_stations_checked, bait_stations_activity_detected, risk_level, next_scheduled_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, property_id, treatment_date, technician_name, target_pest, chemicals_applied || null, dosage_and_method || null, toNum(bait_stations_checked, 0), toNum(bait_stations_activity_detected, 0), risk_level, next_scheduled_date || null, notes || null]
    );

    res.status(201).json({ success: true, message: "Pest control log recorded", logId: resLog.insertId });
  } catch (err) {
    next(err);
  }
}

// Waste Disposal Logs
export async function listWasteDisposalLogs(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId } = req.query;

    const conditions = ["w.company_id = ?"];
    const params = [companyId];

    if (propertyId) {
      conditions.push("w.property_id = ?");
      params.push(propertyId);
    }

    const logs = await query(
      `SELECT w.*, p.property_name 
       FROM fm_waste_disposal_logs w
       LEFT JOIN fm_properties p ON p.id = w.property_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY w.collection_date DESC`,
      params
    );
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function createWasteDisposalLog(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, collection_date, waste_type = 'GENERAL_REFUSE', quantity_kg_or_bins = 1, unit = 'BINS', contractor_carrier_name, manifest_reference_no, disposal_facility } = req.body;

    if (!property_id || !collection_date) {
      return res.status(400).json({ success: false, message: "property_id and collection_date are required" });
    }

    const [resLog] = await pool.query(
      `INSERT INTO fm_waste_disposal_logs 
       (company_id, property_id, collection_date, waste_type, quantity_kg_or_bins, unit, contractor_carrier_name, manifest_reference_no, disposal_facility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, property_id, collection_date, waste_type, toNum(quantity_kg_or_bins, 1), unit, contractor_carrier_name || null, manifest_reference_no || null, disposal_facility || null]
    );

    res.status(201).json({ success: true, message: "Waste disposal log recorded", logId: resLog.insertId });
  } catch (err) {
    next(err);
  }
}

/* =========================================================================
   7. FACILITIES OPERATIONS DASHBOARD & LIVE KPI ENGINE
   ========================================================================= */

/**
 * Returns comprehensive Facilities Operations KPIs
 */
export async function getFacilitiesDashboardKPIs(req, res, next) {
  try {
    const { companyId } = req.scope || {};

    // 1. Property and Building counts
    const [propStats] = await pool.query(
      `SELECT 
        COUNT(DISTINCT p.id) AS total_properties,
        COUNT(DISTINCT b.id) AS total_buildings,
        COUNT(DISTINCT s.id) AS total_spaces
       FROM fm_properties p
       LEFT JOIN fm_buildings b ON b.property_id = p.id
       LEFT JOIN fm_spaces s ON s.property_id = p.id
       WHERE p.company_id = ? AND p.status = 'ACTIVE'`,
      [companyId]
    );

    // 2. Contracts and recurring ACV
    const [contractStats] = await pool.query(
      `SELECT 
        COUNT(*) AS active_contracts,
        COALESCE(SUM(contract_value), 0) AS total_acv,
        COALESCE(SUM(billing_amount), 0) AS monthly_recurring_billing
       FROM fm_service_contracts
       WHERE company_id = ? AND contract_status = 'ACTIVE'`,
      [companyId]
    );

    // 3. Ticket and SLA metrics
    const [ticketStats] = await pool.query(
      `SELECT 
        COUNT(*) AS total_tickets,
        SUM(CASE WHEN status IN ('NEW', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS') THEN 1 ELSE 0 END) AS open_tickets,
        SUM(CASE WHEN priority IN ('EMERGENCY', 'CRITICAL') AND status NOT IN ('COMPLETED', 'CLOSED') THEN 1 ELSE 0 END) AS critical_open,
        SUM(CASE WHEN sla_resolution_breached = 1 THEN 1 ELSE 0 END) AS breached_slas,
        SUM(CASE WHEN status IN ('COMPLETED', 'CLOSED') AND sla_resolution_breached = 0 THEN 1 ELSE 0 END) AS met_slas
       FROM maint_requests
       WHERE company_id = ?`,
      [companyId]
    );

    const closedCount = (ticketStats[0]?.breached_slas || 0) + (ticketStats[0]?.met_slas || 0);
    const slaComplianceRate = closedCount > 0 
      ? Math.round(((ticketStats[0]?.met_slas || 0) / closedCount) * 100)
      : 100;

    // 4. Work Orders in Progress
    const [woStats] = await pool.query(
      `SELECT 
        COUNT(*) AS total_work_orders,
        SUM(CASE WHEN status IN ('IN_PROGRESS', 'TRAVELING', 'ON_SITE') THEN 1 ELSE 0 END) AS active_in_field,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_work_orders
       FROM maint_job_orders
       WHERE company_id = ?`,
      [companyId]
    );

    // 5. Critical Assets Down
    const [assetStats] = await pool.query(
      `SELECT 
        COUNT(*) AS total_assets,
        SUM(CASE WHEN status = 'DOWN' OR status = 'NEEDS_REPAIR' THEN 1 ELSE 0 END) AS assets_down,
        SUM(CASE WHEN criticality = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_assets
       FROM maint_assets
       WHERE company_id = ?`,
      [companyId]
    );

    // 6. Overdue PM tasks
    const [pmStats] = await pool.query(
      `SELECT COUNT(*) AS overdue_pms FROM maint_schedules WHERE company_id = ? AND status = 'OVERDUE'`,
      [companyId]
    ).catch(() => [[{ overdue_pms: 0 }]]);

    // 7. Recent Soft Services Activity Today
    const today = new Date().toISOString().slice(0, 10);
    const [softStats] = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM fm_janitorial_logs WHERE company_id = ? AND log_date = ?) AS janitorial_logs_today,
        (SELECT COUNT(*) FROM fm_security_patrol_logs WHERE company_id = ? AND DATE(patrol_time) = ?) AS patrols_today,
        (SELECT COUNT(*) FROM fm_pest_control_logs WHERE company_id = ? AND treatment_date = ?) AS pest_checks_today`,
      [companyId, today, companyId, today, companyId, today]
    );

    res.json({
      success: true,
      data: {
        portfolio: {
          properties: propStats[0]?.total_properties || 0,
          buildings: propStats[0]?.total_buildings || 0,
          spaces: propStats[0]?.total_spaces || 0
        },
        contracts: {
          active: contractStats[0]?.active_contracts || 0,
          total_acv: Number(contractStats[0]?.total_acv || 0),
          monthly_billing: Number(contractStats[0]?.monthly_recurring_billing || 0)
        },
        helpdesk_tickets: {
          total: ticketStats[0]?.total_tickets || 0,
          open: ticketStats[0]?.open_tickets || 0,
          critical_open: ticketStats[0]?.critical_open || 0,
          breached_count: ticketStats[0]?.breached_slas || 0,
          sla_compliance_rate: slaComplianceRate
        },
        work_orders: {
          total: woStats[0]?.total_work_orders || 0,
          active_in_field: woStats[0]?.active_in_field || 0,
          completed: woStats[0]?.completed_work_orders || 0
        },
        assets: {
          total: assetStats[0]?.total_assets || 0,
          assets_down: assetStats[0]?.assets_down || 0,
          critical_assets: assetStats[0]?.critical_assets || 0
        },
        ppm: {
          overdue: pmStats[0]?.overdue_pms || 0
        },
        soft_services_today: {
          cleaning: softStats[0]?.janitorial_logs_today || 0,
          security_patrols: softStats[0]?.patrols_today || 0,
          pest_treatments: softStats[0]?.pest_checks_today || 0
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================================
   10. INDUSTRY RELEVANT FACILITIES MANAGEMENT REPORT CONTROLLERS
   ========================================================================= */

/**
 * 1. FM SLA Compliance & Performance Report
 */
export async function getFMSLAComplianceReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { startDate, endDate, propertyId, clientId, serviceLine, priority } = req.query;

    const conditions = ["r.company_id = ?"];
    const params = [companyId];

    if (startDate) {
      conditions.push("DATE(r.created_at) >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("DATE(r.created_at) <= ?");
      params.push(endDate);
    }
    if (propertyId) {
      conditions.push("r.property_id = ?");
      params.push(propertyId);
    }
    if (clientId) {
      conditions.push("r.client_id = ?");
      params.push(clientId);
    }
    if (serviceLine) {
      conditions.push("r.service_line = ?");
      params.push(serviceLine);
    }
    if (priority) {
      conditions.push("(r.sla_priority = ? OR r.priority = ?)");
      params.push(priority, priority);
    }

    const whereClause = conditions.join(" AND ");

    const [summaryRows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_requests,
        SUM(CASE WHEN r.status IN ('COMPLETED', 'CLOSED', 'RESOLVED') THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN r.status NOT IN ('COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED') THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN r.responded_at IS NOT NULL OR r.status NOT IN ('NEW', 'PENDING') THEN 1 ELSE 0 END) AS responded_count,
        SUM(CASE WHEN r.sla_response_breached = 1 THEN 1 ELSE 0 END) AS response_breached_count,
        SUM(CASE WHEN r.sla_resolution_breached = 1 OR (r.sla_resolution_due IS NOT NULL AND r.sla_resolution_due < NOW() AND r.status NOT IN ('COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED')) THEN 1 ELSE 0 END) AS resolution_breached_count,
        AVG(CASE WHEN r.responded_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, r.created_at, r.responded_at) / 60 ELSE NULL END) AS avg_response_hours,
        AVG(CASE WHEN r.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, r.created_at, r.resolved_at) / 60 ELSE NULL END) AS avg_resolution_hours
      FROM maint_requests r
      WHERE ${whereClause}
    `, params);

    const summary = summaryRows[0] || {};
    const totalRequests = Number(summary.total_requests || 0);
    const resolvedCount = Number(summary.resolved_count || 0);
    const resolutionBreaches = Number(summary.resolution_breached_count || 0);
    const responseBreaches = Number(summary.response_breached_count || 0);
    const respondedCount = Number(summary.responded_count || 0);

    const slaCompliancePct = totalRequests > 0 
      ? Math.max(0, Math.min(100, Math.round(((totalRequests - resolutionBreaches) / totalRequests) * 100 * 10) / 10))
      : 100;
    const responseCompliancePct = respondedCount > 0
      ? Math.max(0, Math.min(100, Math.round(((respondedCount - responseBreaches) / respondedCount) * 100 * 10) / 10))
      : 100;

    const priorityBreakdown = await query(`
      SELECT 
        COALESCE(r.sla_priority, r.priority, 'MEDIUM') AS priority_level,
        COUNT(*) AS total_count,
        SUM(CASE WHEN r.status IN ('COMPLETED', 'CLOSED', 'RESOLVED') THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN r.sla_resolution_breached = 1 OR (r.sla_resolution_due IS NOT NULL AND r.sla_resolution_due < NOW() AND r.status NOT IN ('COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED')) THEN 1 ELSE 0 END) AS breached_count,
        AVG(CASE WHEN r.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, r.created_at, r.resolved_at) / 60 ELSE NULL END) AS avg_resolution_hours
      FROM maint_requests r
      WHERE ${whereClause}
      GROUP BY priority_level
      ORDER BY 
        CASE priority_level
          WHEN 'EMERGENCY' THEN 1
          WHEN 'CRITICAL' THEN 2
          WHEN 'HIGH' THEN 3
          WHEN 'MEDIUM' THEN 4
          WHEN 'LOW' THEN 5
          ELSE 6
        END ASC
    `, params);

    const propertyBreakdown = await query(`
      SELECT 
        p.id AS property_id,
        COALESCE(p.property_name, 'Unassigned Property') AS property_name,
        p.property_code,
        COUNT(r.id) AS total_requests,
        SUM(CASE WHEN r.status NOT IN ('COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED') THEN 1 ELSE 0 END) AS open_requests,
        SUM(CASE WHEN r.sla_resolution_breached = 1 OR (r.sla_resolution_due IS NOT NULL AND r.sla_resolution_due < NOW() AND r.status NOT IN ('COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED')) THEN 1 ELSE 0 END) AS breached_requests
      FROM maint_requests r
      LEFT JOIN fm_properties p ON p.id = r.property_id
      WHERE ${whereClause}
      GROUP BY p.id, p.property_name, p.property_code
      ORDER BY total_requests DESC
      LIMIT 15
    `, params);

    const detailedTickets = await query(`
      SELECT 
        r.id,
        r.request_no,
        r.subject,
        COALESCE(r.sla_priority, r.priority, 'MEDIUM') AS priority,
        r.status,
        r.service_line,
        r.billable_type,
        r.created_at,
        r.responded_at,
        r.resolved_at,
        r.sla_response_due,
        r.sla_resolution_due,
        r.sla_response_breached,
        r.sla_resolution_breached,
        p.property_name,
        c.customer_name AS client_name,
        CASE 
          WHEN r.status IN ('COMPLETED', 'CLOSED', 'RESOLVED') THEN 
            CASE WHEN r.sla_resolution_breached = 1 THEN 'BREACHED' ELSE 'MET' END
          WHEN r.sla_resolution_due IS NOT NULL AND r.sla_resolution_due < NOW() THEN 'BREACHED'
          WHEN r.sla_resolution_due IS NOT NULL AND TIMESTAMPDIFF(MINUTE, NOW(), r.sla_resolution_due) <= 120 THEN 'AT_RISK'
          ELSE 'ON_TRACK'
        END AS computed_sla_status
      FROM maint_requests r
      LEFT JOIN fm_properties p ON p.id = r.property_id
      LEFT JOIN sal_customers c ON c.id = r.client_id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT 100
    `, params);

    res.json({
      success: true,
      data: {
        summary: {
          total_requests: totalRequests,
          resolved_count: resolvedCount,
          open_count: Number(summary.open_count || 0),
          sla_compliance_pct: slaCompliancePct,
          response_compliance_pct: responseCompliancePct,
          resolution_breached_count: resolutionBreaches,
          response_breached_count: responseBreaches,
          avg_response_hours: Math.round(Number(summary.avg_response_hours || 0) * 10) / 10,
          avg_resolution_hours: Math.round(Number(summary.avg_resolution_hours || 0) * 10) / 10
        },
        priority_breakdown: priorityBreakdown.map(p => ({
          ...p,
          compliance_pct: Number(p.total_count) > 0 
            ? Math.round(((Number(p.total_count) - Number(p.breached_count)) / Number(p.total_count)) * 100 * 10) / 10
            : 100,
          avg_resolution_hours: Math.round(Number(p.avg_resolution_hours || 0) * 10) / 10
        })),
        property_breakdown: propertyBreakdown.map(p => ({
          ...p,
          compliance_pct: Number(p.total_requests) > 0
            ? Math.round(((Number(p.total_requests) - Number(p.breached_requests)) / Number(p.total_requests)) * 100 * 10) / 10
            : 100
        })),
        detailed_tickets: detailedTickets
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Property Maintenance Cost & Expense Allocation Report
 */
export async function getFMPropertyCostReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { startDate, endDate, propertyId, clientId, serviceLine } = req.query;

    const conditions = ["j.company_id = ?"];
    const params = [companyId];

    if (startDate) {
      conditions.push("DATE(j.created_at) >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("DATE(j.created_at) <= ?");
      params.push(endDate);
    }
    if (propertyId) {
      conditions.push("j.property_id = ?");
      params.push(propertyId);
    }
    if (clientId) {
      conditions.push("j.client_id = ?");
      params.push(clientId);
    }
    if (serviceLine) {
      conditions.push("j.service_line = ?");
      params.push(serviceLine);
    }

    const whereClause = conditions.join(" AND ");

    const [summaryRows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_work_orders,
        SUM(CASE WHEN j.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_orders,
        COALESCE(SUM(j.actual_hours), 0) AS total_labor_hours,
        COALESCE(SUM(sr.total_material_cost), 0) AS total_material_cost,
        COALESCE(SUM(sr.total_labor_hours * 25.00), SUM(j.actual_hours * 25.00), 0) AS total_labor_cost,
        COALESCE(SUM(sr.total_material_cost + (sr.total_labor_hours * 25.00)), SUM(j.actual_hours * 25.00), 0) AS total_cost
      FROM maint_job_orders j
      LEFT JOIN fm_service_reports sr ON sr.work_order_id = j.id
      WHERE ${whereClause}
    `, params);

    const summary = summaryRows[0] || {};
    const totalCost = Number(summary.total_cost || 0);

    const [areaRows] = await pool.query(
      `SELECT COALESCE(SUM(total_area_sqm), 0) AS total_area FROM fm_properties WHERE company_id = ? AND status = 'ACTIVE'`,
      [companyId]
    );
    const totalArea = Number(areaRows[0]?.total_area || 0);
    const costPerSqm = totalArea > 0 ? Math.round((totalCost / totalArea) * 100) / 100 : 0;

    const serviceLineCosts = await query(`
      SELECT 
        COALESCE(j.service_line, 'GENERAL_MAINTENANCE') AS service_line,
        COUNT(j.id) AS job_count,
        COALESCE(SUM(j.actual_hours), 0) AS labor_hours,
        COALESCE(SUM(sr.total_material_cost), 0) AS material_cost,
        COALESCE(SUM(sr.total_material_cost + (COALESCE(j.actual_hours, 1) * 25.00)), SUM(COALESCE(j.actual_hours, 1) * 25.00), 0) AS line_total_cost
      FROM maint_job_orders j
      LEFT JOIN fm_service_reports sr ON sr.work_order_id = j.id
      WHERE ${whereClause}
      GROUP BY service_line
      ORDER BY line_total_cost DESC
    `, params);

    const propertyCosts = await query(`
      SELECT 
        p.id AS property_id,
        COALESCE(p.property_name, 'Unassigned Property') AS property_name,
        p.property_type,
        p.city,
        p.total_area_sqm,
        COUNT(j.id) AS job_count,
        COALESCE(SUM(j.actual_hours), 0) AS labor_hours,
        COALESCE(SUM(sr.total_material_cost), 0) AS material_cost,
        COALESCE(SUM(sr.total_material_cost + (COALESCE(j.actual_hours, 1) * 25.00)), SUM(COALESCE(j.actual_hours, 1) * 25.00), 0) AS property_total_cost
      FROM maint_job_orders j
      LEFT JOIN fm_properties p ON p.id = j.property_id
      LEFT JOIN fm_service_reports sr ON sr.work_order_id = j.id
      WHERE ${whereClause}
      GROUP BY p.id, p.property_name, p.property_type, p.city, p.total_area_sqm
      ORDER BY property_total_cost DESC
    `, params);

    const costRecords = await query(`
      SELECT 
        j.id,
        j.job_order_no,
        j.subject,
        j.service_line,
        j.status,
        j.actual_hours,
        COALESCE(sr.total_material_cost, 0) AS material_cost,
        COALESCE(sr.total_material_cost + (COALESCE(j.actual_hours, 1) * 25.00), COALESCE(j.actual_hours, 1) * 25.00) AS total_cost,
        p.property_name,
        c.customer_name AS client_name,
        j.created_at
      FROM maint_job_orders j
      LEFT JOIN fm_properties p ON p.id = j.property_id
      LEFT JOIN sal_customers c ON c.id = j.client_id
      LEFT JOIN fm_service_reports sr ON sr.work_order_id = j.id
      WHERE ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT 100
    `, params);

    res.json({
      success: true,
      data: {
        summary: {
          total_work_orders: Number(summary.total_work_orders || 0),
          completed_orders: Number(summary.completed_orders || 0),
          total_labor_hours: Math.round(Number(summary.total_labor_hours || 0) * 10) / 10,
          total_labor_cost: Math.round(Number(summary.total_labor_cost || 0) * 100) / 100,
          total_material_cost: Math.round(Number(summary.total_material_cost || 0) * 100) / 100,
          total_cost: Math.round(totalCost * 100) / 100,
          total_managed_sqm: totalArea,
          cost_per_sqm: costPerSqm
        },
        service_lines: serviceLineCosts.map(s => ({
          ...s,
          labor_hours: Math.round(Number(s.labor_hours) * 10) / 10,
          material_cost: Math.round(Number(s.material_cost) * 100) / 100,
          line_total_cost: Math.round(Number(s.line_total_cost) * 100) / 100,
          cost_share_pct: totalCost > 0 ? Math.round((Number(s.line_total_cost) / totalCost) * 100 * 10) / 10 : 0
        })),
        property_costs: propertyCosts.map(p => {
          const pCost = Number(p.property_total_cost || 0);
          const pArea = Number(p.total_area_sqm || 0);
          return {
            ...p,
            labor_hours: Math.round(Number(p.labor_hours) * 10) / 10,
            material_cost: Math.round(Number(p.material_cost) * 100) / 100,
            property_total_cost: Math.round(pCost * 100) / 100,
            cost_per_sqm: pArea > 0 ? Math.round((pCost / pArea) * 100) / 100 : 0
          };
        }),
        cost_records: costRecords
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. FM Service Contracts & Recurring Revenue Report
 */
export async function getFMContractProfitabilityReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { clientId, propertyId, status } = req.query;

    const conditions = ["c.company_id = ?"];
    const params = [companyId];

    if (clientId) {
      conditions.push("c.client_id = ?");
      params.push(clientId);
    }
    if (status) {
      conditions.push("c.contract_status = ?");
      params.push(status);
    }

    const whereClause = conditions.join(" AND ");

    const contracts = await query(`
      SELECT 
        c.*,
        cust.customer_name AS client_name,
        cust.customer_code AS client_code,
        DATEDIFF(c.end_date, CURDATE()) AS days_to_expiry,
        (
          SELECT COUNT(DISTINCT cp.property_id) 
          FROM fm_contract_properties cp 
          WHERE cp.contract_id = c.id
        ) AS properties_covered_count,
        (
          SELECT COUNT(*) 
          FROM maint_job_orders j 
          WHERE j.contract_id = c.id
        ) AS job_orders_count,
        (
          SELECT COALESCE(SUM(sr.total_material_cost + (COALESCE(j.actual_hours, 1) * 25.00)), SUM(COALESCE(j.actual_hours, 1) * 25.00), 0)
          FROM maint_job_orders j
          LEFT JOIN fm_service_reports sr ON sr.work_order_id = j.id
          WHERE j.contract_id = c.id
        ) AS total_operational_cost
      FROM fm_service_contracts c
      LEFT JOIN sal_customers cust ON cust.id = c.client_id
      WHERE ${whereClause}
      ORDER BY c.end_date ASC
    `, params);

    let totalContractValue = 0;
    let totalMonthlyRevenue = 0;
    let totalOperationalCost = 0;
    let expiringWithin30 = 0;
    let expiringWithin60 = 0;
    let expiringWithin90 = 0;

    const formattedContracts = contracts.map(c => {
      const val = Number(c.contract_value || 0);
      const billAmt = Number(c.billing_amount || 0);
      const opCost = Number(c.total_operational_cost || 0);
      const days = Number(c.days_to_expiry || 0);

      totalContractValue += val;
      if (c.billing_frequency === 'MONTHLY') totalMonthlyRevenue += billAmt;
      else if (c.billing_frequency === 'QUARTERLY') totalMonthlyRevenue += (billAmt / 3);
      else if (c.billing_frequency === 'ANNUALLY') totalMonthlyRevenue += (billAmt / 12);
      else totalMonthlyRevenue += billAmt;

      totalOperationalCost += opCost;

      if (days >= 0 && days <= 30) expiringWithin30++;
      if (days >= 0 && days <= 60) expiringWithin60++;
      if (days >= 0 && days <= 90) expiringWithin90++;

      const grossProfit = val > 0 ? (val - opCost) : (billAmt - opCost);
      const grossMarginPct = val > 0 ? Math.round((grossProfit / val) * 100 * 10) / 10 : 0;

      let renewalStatus = "ACTIVE";
      if (days < 0) renewalStatus = "EXPIRED";
      else if (days <= 30) renewalStatus = "EXPIRING_30_DAYS";
      else if (days <= 60) renewalStatus = "EXPIRING_60_DAYS";
      else if (days <= 90) renewalStatus = "EXPIRING_90_DAYS";

      return {
        ...c,
        contract_value: val,
        billing_amount: billAmt,
        total_operational_cost: Math.round(opCost * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        gross_margin_pct: grossMarginPct,
        renewal_status: renewalStatus
      };
    });

    const totalGrossProfit = totalContractValue - totalOperationalCost;
    const overallGrossMarginPct = totalContractValue > 0
      ? Math.round((totalGrossProfit / totalContractValue) * 100 * 10) / 10
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          total_contracts: contracts.length,
          total_contract_value: Math.round(totalContractValue * 100) / 100,
          monthly_recurring_revenue: Math.round(totalMonthlyRevenue * 100) / 100,
          annualized_run_rate: Math.round(totalMonthlyRevenue * 12 * 100) / 100,
          total_operational_cost: Math.round(totalOperationalCost * 100) / 100,
          total_gross_profit: Math.round(totalGrossProfit * 100) / 100,
          overall_gross_margin_pct: overallGrossMarginPct,
          expiring_30_days: expiringWithin30,
          expiring_60_days: expiringWithin60,
          expiring_90_days: expiringWithin90
        },
        contracts: formattedContracts
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Soft Facilities Services & Audit Compliance Report
 */
export async function getFMSoftServicesComplianceReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { startDate, endDate, propertyId } = req.query;

    const baseParams = [companyId];
    let propFilter = "";

    if (propertyId) {
      propFilter = " AND property_id = ?";
      baseParams.push(propertyId);
    }

    const [janSummary] = await pool.query(`
      SELECT 
        COUNT(*) AS total_audits,
        AVG(supervisor_rating) AS avg_rating,
        SUM(CASE WHEN restrooms_sanitized = 1 THEN 1 ELSE 0 END) AS restrooms_sanitized_count,
        SUM(CASE WHEN floors_mopped = 1 THEN 1 ELSE 0 END) AS floors_mopped_count,
        SUM(CASE WHEN trash_emptied = 1 THEN 1 ELSE 0 END) AS trash_emptied_count,
        SUM(CASE WHEN soap_paper_restocked = 1 THEN 1 ELSE 0 END) AS supplies_restocked_count
      FROM fm_janitorial_logs
      WHERE company_id = ? ${propFilter}
    `, baseParams);

    const janAudits = Number(janSummary[0]?.total_audits || 0);

    const [secSummary] = await pool.query(`
      SELECT 
        COUNT(*) AS total_checkpoints,
        SUM(CASE WHEN checkpoint_status = 'SECURE' THEN 1 ELSE 0 END) AS secure_count,
        SUM(CASE WHEN checkpoint_status != 'SECURE' THEN 1 ELSE 0 END) AS anomaly_count,
        SUM(CASE WHEN checkpoint_status = 'DOOR_UNLOCKED' THEN 1 ELSE 0 END) AS doors_unlocked,
        SUM(CASE WHEN checkpoint_status = 'BREACH_ATTEMPT' THEN 1 ELSE 0 END) AS breach_attempts,
        SUM(CASE WHEN checkpoint_status = 'LIGHT_DEFECTIVE' THEN 1 ELSE 0 END) AS lights_defective
      FROM fm_security_patrol_logs
      WHERE company_id = ? ${propFilter}
    `, baseParams);

    const [pestSummary] = await pool.query(`
      SELECT 
        COUNT(*) AS total_treatments,
        COALESCE(SUM(bait_stations_checked), 0) AS total_bait_stations,
        COALESCE(SUM(bait_stations_activity_detected), 0) AS bait_stations_with_activity,
        SUM(CASE WHEN risk_level IN ('HIGH', 'INFESTATION') THEN 1 ELSE 0 END) AS high_risk_incidents
      FROM fm_pest_control_logs
      WHERE company_id = ? ${propFilter}
    `, baseParams);

    const [wasteSummary] = await pool.query(`
      SELECT 
        COUNT(*) AS total_manifests,
        COALESCE(SUM(CASE WHEN waste_type = 'GENERAL_REFUSE' THEN quantity_kg_or_bins ELSE 0 END), 0) AS general_waste_bins,
        COALESCE(SUM(CASE WHEN waste_type = 'RECYCLABLE_PAPER_PLASTIC' THEN quantity_kg_or_bins ELSE 0 END), 0) AS recyclable_bins,
        COALESCE(SUM(CASE WHEN waste_type = 'HAZARDOUS_CHEMICAL' THEN quantity_kg_or_bins ELSE 0 END), 0) AS hazardous_bins,
        COALESCE(SUM(CASE WHEN waste_type = 'ELECTRONIC_EWASTE' THEN quantity_kg_or_bins ELSE 0 END), 0) AS ewaste_bins
      FROM fm_waste_disposal_logs
      WHERE company_id = ? ${propFilter}
    `, baseParams);

    const propertySummary = await query(`
      SELECT 
        p.id AS property_id,
        p.property_name,
        p.property_code,
        (SELECT COUNT(*) FROM fm_janitorial_logs WHERE property_id = p.id) AS janitorial_count,
        (SELECT AVG(supervisor_rating) FROM fm_janitorial_logs WHERE property_id = p.id) AS avg_janitorial_rating,
        (SELECT COUNT(*) FROM fm_security_patrol_logs WHERE property_id = p.id) AS patrol_count,
        (SELECT SUM(CASE WHEN checkpoint_status != 'SECURE' THEN 1 ELSE 0 END) FROM fm_security_patrol_logs WHERE property_id = p.id) AS security_anomalies,
        (SELECT COUNT(*) FROM fm_pest_control_logs WHERE property_id = p.id) AS pest_treatments,
        (SELECT COUNT(*) FROM fm_waste_disposal_logs WHERE property_id = p.id) AS waste_manifests
      FROM fm_properties p
      WHERE p.company_id = ?
      ORDER BY p.property_name ASC
    `, [companyId]);

    res.json({
      success: true,
      data: {
        janitorial: {
          total_audits: janAudits,
          avg_rating: Math.round(Number(janSummary[0]?.avg_rating || 5) * 10) / 10,
          restroom_sanitization_rate: janAudits > 0 ? Math.round((Number(janSummary[0]?.restrooms_sanitized_count || 0) / janAudits) * 100) : 100,
          floor_mopping_rate: janAudits > 0 ? Math.round((Number(janSummary[0]?.floors_mopped_count || 0) / janAudits) * 100) : 100,
          trash_emptied_rate: janAudits > 0 ? Math.round((Number(janSummary[0]?.trash_emptied_count || 0) / janAudits) * 100) : 100,
          supplies_restocked_rate: janAudits > 0 ? Math.round((Number(janSummary[0]?.supplies_restocked_count || 0) / janAudits) * 100) : 100
        },
        security: {
          total_checkpoints: Number(secSummary[0]?.total_checkpoints || 0),
          secure_count: Number(secSummary[0]?.secure_count || 0),
          anomaly_count: Number(secSummary[0]?.anomaly_count || 0),
          anomaly_rate_pct: Number(secSummary[0]?.total_checkpoints) > 0 
            ? Math.round((Number(secSummary[0]?.anomaly_count) / Number(secSummary[0]?.total_checkpoints)) * 100 * 10) / 10
            : 0,
          doors_unlocked: Number(secSummary[0]?.doors_unlocked || 0),
          breach_attempts: Number(secSummary[0]?.breach_attempts || 0),
          lights_defective: Number(secSummary[0]?.lights_defective || 0)
        },
        pest_control: {
          total_treatments: Number(pestSummary[0]?.total_treatments || 0),
          total_bait_stations: Number(pestSummary[0]?.total_bait_stations || 0),
          activity_detected_count: Number(pestSummary[0]?.bait_stations_with_activity || 0),
          activity_rate_pct: Number(pestSummary[0]?.total_bait_stations) > 0
            ? Math.round((Number(pestSummary[0]?.bait_stations_with_activity) / Number(pestSummary[0]?.total_bait_stations)) * 100 * 10) / 10
            : 0,
          high_risk_incidents: Number(pestSummary[0]?.high_risk_incidents || 0)
        },
        waste: {
          total_manifests: Number(wasteSummary[0]?.total_manifests || 0),
          general_waste_bins: Number(wasteSummary[0]?.general_waste_bins || 0),
          recyclable_bins: Number(wasteSummary[0]?.recyclable_bins || 0),
          hazardous_bins: Number(wasteSummary[0]?.hazardous_bins || 0),
          ewaste_bins: Number(wasteSummary[0]?.ewaste_bins || 0)
        },
        properties: propertySummary
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Asset PPM Adherence & Inspection Checklists Report
 */
export async function getFMChecklistInspectionsReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { templateId, propertyId } = req.query;

    const conditions = ["1=1"];
    const params = [];

    if (templateId) {
      conditions.push("woc.template_id = ?");
      params.push(templateId);
    }
    if (propertyId) {
      conditions.push("j.property_id = ?");
      params.push(propertyId);
    }

    const whereClause = conditions.join(" AND ");

    const [summaryRows] = await pool.query(`
      SELECT 
        COUNT(woc.id) AS total_executions,
        SUM(CASE WHEN woc.overall_result = 'PASS' THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN woc.overall_result = 'FAIL' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN woc.overall_result = 'CONDITIONAL_PASS' THEN 1 ELSE 0 END) AS conditional_count,
        (
          SELECT COUNT(*) 
          FROM fm_work_order_checklist_values val 
          WHERE val.is_out_of_range = 1 OR val.status_result = 'FAIL'
        ) AS total_out_of_range_items
      FROM fm_work_order_checklists woc
      LEFT JOIN maint_job_orders j ON j.id = woc.work_order_id
      WHERE (j.company_id = ? OR j.company_id IS NULL) AND ${whereClause}
    `, [companyId, ...params]);

    const summary = summaryRows[0] || {};
    const totalExecs = Number(summary.total_executions || 0);
    const passedCount = Number(summary.passed_count || 0);
    const passRatePct = totalExecs > 0 ? Math.round((passedCount / totalExecs) * 100 * 10) / 10 : 100;

    const templateBreakdown = await query(`
      SELECT 
        t.id AS template_id,
        t.template_code,
        t.template_name,
        t.service_line,
        COUNT(woc.id) AS times_executed,
        SUM(CASE WHEN woc.overall_result = 'PASS' THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN woc.overall_result = 'FAIL' THEN 1 ELSE 0 END) AS failed_count
      FROM fm_checklist_templates t
      LEFT JOIN fm_work_order_checklists woc ON woc.template_id = t.id
      WHERE t.company_id = ?
      GROUP BY t.id, t.template_code, t.template_name, t.service_line
      ORDER BY times_executed DESC
    `, [companyId]);

    const executionLogs = await query(`
      SELECT 
        woc.id,
        woc.work_order_id,
        woc.template_name,
        woc.overall_result,
        woc.overall_notes,
        woc.completed_at,
        j.job_order_no,
        p.property_name,
        u.name AS completed_by_name
      FROM fm_work_order_checklists woc
      LEFT JOIN maint_job_orders j ON j.id = woc.work_order_id
      LEFT JOIN fm_properties p ON p.id = j.property_id
      LEFT JOIN adm_users u ON u.id = woc.completed_by
      WHERE (j.company_id = ? OR j.company_id IS NULL) AND ${whereClause}
      ORDER BY woc.completed_at DESC
      LIMIT 100
    `, [companyId, ...params]);

    res.json({
      success: true,
      data: {
        summary: {
          total_executions: totalExecs,
          passed_count: passedCount,
          failed_count: Number(summary.failed_count || 0),
          conditional_count: Number(summary.conditional_count || 0),
          pass_rate_pct: passRatePct,
          out_of_range_items: Number(summary.total_out_of_range_items || 0)
        },
        templates: templateBreakdown.map(t => ({
          ...t,
          pass_rate: Number(t.times_executed) > 0 
            ? Math.round((Number(t.passed_count) / Number(t.times_executed)) * 100 * 10) / 10 
            : 0
        })),
        execution_logs: executionLogs
      }
    });
  } catch (err) {
    next(err);
  }
}

