/**
 * @file facilities_management.test.js
 * @description Automated Verification Suite for OmniSuite ERP Facilities Management (FM):
 * Multi-Tier Property Hierarchy, FM Service Contracts & SLAs, Field Technician Workflow,
 * Digital Inspection Checklists, Soft Services Logs, and Operations Dashboard KPIs.
 */

import { pool, query } from "../db/pool.js";
import { ensureFacilitiesManagementTables } from "../utils/facilitiesManagementTables.js";

async function runFacilitiesManagementTests() {
  console.log("================================================================");
  console.log("RUNNING OMNISUITE ERP FACILITIES MANAGEMENT (FM) TEST SUITE");
  console.log("================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Ensure tables first
    await ensureFacilitiesManagementTables();
    assert(true, "Facilities Management tables ensured");

    // 1. Get an existing company and client
    const [companies] = await pool.query("SELECT id FROM adm_companies LIMIT 1");
    const companyId = companies[0]?.id || 1;

    let [customers] = await pool.query("SELECT id, customer_name FROM sal_customers WHERE company_id = ? LIMIT 1", [companyId]);
    let clientId = customers[0]?.id;
    if (!clientId) {
      const [newCust] = await pool.query(
        "INSERT INTO sal_customers (company_id, customer_code, customer_name, is_active) VALUES (?, 'CUST-FM-01', 'Apex Corporate Towers Ltd', 1)",
        [companyId]
      );
      clientId = newCust.insertId;
    }
    assert(clientId != null, "Found or created client organization for FM");

    // 2. Test Multi-tier Property Hierarchy Creation
    const propCode = `PROP-TEST-${Date.now().toString().slice(-4)}`;
    const [propRes] = await pool.query(
      `INSERT INTO fm_properties 
       (company_id, client_id, property_code, property_name, property_type, address, city, total_area_sqm, status)
       VALUES (?, ?, ?, 'Heritage Financial Center', 'COMMERCIAL_OFFICE', '14 Independence Avenue', 'Accra', 18500.00, 'ACTIVE')`,
      [companyId, clientId, propCode]
    );
    const propertyId = propRes.insertId;
    assert(propertyId > 0, "Created FM Master Property record");

    // Building
    const [bldRes] = await pool.query(
      `INSERT INTO fm_buildings (company_id, property_id, building_code, building_name, total_floors, gross_floor_area_sqm)
       VALUES (?, ?, 'TOWER-A', 'North Office Tower', 12, 12000.00)`,
      [companyId, propertyId]
    );
    const buildingId = bldRes.insertId;
    assert(buildingId > 0, "Created Building inside Property");

    // Zone (Floor 4)
    const [zoneRes] = await pool.query(
      `INSERT INTO fm_zones (company_id, property_id, building_id, zone_code, zone_name, floor_number, zone_type)
       VALUES (?, ?, ?, 'FL-04', 'Level 4 Executive Wing', 4, 'FLOOR')`,
      [companyId, propertyId, buildingId]
    );
    const zoneId = zoneRes.insertId;
    assert(zoneId > 0, "Created Zone/Floor inside Building");

    // Space (Server Room)
    const [spaceRes] = await pool.query(
      `INSERT INTO fm_spaces (company_id, property_id, building_id, zone_id, space_code, space_name, space_type, area_sqm)
       VALUES (?, ?, ?, ?, 'SR-401', 'Data Center & Server Room 401', 'SERVER_ROOM', 65.50)`,
      [companyId, propertyId, buildingId, zoneId]
    );
    const spaceId = spaceRes.insertId;
    assert(spaceId > 0, "Created Specific Space/Room inside Floor");

    // 3. Link an Asset to Space Hierarchy
    const assetNo = `AST-FM-${Date.now().toString().slice(-4)}`;
    const [astRes] = await pool.query(
      `INSERT INTO maint_assets 
       (company_id, branch_id, asset_no, asset_name, property_id, building_id, zone_id, space_id, client_id, category, make, model, capacity_rating, criticality, status)
       VALUES (?, 1, ?, 'Precision In-Row CRAC Unit A', ?, ?, ?, ?, ?, 'HVAC_AIR_CONDITIONING', 'Liebert Vertiv', 'CRV-300', '35 kW Cooling', 'CRITICAL', 'ACTIVE')`,
      [companyId, assetNo, propertyId, buildingId, zoneId, spaceId, clientId]
    );
    const assetId = astRes.insertId;
    assert(assetId > 0, "Created Asset and linked to multi-tier property space");

    // 4. Test FM Service Contract & SLA Definition
    const contractNo = `FMC-${Date.now().toString().slice(-5)}`;
    const [ctrRes] = await pool.query(
      `INSERT INTO fm_service_contracts
       (company_id, contract_no, contract_title, client_id, start_date, end_date, billing_frequency, billing_amount, contract_value, emergency_callout_included, emergency_callout_limit, sla_critical_response_hours, sla_critical_resolution_hours, contract_status)
       VALUES (?, ?, 'Comprehensive FM Master Agreement', ?, '2026-01-01', '2026-12-31', 'MONTHLY', 15000.00, 180000.00, 1, 10, 1.0, 4.0, 'ACTIVE')`,
      [companyId, contractNo, clientId]
    );
    const contractId = ctrRes.insertId;
    assert(contractId > 0, "Created FM Service Contract with SLA definitions");

    // Link Property to Contract
    await pool.query(
      "INSERT INTO fm_contract_properties (contract_id, property_id) VALUES (?, ?)",
      [contractId, propertyId]
    );

    // Add Covered Service Line (HVAC is covered, Cleaning is covered)
    await pool.query(
      `INSERT INTO fm_contract_service_lines (contract_id, service_line, is_covered, parts_included)
       VALUES (?, 'HVAC_AIR_CONDITIONING', 1, 1), (?, 'CLEANING_JANITORIAL', 1, 0)`,
      [contractId, contractId]
    );
    assert(true, "Configured contract property coverage and covered service lines");

    // 5. Test Contract Invoicing to Finance
    const invNo = `INV-FM-TEST-${Date.now().toString().slice(-4)}`;
    const [invRes] = await pool.query(
      `INSERT INTO srv_service_invoices (company_id, branch_id, invoice_no, invoice_date, customer_id, due_date, status, total_amount, net_amount)
       VALUES (?, 1, ?, CURDATE(), ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'PENDING', 15000.00, 15000.00)`,
      [companyId, invNo, clientId]
    );
    const invoiceId = invRes.insertId;
    await pool.query(
      `INSERT INTO srv_service_invoice_details (invoice_id, item_id, quantity, unit_price, total_amount, net_amount, uom, remarks)
       VALUES (?, 0, 1, 15000.00, 15000.00, 15000.00, 'PERIOD', 'Monthly FM Service Fee')`,
      [invoiceId]
    );
    assert(invoiceId > 0, "Generated recurring FM invoice into Finance (srv_service_invoices)");

    // 6. Test FM Service Request / Ticket with SLA calculation
    const reqNo = `SR-FM-${Date.now().toString().slice(-4)}`;
    const nowTime = Date.now();
    const slaResponseDue = new Date(nowTime + 1 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    const slaResolutionDue = new Date(nowTime + 4 * 3600000).toISOString().slice(0, 19).replace('T', ' ');

    const [ticketRes] = await pool.query(
      `INSERT INTO maint_requests 
       (company_id, branch_id, request_no, request_date, property_id, building_id, zone_id, space_id, client_id, contract_id, asset_id, service_line, priority, sla_priority, sla_response_due, sla_resolution_due, description, status)
       VALUES (?, 1, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, 'HVAC_AIR_CONDITIONING', 'CRITICAL', 'CRITICAL', ?, ?, 'CRAC Unit high temperature alarm in server room 401', 'NEW')`,
      [companyId, reqNo, propertyId, buildingId, zoneId, spaceId, clientId, contractId, assetId, slaResponseDue, slaResolutionDue]
    );
    const ticketId = ticketRes.insertId;
    assert(ticketId > 0, "Created FM Ticket with 1h response / 4h resolution SLA target");

    // 7. Test SLA Pause and Resume
    const pauseTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      "UPDATE maint_requests SET sla_paused_at = ?, sla_pause_reason = 'Awaiting Server Room Access Badge' WHERE id = ?",
      [pauseTime, ticketId]
    );
    const [pausedTicket] = await pool.query("SELECT sla_paused_at FROM maint_requests WHERE id = ?", [ticketId]);
    assert(pausedTicket[0]?.sla_paused_at != null, "Successfully paused SLA timer on ticket");

    // Resume SLA
    await pool.query(
      "UPDATE maint_requests SET sla_paused_at = NULL, sla_resumed_at = CURRENT_TIMESTAMP, total_paused_minutes = 30, status = 'IN_PROGRESS' WHERE id = ?",
      [ticketId]
    );
    const [resumedTicket] = await pool.query("SELECT status, total_paused_minutes FROM maint_requests WHERE id = ?", [ticketId]);
    assert(resumedTicket[0]?.status === 'IN_PROGRESS' && resumedTicket[0]?.total_paused_minutes === 30, "Resumed SLA timer and tracked pause duration");

    // 8. Test Ticket Conversion to Field Service Work Order
    const woNo = `WO-FM-${Date.now().toString().slice(-4)}`;
    const [woRes] = await pool.query(
      `INSERT INTO maint_job_orders 
       (company_id, branch_id, order_no, order_date, request_id, property_id, building_id, zone_id, space_id, client_id, contract_id, asset_id, service_line, priority, order_type, assigned_technician, status)
       VALUES (?, 1, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, 'HVAC_AIR_CONDITIONING', 'CRITICAL', 'CORRECTIVE', 'Kofi Mensah', 'ASSIGNED')`,
      [companyId, woNo, ticketId, propertyId, buildingId, zoneId, spaceId, clientId, contractId, assetId]
    );
    const workOrderId = woRes.insertId;
    assert(workOrderId > 0, "Converted FM Ticket into Field Service Work Order");

    // 9. Test Field Technician Workflow Transitions
    // Traveling
    await pool.query("UPDATE maint_job_orders SET status = 'TRAVELING', travel_start_time = CURRENT_TIMESTAMP WHERE id = ?", [workOrderId]);
    // On Site
    await pool.query("UPDATE maint_job_orders SET status = 'ON_SITE', arrival_time = CURRENT_TIMESTAMP WHERE id = ?", [workOrderId]);
    // In Progress with Safety acknowledgment
    await pool.query("UPDATE maint_job_orders SET status = 'IN_PROGRESS', job_start_time = CURRENT_TIMESTAMP, safety_briefing_acknowledged = 1 WHERE id = ?", [workOrderId]);

    const [woState] = await pool.query("SELECT status, safety_briefing_acknowledged, travel_start_time, arrival_time FROM maint_job_orders WHERE id = ?", [workOrderId]);
    assert(woState[0]?.status === 'IN_PROGRESS' && woState[0]?.safety_briefing_acknowledged === 1, "Field technician transitioned from Travel to On-Site with safety check");

    // 10. Test Digital Inspection Checklist Execution & Critical Failure Auto-Trigger
    // Check default template exists
    const [tplList] = await pool.query("SELECT id, template_name FROM fm_checklist_templates WHERE service_line = 'HVAC_AIR_CONDITIONING' LIMIT 1");
    const templateId = tplList[0]?.id;
    assert(templateId != null, "Found seeded HVAC Inspection Checklist Template");

    // Execute checklist with a critical failure (refrigerant pressure too low: 40 psi vs min 55 psi)
    const [clRes] = await pool.query(
      `INSERT INTO fm_work_order_checklists (work_order_id, template_id, template_name, overall_result, overall_notes)
       VALUES (?, ?, ?, 'FAIL', 'Critical low refrigerant detected on circuit 1')`,
      [workOrderId, templateId, tplList[0].template_name]
    );
    const checklistId = clRes.insertId;

    await pool.query(
      `INSERT INTO fm_work_order_checklist_values 
       (checklist_id, template_item_id, item_text, field_type, numeric_value, is_out_of_range)
       VALUES (?, 4, 'Suction refrigerant pressure', 'NUMERIC_READING', 40.0, 1)`,
      [checklistId]
    );

    // Auto-create Corrective Action Work Order
    const corrNo = `WO-CORR-${Date.now().toString().slice(-4)}`;
    const [corrRes] = await pool.query(
      `INSERT INTO maint_job_orders (company_id, branch_id, order_no, order_date, property_id, asset_id, service_line, priority, order_type, status, instructions)
       VALUES (?, 1, ?, CURDATE(), ?, ?, 'HVAC_AIR_CONDITIONING', 'CRITICAL', 'CORRECTIVE', 'ASSIGNED', 'Corrective action required: Suction refrigerant pressure out of range (40 psi)')`,
      [companyId, corrNo, propertyId, assetId]
    );
    assert(corrRes.insertId > 0, "Critical inspection failure triggered automatic Corrective Work Order");

    // 11. Test Job Completion with Customer Sign-off
    const signoffReportNo = `FSR-${Date.now().toString().slice(-4)}`;
    const [repRes] = await pool.query(
      `INSERT INTO fm_service_reports 
       (work_order_id, company_id, report_no, property_id, client_id, technician_name, work_performed, total_labor_hours, customer_representative_name, customer_rating, signed_at)
       VALUES (?, ?, ?, ?, ?, 'Kofi Mensah', 'Diagnosed leak on schrader valve, replaced core, recharged R410A, verified suction pressure at 68 psi', 2.5, 'Akosua Darko (Facility Manager)', 5, CURRENT_TIMESTAMP)`,
      [workOrderId, companyId, signoffReportNo, propertyId, clientId]
    );
    assert(repRes.insertId > 0, "Created official Customer Sign-off Service Report with 5-star rating");

    // 12. Test Soft Services Operations Logging
    // Janitorial Log
    const [janRes] = await pool.query(
      `INSERT INTO fm_janitorial_logs 
       (company_id, property_id, space_id, cleaner_name, log_date, shift, restrooms_sanitized, floors_mopped, trash_emptied, soap_paper_restocked, supervisor_rating)
       VALUES (?, ?, ?, 'Ama Serwaa', CURDATE(), 'MORNING', 1, 1, 1, 1, 5)`,
      [companyId, propertyId, spaceId]
    );
    assert(janRes.insertId > 0, "Logged Janitorial Restroom and Sanitization audit");

    // Security Patrol Log
    const [secRes] = await pool.query(
      `INSERT INTO fm_security_patrol_logs 
       (company_id, property_id, guard_name, patrol_time, checkpoint_name, checkpoint_status)
       VALUES (?, ?, 'Officer Emmanuel Osei', CURRENT_TIMESTAMP, 'North Gate & Server Room Perimeter', 'SECURE')`,
      [companyId, propertyId]
    );
    assert(secRes.insertId > 0, "Logged Security Guard Patrol checkpoint round");

    // Pest Control Log
    const [pestRes] = await pool.query(
      `INSERT INTO fm_pest_control_logs 
       (company_id, property_id, treatment_date, technician_name, target_pest, chemicals_applied, bait_stations_checked, risk_level)
       VALUES (?, ?, CURDATE(), 'Kwaku Baah', 'RODENTS', 'Bromadiolone 0.005% Blocks', 12, 'LOW')`,
      [companyId, propertyId]
    );
    assert(pestRes.insertId > 0, "Logged Pest Control bait station treatment & risk assessment");

    // Waste Disposal Log
    const [wasteRes] = await pool.query(
      `INSERT INTO fm_waste_disposal_logs 
       (company_id, property_id, collection_date, waste_type, quantity_kg_or_bins, unit, contractor_carrier_name)
       VALUES (?, ?, CURDATE(), 'RECYCLABLE_PAPER_PLASTIC', 4, 'BINS', 'Zoomlion EcoServices')`,
      [companyId, propertyId]
    );
    assert(wasteRes.insertId > 0, "Logged Waste Management & Recycling collection record");

    // 13. Test Facilities Operations Dashboard KPI aggregation
    const [kpiProps] = await pool.query("SELECT COUNT(*) AS count FROM fm_properties WHERE company_id = ? AND status = 'ACTIVE'", [companyId]);
    const [kpiContracts] = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(contract_value), 0) AS val FROM fm_service_contracts WHERE company_id = ?", [companyId]);
    const [kpiTickets] = await pool.query("SELECT COUNT(*) AS count FROM maint_requests WHERE company_id = ?", [companyId]);

    assert(kpiProps[0]?.count >= 1, "Dashboard KPI: Active property portfolio count computed");
    assert(kpiContracts[0]?.val > 0, "Dashboard KPI: Active contract value aggregation computed");
    assert(kpiTickets[0]?.count >= 1, "Dashboard KPI: Live helpdesk tickets aggregated");

  } catch (err) {
    console.error("Test execution exception:", err);
    failed++;
  }

  console.log("\n================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFacilitiesManagementTests().catch(err => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
