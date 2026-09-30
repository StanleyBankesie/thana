import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { consumeStockFIFOTx, recordMovementTx } from "../services/stock.service.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ===== BILL OF MATERIALS (BOM) =====

export const listBoms = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT b.*, i.item_name, i.item_code, u.username AS created_by_name
       FROM prod_boms b
       JOIN inv_items i ON i.id = b.item_id
       LEFT JOIN adm_users u ON u.id = b.created_by
       WHERE b.company_id = :companyId
       ORDER BY b.created_at DESC`,
      { companyId }
    );
    const parsedItems = items.map(item => ({
      ...item,
      operations: item.operations ? (typeof item.operations === 'string' ? JSON.parse(item.operations) : item.operations) : [],
      components: item.components ? (typeof item.components === 'string' ? JSON.parse(item.components) : item.components) : []
    }));
    res.json({ items: parsedItems });
  } catch (err) {
    next(err);
  }
};

export const getBomById = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const [bom] = await query(
      `SELECT b.*, i.item_name, i.item_code
       FROM prod_boms b
       JOIN inv_items i ON i.id = b.item_id
       WHERE b.id = :id AND b.company_id = :companyId`,
      { id, companyId }
    );
    if (!bom) throw httpError(404, "NOT_FOUND", "BOM not found");

    const componentsFromDb = await query(
      `SELECT bi.*, i.item_name, i.item_code
       FROM prod_bom_items bi
       JOIN inv_items i ON i.id = bi.item_id
       WHERE bi.bom_id = :id`,
      { id }
    );

    const operationsParsed = bom.operations ? (typeof bom.operations === 'string' ? JSON.parse(bom.operations) : bom.operations) : [];
    const componentsParsed = bom.components ? (typeof bom.components === 'string' ? JSON.parse(bom.components) : bom.components) : componentsFromDb;

    res.json({ item: { ...bom, operations: operationsParsed, components: componentsParsed } });
  } catch (err) {
    next(err);
  }
};

export const createBom = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.sub || req.user?.id;
    const { item_id, routing_id, bom_name, output_qty, is_active = true, components, operations } = req.body || {};

    if (!item_id || !bom_name || !output_qty) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    await conn.beginTransaction();

    const operationsStr = operations ? JSON.stringify(operations) : null;
    const componentsStr = components ? JSON.stringify(components) : null;

    const [result] = await conn.execute(
      `INSERT INTO prod_boms (company_id, item_id, routing_id, bom_name, output_qty, is_active, operations, components, created_by)
       VALUES (:companyId, :item_id, :routing_id, :bom_name, :output_qty, :is_active, :operationsStr, :componentsStr, :userId)`,
      { 
        companyId, 
        item_id, 
        routing_id: routing_id || null, 
        bom_name, 
        output_qty, 
        is_active: is_active ? 1 : 0, 
        operationsStr, 
        componentsStr, 
        userId 
      }
    );
    const bomId = result.insertId;

    if (Array.isArray(components)) {
      for (const comp of components) {
        if (comp.item_id) {
          await conn.execute(
            `INSERT INTO prod_bom_items (bom_id, item_id, qty, uom)
             VALUES (:bomId, :item_id, :qty, :uom)`,
            { bomId, item_id: comp.item_id, qty: comp.qty || 1, uom: comp.uom || "Pcs" }
          );
        }
      }
    }

    await conn.commit();
    res.status(201).json({ id: bomId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const updateBom = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    const { item_id, routing_id, bom_name, output_qty, is_active, components, operations } = req.body || {};

    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await conn.beginTransaction();

    const operationsStr = operations ? JSON.stringify(operations) : null;
    const componentsStr = components ? JSON.stringify(components) : null;

    await conn.execute(
      `UPDATE prod_boms 
       SET item_id = :item_id, routing_id = :routing_id, bom_name = :bom_name, output_qty = :output_qty, is_active = :is_active, operations = :operationsStr, components = :componentsStr
       WHERE id = :id AND company_id = :companyId`,
      { 
        id, 
        companyId, 
        item_id, 
        routing_id: routing_id || null, 
        bom_name, 
        output_qty, 
        is_active: is_active ? 1 : 0,
        operationsStr,
        componentsStr
      }
    );

    await conn.execute(`DELETE FROM prod_bom_items WHERE bom_id = :id`, { id });

    if (Array.isArray(components)) {
      for (const comp of components) {
        if (comp.item_id) {
          await conn.execute(
            `INSERT INTO prod_bom_items (bom_id, item_id, qty, uom)
             VALUES (:bomId, :item_id, :qty, :uom)`,
            { bomId: id, item_id: comp.item_id, qty: comp.qty || 1, uom: comp.uom || "Pcs" }
          );
        }
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const deleteBom = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    await query(`DELETE FROM prod_boms WHERE id = :id AND company_id = :companyId`, { id, companyId });
    await query(`DELETE FROM prod_bom_items WHERE bom_id = :id`, { id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ===== WORK ORDERS =====

export const listWorkOrders = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const items = await query(
      `SELECT wo.*, b.bom_name, i.item_name, i.item_code, u.username AS created_by_name
       FROM prod_work_orders wo
       JOIN prod_boms b ON b.id = wo.bom_id
       JOIN inv_items i ON i.id = b.item_id
       LEFT JOIN adm_users u ON u.id = wo.created_by
       WHERE wo.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(wo.branch_id, :branchIdsStr))
       ORDER BY wo.work_order_date DESC, wo.id DESC`,
      { companyId, branchId, branchIdsStr }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getWorkOrderById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const [wo] = await query(
      `SELECT wo.*, b.bom_name, i.item_name, i.item_code
       FROM prod_work_orders wo
       JOIN prod_boms b ON b.id = wo.bom_id
       JOIN inv_items i ON i.id = b.item_id
       WHERE wo.id = :id AND wo.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(wo.branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr }
    );
    if (!wo) throw httpError(404, "NOT_FOUND", "Work order not found");

    const items = await query(
      `SELECT woi.*, i.item_name, i.item_code
       FROM prod_work_order_items woi
       JOIN inv_items i ON i.id = woi.item_id
       WHERE woi.work_order_id = :id`,
      { id }
    );

    res.json({ item: { ...wo, items } });
  } catch (err) {
    next(err);
  }
};

export const createWorkOrder = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const userId = req.user?.sub || req.user?.id;
    let { work_order_no, work_order_date, bom_id, qty_to_produce, warehouse_id, remarks } = req.body || {};

    if (!work_order_date || !bom_id || !qty_to_produce) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    await conn.beginTransaction();

    // Generate 6-digit sequential Work Order Number starting from 1 with prefix WO- (WO-000001)
    const [countRow] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM prod_work_orders WHERE company_id = :companyId`,
      { companyId }
    );
    const nextSeq = Number(countRow?.[0]?.cnt || 0) + 1;
    const formattedWoNo = `WO-${String(nextSeq).padStart(6, '0')}`;
    const finalWoNo = (work_order_no && work_order_no.startsWith("WO-") && work_order_no.length >= 9)
      ? work_order_no
      : formattedWoNo;

    const [result] = await conn.execute(
      `INSERT INTO prod_work_orders (company_id, branch_id, work_order_no, work_order_date, bom_id, qty_to_produce, warehouse_id, status, remarks, created_by)
       VALUES (:companyId, :branchId, :work_order_no, :work_order_date, :bom_id, :qty_to_produce, :warehouse_id, 'DRAFT', :remarks, :userId)`,
      { companyId, branchId, branchIdsStr, work_order_no: finalWoNo, work_order_date, bom_id, qty_to_produce, warehouse_id, remarks, userId }
    );
    const woId = result.insertId;

    // Pull components from BOM
    const [bomItems] = await conn.execute(
      `SELECT item_id, qty, uom FROM prod_bom_items WHERE bom_id = :bom_id`,
      { bom_id }
    );

    const [bomHdr] = await conn.execute(
      `SELECT output_qty FROM prod_boms WHERE id = :bom_id`,
      { bom_id }
    );
    const outputQty = Number(bomHdr[0]?.output_qty || 1);
    const ratio = qty_to_produce / outputQty;

    for (const bi of bomItems) {
      await conn.execute(
        `INSERT INTO prod_work_order_items (work_order_id, item_id, planned_qty, actual_qty, uom)
         VALUES (:woId, :item_id, :planned_qty, :planned_qty, :uom)`,
        { woId, item_id: bi.item_id, planned_qty: bi.qty * ratio, uom: bi.uom }
      );
    }

    await conn.commit();
    res.status(201).json({ id: woId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const updateWorkOrderStatus = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const userId = req.user?.sub || req.user?.id;
    const id = toNumber(req.params.id);
    const { status, actual_items } = req.body || {};

    if (!id || !status) throw httpError(400, "VALIDATION_ERROR", "Missing required fields");

    const [wo] = await query(
      `SELECT * FROM prod_work_orders WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr }
    );
    if (!wo) throw httpError(404, "NOT_FOUND", "Work order not found");

    if (wo.status === "COMPLETED") {
      throw httpError(400, "BAD_REQUEST", "Completed work orders cannot be modified");
    }

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE prod_work_orders SET status = :status WHERE id = :id`,
      { status, id }
    );

    // Sync status to linked Production Plans
    await conn.execute(
      `UPDATE prod_daily_plans SET status = :status WHERE work_order_id = :id AND status != 'COMPLETED'`,
      { status, id }
    ).catch(() => {});

    // If actual items provided, update them
    if (Array.isArray(actual_items)) {
      for (const item of actual_items) {
        await conn.execute(
          `UPDATE prod_work_order_items SET actual_qty = :actual_qty WHERE work_order_id = :id AND item_id = :itemId`,
          { actual_qty: item.actual_qty, id, itemId: item.item_id }
        );
      }
    }

    // IF COMPLETED -> Inventory integration
    if (status === "COMPLETED") {
      // 1. Consume components
      const [items] = await conn.execute(
        `SELECT item_id, actual_qty FROM prod_work_order_items WHERE work_order_id = :id`,
        { id }
      );

      for (const item of items) {
        if (Number(item.actual_qty) > 0) {
          await consumeStockFIFOTx(conn, {
            companyId,
            branchId, branchIdsStr,
            warehouseId: wo.warehouse_id,
            itemId: item.item_id,
            transactionType: "PRODUCTION_CONSUMPTION",
            qtyToConsume: item.actual_qty,
            sourceRef: wo.work_order_no,
            createdBy: userId
          });
        }
      }

      // 2. Add finished goods
      const [bom] = await conn.execute(
        `SELECT item_id FROM prod_boms WHERE id = :bom_id`,
        { bom_id: wo.bom_id }
      );
      if (bom[0]) {
        await recordMovementTx(conn, {
          companyId,
          branchId, branchIdsStr,
          warehouseId: wo.warehouse_id,
          itemId: bom[0].item_id,
          transactionType: "PRODUCTION_OUTPUT",
          qtyChange: wo.qty_to_produce,
          sourceRef: wo.work_order_no,
          createdBy: userId,
          sourceType: "WORK_ORDER",
          sourceId: id
        });
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ===== PROCESSES MASTER =====

export const listProcesses = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const rawItems = await query(
      "SELECT * FROM prod_processes WHERE company_id = :companyId ORDER BY process_name ASC",
      { companyId }
    );
    const items = (rawItems || []).map(p => ({
      ...p,
      inputs: typeof p.inputs === 'string' ? JSON.parse(p.inputs || '[]') : (p.inputs || []),
      output_items: typeof p.output_items === 'string' ? JSON.parse(p.output_items || '[]') : (p.output_items || []),
      by_products: typeof p.by_products === 'string' ? JSON.parse(p.by_products || '[]') : (p.by_products || []),
      overheads: typeof p.overheads === 'string' ? JSON.parse(p.overheads || '[]') : (p.overheads || []),
      machines: typeof p.machines === 'string' ? JSON.parse(p.machines || '[]') : (p.machines || []),
      shifts: typeof p.shifts === 'string' ? JSON.parse(p.shifts || '[]') : (p.shifts || []),
    }));
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProcess = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const {
      process_name,
      description,
      department_id,
      department_name,
      bom_output_type_id,
      bom_output_type,
      inputs,
      output_items,
      by_products,
      overheads,
      machines,
      shifts,
      is_active,
    } = req.body;

    const result = await query(
      `INSERT INTO prod_processes (
        company_id, process_name, description, department_id, department_name,
        bom_output_type_id, bom_output_type, inputs, output_items, by_products, overheads, machines, shifts, is_active
      ) VALUES (
        :companyId, :process_name, :description, :department_id, :department_name,
        :bom_output_type_id, :bom_output_type, :inputs, :output_items, :by_products, :overheads, :machines, :shifts, :is_active
      )`,
      {
        companyId,
        process_name,
        description: description || "",
        department_id: department_id || null,
        department_name: department_name || null,
        bom_output_type_id: bom_output_type_id || null,
        bom_output_type: bom_output_type || null,
        inputs: JSON.stringify(inputs || []),
        output_items: JSON.stringify(output_items || []),
        by_products: JSON.stringify(by_products || []),
        overheads: JSON.stringify(overheads || []),
        machines: JSON.stringify(machines || []),
        shifts: JSON.stringify(shifts || []),
        is_active: is_active ? 1 : 0,
      }
    );
    res.json({ id: result.insertId, message: "Process created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProcess = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      process_name,
      description,
      department_id,
      department_name,
      bom_output_type_id,
      bom_output_type,
      inputs,
      output_items,
      by_products,
      overheads,
      machines,
      shifts,
      is_active,
    } = req.body;

    await query(
      `UPDATE prod_processes SET
        process_name = :process_name,
        description = :description,
        department_id = :department_id,
        department_name = :department_name,
        bom_output_type_id = :bom_output_type_id,
        bom_output_type = :bom_output_type,
        inputs = :inputs,
        output_items = :output_items,
        by_products = :by_products,
        overheads = :overheads,
        machines = :machines,
        shifts = :shifts,
        is_active = :is_active
       WHERE id = :id`,
      {
        id,
        process_name,
        description: description || "",
        department_id: department_id || null,
        department_name: department_name || null,
        bom_output_type_id: bom_output_type_id || null,
        bom_output_type: bom_output_type || null,
        inputs: JSON.stringify(inputs || []),
        output_items: JSON.stringify(output_items || []),
        by_products: JSON.stringify(by_products || []),
        overheads: JSON.stringify(overheads || []),
        machines: JSON.stringify(machines || []),
        shifts: JSON.stringify(shifts || []),
        is_active: is_active ? 1 : 0,
      }
    );
    res.json({ message: "Process updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProcess = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_processes WHERE id = :id", { id });
    res.json({ message: "Process deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== DEPARTMENTS SETUP =====

export const listDepartments = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    let items = await query(
      "SELECT * FROM prod_departments WHERE company_id = :companyId ORDER BY department_name ASC",
      { companyId }
    );
    if (!items || items.length === 0) {
      // Seed default departments
      const defaults = [
        { name: "Cutting & Preparation", code: "DEPT-CUT" },
        { name: "Machining & Fabrication", code: "DEPT-MACH" },
        { name: "Sub-Assembly", code: "DEPT-SUBASSY" },
        { name: "Main Assembly", code: "DEPT-ASSY" },
        { name: "Finishing & Coating", code: "DEPT-FINISH" },
        { name: "Quality Assurance & Testing", code: "DEPT-QA" },
        { name: "Packaging & Staging", code: "DEPT-PACK" },
      ];
      for (const d of defaults) {
        await query(
          "INSERT INTO prod_departments (company_id, department_name, code, is_active) VALUES (:companyId, :name, :code, 1)",
          { companyId, name: d.name, code: d.code }
        );
      }
      items = await query(
        "SELECT * FROM prod_departments WHERE company_id = :companyId ORDER BY department_name ASC",
        { companyId }
      );
    }
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { department_name, code, description, is_active } = req.body;
    
    // System populate department code if missing
    const generatedCode = code && code.trim() 
      ? code.trim() 
      : `DEPT-${(department_name || "").replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase() || Date.now().toString().slice(-4)}`;

    const result = await query(
      "INSERT INTO prod_departments (company_id, department_name, code, description, is_active) VALUES (:companyId, :department_name, :code, :description, :is_active)",
      { companyId, department_name, code: generatedCode, description: description || "", is_active: is_active ? 1 : 0 }
    );
    res.json({ id: result.insertId, code: generatedCode, message: "Department created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_name, code, description, is_active } = req.body;
    
    // Ensure code remains populated
    const existing = await query("SELECT code FROM prod_departments WHERE id = :id", { id });
    const finalCode = code && code.trim() 
      ? code.trim() 
      : (existing?.[0]?.code || `DEPT-${(department_name || "").replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase()}`);

    await query(
      "UPDATE prod_departments SET department_name = :department_name, code = :code, description = :description, is_active = :is_active WHERE id = :id",
      { id, department_name, code: finalCode, description: description || "", is_active: is_active ? 1 : 0 }
    );
    res.json({ message: "Department updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_departments WHERE id = :id", { id });
    res.json({ message: "Department deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== PRODUCTION WAREHOUSES SETUP =====

export const listProductionWarehouses = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    let items = await query(
      "SELECT * FROM prod_warehouses WHERE (company_id = :companyId OR company_id IS NULL) ORDER BY is_default DESC, warehouse_name ASC",
      { companyId }
    );
    if (!items || items.length === 0) {
      // Seed default production warehouses
      const defaults = [
        { name: "Main Raw Material Store", code: "PWH-RAW", is_default: 1 },
        { name: "Work-In-Progress (WIP) Staging Area", code: "PWH-WIP", is_default: 0 },
        { name: "Finished Goods Production Warehouse", code: "PWH-FG", is_default: 0 },
        { name: "Quarantine & Quality Testing Bay", code: "PWH-QA", is_default: 0 },
      ];
      for (const w of defaults) {
        await query(
          "INSERT INTO prod_warehouses (company_id, warehouse_name, code, is_default, is_active) VALUES (:companyId, :name, :code, :is_default, 1)",
          { companyId, name: w.name, code: w.code, is_default: w.is_default }
        );
      }
      items = await query(
        "SELECT * FROM prod_warehouses WHERE (company_id = :companyId OR company_id IS NULL) ORDER BY is_default DESC, warehouse_name ASC",
        { companyId }
      );
    }
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProductionWarehouse = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { warehouse_name, code, description, is_active, is_default } = req.body;
    const generatedCode = code && code.trim() ? code.trim() : `PWH-${(warehouse_name || "").replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase()}`;
    if (is_default) {
      await query("UPDATE prod_warehouses SET is_default = 0 WHERE (company_id = :companyId OR company_id IS NULL)", { companyId });
    }
    const result = await query(
      "INSERT INTO prod_warehouses (company_id, warehouse_name, code, description, is_default, is_active) VALUES (:companyId, :warehouse_name, :code, :description, :is_default, :is_active)",
      { companyId, warehouse_name, code: generatedCode, description: description || "", is_default: is_default ? 1 : 0, is_active: is_active ? 1 : 0 }
    );
    res.json({ id: result.insertId, code: generatedCode, message: "Production warehouse created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProductionWarehouse = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { id } = req.params;
    const { warehouse_name, code, description, is_active, is_default } = req.body;
    if (is_default) {
      await query("UPDATE prod_warehouses SET is_default = 0 WHERE (company_id = :companyId OR company_id IS NULL)", { companyId });
    }
    await query(
      "UPDATE prod_warehouses SET warehouse_name = :warehouse_name, code = :code, description = :description, is_default = :is_default, is_active = :is_active WHERE id = :id",
      { id, warehouse_name, code: code || "", description: description || "", is_default: is_default ? 1 : 0, is_active: is_active ? 1 : 0 }
    );
    res.json({ message: "Production warehouse updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setDefaultProductionWarehouse = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { id } = req.params;
    await query("UPDATE prod_warehouses SET is_default = 0 WHERE (company_id = :companyId OR company_id IS NULL)", { companyId });
    await query("UPDATE prod_warehouses SET is_default = 1, is_active = 1 WHERE id = :id", { id });
    res.json({ message: "Default production warehouse updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProductionWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_warehouses WHERE id = :id", { id });
    res.json({ message: "Production warehouse deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== BOM OUTPUT TYPES SETUP =====

export const listBomOutputTypes = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    let items = await query(
      "SELECT * FROM prod_bom_output_types WHERE company_id = :companyId ORDER BY type_name ASC",
      { companyId }
    );
    if (!items || items.length === 0) {
      // Seed default output types
      const defaults = [
        { name: "Main Finished Good", code: "BOT-FG" },
        { name: "Semi-Finished / Sub-Assembly", code: "BOT-SUB" },
        { name: "Co-Product Output", code: "BOT-COPROD" },
        { name: "By-Product Output", code: "BOT-BYPROD" },
        { name: "Scrap & Waste Output", code: "BOT-SCRAP" },
        { name: "Disassembly Component", code: "BOT-DISASSY" },
      ];
      for (const t of defaults) {
        await query(
          "INSERT INTO prod_bom_output_types (company_id, type_name, code, is_active) VALUES (:companyId, :name, :code, 1)",
          { companyId, name: t.name, code: t.code }
        );
      }
      items = await query(
        "SELECT * FROM prod_bom_output_types WHERE company_id = :companyId ORDER BY type_name ASC",
        { companyId }
      );
    }
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createBomOutputType = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { type_name, code, description, is_active } = req.body;
    const generatedCode = code && code.trim() ? code.trim() : `BOT-${(type_name || "").replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase()}`;
    const result = await query(
      "INSERT INTO prod_bom_output_types (company_id, type_name, code, description, is_active) VALUES (:companyId, :type_name, :code, :description, :is_active)",
      { companyId, type_name, code: generatedCode, description: description || "", is_active: is_active ? 1 : 0 }
    );
    res.json({ id: result.insertId, message: "BOM output type created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBomOutputType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type_name, code, description, is_active } = req.body;
    await query(
      "UPDATE prod_bom_output_types SET type_name = :type_name, code = :code, description = :description, is_active = :is_active WHERE id = :id",
      { id, type_name, code: code || "", description: description || "", is_active: is_active ? 1 : 0 }
    );
    res.json({ message: "BOM output type updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteBomOutputType = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_bom_output_types WHERE id = :id", { id });
    res.json({ message: "BOM output type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== MACHINES MASTER =====

export const listMachines = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      "SELECT * FROM prod_machines WHERE company_id = :companyId ORDER BY machine_name ASC",
      { companyId }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMachine = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const { machine_name, machine_code, is_active } = req.body;
    const result = await query(
      "INSERT INTO prod_machines (company_id, branch_id, machine_name, machine_code, is_active) VALUES (:companyId, :branchId, :machine_name, :machine_code, :is_active)",
      { companyId, branchId, machine_name, machine_code: machine_code || "", is_active: is_active ? 1 : 0 }
    );
    res.json({ id: result.insertId, message: "Machine created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const { machine_name, machine_code, is_active } = req.body;
    await query(
      "UPDATE prod_machines SET machine_name = :machine_name, machine_code = :machine_code, is_active = :is_active WHERE id = :id",
      { id, machine_name, machine_code, is_active: is_active ? 1 : 0 }
    );
    res.json({ message: "Machine updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMachine = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_machines WHERE id = :id", { id });
    res.json({ message: "Machine deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== SHIFTS MASTER =====

export const listShifts = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      "SELECT * FROM prod_shifts WHERE company_id = :companyId ORDER BY start_time ASC",
      { companyId }
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createShift = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { shift_name, start_time, end_time } = req.body;
    const result = await query(
      "INSERT INTO prod_shifts (company_id, shift_name, start_time, end_time) VALUES (:companyId, :shift_name, :start_time, :end_time)",
      { companyId, shift_name, start_time: start_time || null, end_time: end_time || null }
    );
    res.json({ id: result.insertId, message: "Shift created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { shift_name, start_time, end_time } = req.body;
    await query(
      "UPDATE prod_shifts SET shift_name = :shift_name, start_time = :start_time, end_time = :end_time WHERE id = :id",
      { id, shift_name, start_time, end_time }
    );
    res.json({ message: "Shift updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_shifts WHERE id = :id", { id });
    res.json({ message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== ROUTINGS =====

export const listRoutings = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const activeParam = String(req.query.active || "").trim().toLowerCase();
    const activeOnly = activeParam === "1" || activeParam === "true";

    let queryStr = `SELECT r.*, i.item_name, i.item_code 
       FROM prod_routings r
       JOIN inv_items i ON r.item_id = i.id
       WHERE r.company_id = :companyId`;
    
    if (activeOnly) {
      queryStr += ` AND r.is_active = 1`;
    }

    queryStr += ` ORDER BY i.item_name ASC`;

    const items = await query(queryStr, { companyId });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRoutingById = async (req, res) => {
  try {
    const { id } = req.params;
    const routing = await query("SELECT * FROM prod_routings WHERE id = :id", { id });
    if (!routing?.[0]) return res.status(404).json({ message: "Routing not found" });

    const steps = await query(
      `SELECT rs.*, p.process_name 
       FROM prod_routing_steps rs
       JOIN prod_processes p ON rs.process_id = p.id
       WHERE rs.routing_id = :id
       ORDER BY rs.step_order ASC`,
      { id }
    );

    res.json({ ...routing[0], steps });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createRouting = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { item_id, routing_name, is_default, is_active = 1, steps } = req.body;

    const [result] = await conn.execute(
      "INSERT INTO prod_routings (company_id, item_id, routing_name, is_default, is_active) VALUES (?, ?, ?, ?, ?)",
      [companyId, item_id, routing_name, is_default ? 1 : 0, is_active ? 1 : 0]
    );
    const routing_id = result.insertId;

    if (Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await conn.execute(
          "INSERT INTO prod_routing_steps (routing_id, process_id, step_order, setup_time_mins, cycle_time_mins) VALUES (?, ?, ?, ?, ?)",
          [routing_id, s.process_id, i + 1, s.setup_time_mins || 0, s.cycle_time_mins || 0]
        );
      }
    }

    await conn.commit();
    res.json({ id: routing_id, message: "Routing created successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const updateRouting = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { routing_name, is_default, is_active, steps } = req.body;

    const updates = [];
    const params = [];

    if (routing_name !== undefined) {
      updates.push("routing_name = ?");
      params.push(routing_name);
    }
    if (is_default !== undefined) {
      updates.push("is_default = ?");
      params.push(is_default ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(id);
      await conn.execute(
        `UPDATE prod_routings SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    }

    if (Array.isArray(steps)) {
      await conn.execute("DELETE FROM prod_routing_steps WHERE routing_id = ?", [id]);
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await conn.execute(
          "INSERT INTO prod_routing_steps (routing_id, process_id, step_order, setup_time_mins, cycle_time_mins) VALUES (?, ?, ?, ?, ?)",
          [id, s.process_id, i + 1, s.setup_time_mins || 0, s.cycle_time_mins || 0]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Routing updated successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== DAILY PRODUCTION PLANS =====

export const listDailyPlans = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId;

    let sql = "SELECT * FROM prod_daily_plans WHERE company_id = :company_id";
    const params = { company_id };

    if (branch_id) {
      sql += " AND (branch_id = :branch_id OR branch_id IS NULL)";
      params.branch_id = branch_id;
    }

    sql += " ORDER BY plan_date DESC, created_at DESC, id DESC";

    const items = await query(sql, params);
    const parsed = items.map(p => ({
      ...p,
      processes: typeof p.processes === 'string' ? JSON.parse(p.processes || '[]') : (p.processes || [])
    }));
    res.json({ items: parsed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDailyPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await query("SELECT * FROM prod_daily_plans WHERE id = :id", { id });
    if (!plan?.[0]) return res.status(404).json({ message: "Plan not found" });

    const pData = plan[0];
    pData.processes = typeof pData.processes === 'string' ? JSON.parse(pData.processes || '[]') : (pData.processes || []);

    const items = await query(
      `SELECT dpi.*, i.item_name, i.item_code, b.bom_name
       FROM prod_daily_plan_items dpi
       JOIN inv_items i ON dpi.item_id = i.id
       LEFT JOIN prod_boms b ON dpi.bom_id = b.id
       WHERE dpi.plan_id = :id`,
      { id }
    );

    res.json({ ...pData, items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createDailyPlan = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const user_id = req.user?.sub || req.user?.id || 1;

    const {
      plan_no,
      plan_date,
      plan_period,
      start_date,
      end_date,
      work_order_id,
      work_order_no,
      item_id,
      product_name,
      bom_id,
      bom_description,
      quantity,
      manufacture_date,
      expiry_date,
      batch_number,
      processes,
      status,
      remarks,
      items
    } = req.body;

    const ts = Date.now().toString().slice(-6);
    const job_card_no = req.body.job_card_no || `JC-${ts}`;
    const job_card_date = req.body.job_card_date || (plan_date || new Date().toISOString().split('T')[0]);

    const result = await query(
      `INSERT INTO prod_daily_plans (
        company_id, branch_id, plan_no, plan_date, plan_period, start_date, end_date, work_order_id, work_order_no,
        item_id, product_name, bom_id, bom_description, quantity, manufacture_date,
        expiry_date, batch_number, job_card_no, job_card_date, processes, status, remarks, created_by
      ) VALUES (
        :company_id, :branch_id, :plan_no, :plan_date, :plan_period, :start_date, :end_date, :work_order_id, :work_order_no,
        :item_id, :product_name, :bom_id, :bom_description, :quantity, :manufacture_date,
        :expiry_date, :batch_number, :job_card_no, :job_card_date, :processes, :status, :remarks, :created_by
      )`,
      {
        company_id,
        branch_id,
        plan_no: plan_no || `PLAN-${ts}`,
        plan_date: plan_date || new Date().toISOString().split('T')[0],
        plan_period: plan_period || 'DAILY',
        start_date: (start_date && start_date !== "") ? start_date : (plan_date || null),
        end_date: (end_date && end_date !== "") ? end_date : (plan_date || null),
        work_order_id: (work_order_id && work_order_id !== "") ? work_order_id : null,
        work_order_no: work_order_no || null,
        item_id: (item_id && item_id !== "") ? item_id : null,
        product_name: product_name || null,
        bom_id: (bom_id && bom_id !== "") ? bom_id : null,
        bom_description: bom_description || null,
        quantity: quantity || 0,
        manufacture_date: (manufacture_date && manufacture_date !== "") ? manufacture_date : null,
        expiry_date: (expiry_date && expiry_date !== "") ? expiry_date : null,
        batch_number: batch_number || null,
        job_card_no,
        job_card_date: (job_card_date && job_card_date !== "") ? job_card_date : null,
        processes: JSON.stringify(processes || []),
        status: status || 'DRAFT',
        remarks: remarks || "",
        created_by: user_id
      }
    );

    const plan_id = result.insertId;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await query(
          "INSERT INTO prod_daily_plan_items (plan_id, item_id, bom_id, qty_to_produce) VALUES (:plan_id, :item_id, :bom_id, :qty_to_produce)",
          { plan_id, item_id: item.item_id, bom_id: (item.bom_id && item.bom_id !== "") ? item.bom_id : null, qty_to_produce: item.qty_to_produce || 0 }
        );
      }
    }

    // Fetch production settings to check auto-requisition rule
    const settingsRows = await query(
      "SELECT settings_json FROM prod_settings WHERE company_id = :company_id LIMIT 1",
      { company_id }
    ).catch(() => []);
    let autoGenMatReq = true; // default true if configured or status released
    if (settingsRows?.[0]?.settings_json) {
      try {
        const parsedCfg = JSON.parse(settingsRows[0].settings_json);
        if (parsedCfg.auto_generate_material_requisitions !== undefined) {
          autoGenMatReq = !!parsedCfg.auto_generate_material_requisitions;
        }
      } catch {}
    }

    // Auto-create Material Requisition (MIR) if enabled in setup OR if plan is created as RELEASED/IN_PROGRESS
    // Auto-update linked Production Order status to PLANNED
    if (work_order_id) {
      await query(
        `UPDATE prod_work_orders SET status = 'PLANNED' WHERE id = :work_order_id`,
        { work_order_id }
      ).catch(() => {});
    }

    res.json({ id: plan_id, plan_no, job_card_no, job_card_date, message: "Daily plan created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to auto-create Material Requisition
async function autoCreateMaterialRequisition(company_id, branch_id, plan_id, work_order_id, bom_id, quantity, processes, user_id) {
  try {
    const existingReq = await query(
      "SELECT id FROM prod_material_requisitions WHERE company_id = :company_id AND plan_id = :plan_id LIMIT 1",
      { company_id, plan_id }
    );

    if (existingReq && existingReq.length > 0) return;

    // Fetch setup configured warehouses
    const settingsRows = await query(
      "SELECT settings_json FROM prod_settings WHERE company_id = :company_id LIMIT 1",
      { company_id }
    ).catch(() => []);
    let warehouse_id = null;
    let target_dept_id = null;
    if (settingsRows?.[0]?.settings_json) {
      try {
        const parsed = JSON.parse(settingsRows[0].settings_json);
        warehouse_id = parsed.default_source_warehouse_id || parsed.default_warehouse_id || null;
      } catch {}
    }

    // Default department to Production department if available
    const depts = await query("SELECT id FROM prod_departments WHERE company_id = :company_id LIMIT 1", { company_id }).catch(() => []);
    if (depts?.[0]?.id) target_dept_id = depts[0].id;

    const [maxReq] = await query(
      "SELECT MAX(id) as max_id FROM prod_material_requisitions WHERE company_id = :company_id",
      { company_id }
    );
    const nextSeq = (Number(maxReq[0]?.max_id || 0) + 1).toString().padStart(6, '0');
    const requisition_no = `PDMR-${nextSeq}`;
    const requisition_date = new Date().toISOString().split('T')[0];

    const reqResult = await query(
      `INSERT INTO prod_material_requisitions (
        company_id, branch_id, requisition_no, work_order_id, plan_id, warehouse_id, department_id, priority, requisition_date, status, requested_by, created_by, remarks
      ) VALUES (
        :company_id, :branch_id, :requisition_no, :work_order_id, :plan_id, :warehouse_id, :department_id, 'HIGH', :requisition_date, 'PENDING', :user_id, :user_id, 'Auto-generated from Released Production Plan'
      )`,
      {
        company_id,
        branch_id,
        requisition_no,
        work_order_id: (work_order_id && work_order_id !== "") ? work_order_id : null,
        plan_id,
        warehouse_id,
        department_id: target_dept_id,
        requisition_date,
        user_id: user_id || null
      }
    );

    const requisition_id = reqResult.insertId;
    let itemsInserted = 0;

    // 1. Collect materials from processes
    const parsedProcesses = typeof processes === 'string' ? JSON.parse(processes) : (processes || []);
    for (const proc of parsedProcesses) {
      const inputs = proc.inputs || [];
      for (const inp of inputs) {
        if (inp.item_id) {
          const reqQty = (parseFloat(inp.qty) || 1) * (1 + (parseFloat(inp.scrap_percent) || 0) / 100) * (parseFloat(quantity) || 1);
          await query(
            `INSERT INTO prod_material_requisition_items (
              requisition_id, item_id, qty_requested, uom
            ) VALUES (
              :requisition_id, :item_id, :qty_requested, :uom
            )`,
            {
              requisition_id,
              item_id: inp.item_id,
              qty_requested: Math.round(reqQty) || 1,
              uom: inp.uom || 'Pcs'
            }
          );
          itemsInserted++;
        }
      }
    }

    // 2. If no process inputs, explode directly from BOM items
    if (itemsInserted === 0 && bom_id) {
      const bomItems = await query(
        `SELECT bi.*, i.unit_name FROM prod_bom_items bi LEFT JOIN inv_items i ON bi.item_id = i.id WHERE bi.bom_id = :bom_id`,
        { bom_id }
      ).catch(() => []);

      for (const bItem of bomItems) {
        const reqQty = (parseFloat(bItem.quantity || bItem.qty) || 1) * (1 + (parseFloat(bItem.scrap_percent) || 0) / 100) * (parseFloat(quantity) || 1);
        await query(
          `INSERT INTO prod_material_requisition_items (
            requisition_id, item_id, qty_requested, uom
          ) VALUES (
            :requisition_id, :item_id, :qty_requested, :uom
          )`,
          {
            requisition_id,
            item_id: bItem.item_id,
            qty_requested: Math.round(reqQty) || 1,
            uom: bItem.uom || bItem.unit_name || 'Pcs'
          }
        );
      }
    }
  } catch (err) {
    console.error("Auto MIR Creation Error:", err);
  }
}

export const updateDailyPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, branch_id, id: user_id } = req.user;
    const {
      plan_date,
      plan_period,
      start_date,
      end_date,
      work_order_id,
      work_order_no,
      item_id,
      product_name,
      bom_id,
      bom_description,
      quantity,
      manufacture_date,
      expiry_date,
      batch_number,
      processes,
      status,
      remarks,
      items
    } = req.body;

    await query(
      `UPDATE prod_daily_plans SET
        plan_date = :plan_date,
        plan_period = :plan_period,
        start_date = :start_date,
        end_date = :end_date,
        work_order_id = :work_order_id,
        work_order_no = :work_order_no,
        item_id = :item_id,
        product_name = :product_name,
        bom_id = :bom_id,
        bom_description = :bom_description,
        quantity = :quantity,
        manufacture_date = :manufacture_date,
        expiry_date = :expiry_date,
        batch_number = :batch_number,
        processes = :processes,
        status = :status,
        remarks = :remarks
       WHERE id = :id`,
      {
        id,
        plan_date: plan_date || new Date().toISOString().split('T')[0],
        plan_period: plan_period || 'DAILY',
        start_date: (start_date && start_date !== "") ? start_date : (plan_date || null),
        end_date: (end_date && end_date !== "") ? end_date : (plan_date || null),
        work_order_id: (work_order_id && work_order_id !== "") ? work_order_id : null,
        work_order_no: work_order_no || null,
        item_id: (item_id && item_id !== "") ? item_id : null,
        product_name: product_name || null,
        bom_id: (bom_id && bom_id !== "") ? bom_id : null,
        bom_description: bom_description || null,
        quantity: quantity || 0,
        manufacture_date: (manufacture_date && manufacture_date !== "") ? manufacture_date : null,
        expiry_date: (expiry_date && expiry_date !== "") ? expiry_date : null,
        batch_number: batch_number || null,
        processes: JSON.stringify(processes || []),
        status: status || 'DRAFT',
        remarks: remarks || ""
      }
    );

    if (Array.isArray(items)) {
      await query("DELETE FROM prod_daily_plan_items WHERE plan_id = :id", { id });
      for (const item of items) {
        await query(
          "INSERT INTO prod_daily_plan_items (plan_id, item_id, bom_id, qty_to_produce) VALUES (:plan_id, :item_id, :bom_id, :qty_to_produce)",
          { plan_id: id, item_id: item.item_id, bom_id: item.bom_id || null, qty_to_produce: item.qty_to_produce || 0 }
        );
      }
    }

    // Fetch production settings to check auto-requisition rule
    const settingsRows = await query(
      "SELECT settings_json FROM prod_settings WHERE company_id = :company_id LIMIT 1",
      { company_id }
    ).catch(() => []);
    let autoGenMatReq = true;
    if (settingsRows?.[0]?.settings_json) {
      try {
        const parsedCfg = JSON.parse(settingsRows[0].settings_json);
        if (parsedCfg.auto_generate_material_requisitions !== undefined) {
          autoGenMatReq = !!parsedCfg.auto_generate_material_requisitions;
        }
      } catch {}
    }

    if (work_order_id) {
      await query(
        `UPDATE prod_work_orders SET status = 'PLANNED' WHERE id = :work_order_id`,
        { work_order_id }
      ).catch(() => {});
    }

    res.json({ message: "Daily plan updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== JOB CARDS =====

export const listJobCards = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;

    const items = await query(
      `SELECT jc.*, 
              COALESCE(i.item_name, 'Finished Goods') as item_name, 
              i.item_code, 
              COALESCE(p.process_name, 'Manufacturing Process') as process_name, 
              p.machines as process_machines,
              p.shifts as process_shifts,
              m.machine_name as direct_machine_name, 
              s.shift_name as direct_shift_name, 
              dp.processes as plan_processes,
              b.operations as bom_operations,
              CASE 
                WHEN jc.status = 'COMPLETED' THEN 'COMPLETED'
                WHEN dp.status = 'COMPLETED' OR wo.status = 'COMPLETED' THEN 'COMPLETED'
                ELSE 'IN_PROGRESS'
              END as status,
              dp.plan_no
       FROM prod_job_cards jc
       LEFT JOIN prod_daily_plans dp ON jc.plan_id = dp.id
       LEFT JOIN prod_work_orders wo ON dp.work_order_id = wo.id
       LEFT JOIN prod_boms b ON (dp.bom_id IS NOT NULL AND dp.bom_id = b.id) OR (wo.bom_id IS NOT NULL AND wo.bom_id = b.id)
       LEFT JOIN inv_items i ON jc.item_id = i.id
       LEFT JOIN prod_processes p ON jc.process_id = p.id
       LEFT JOIN prod_machines m ON jc.machine_id = m.id
       LEFT JOIN prod_shifts s ON jc.shift_id = s.id
       WHERE (jc.company_id = :company_id OR jc.company_id IS NULL)
         AND (dp.status IS NULL OR dp.status != 'DRAFT')
       ORDER BY jc.created_at DESC`,
      { company_id }
    );

    // Fetch master machines and shifts to resolve machine/shift references
    const [allMachines, allShifts] = await Promise.all([
      query("SELECT id, machine_name FROM prod_machines"),
      query("SELECT id, shift_name FROM prod_shifts")
    ]);

    const machineMap = new Map((allMachines || []).map(mac => [String(mac.id), mac.machine_name]));
    const shiftMap = new Map((allShifts || []).map(sh => [String(sh.id), sh.shift_name]));

    const enrichedItems = (items || []).map(jc => {
      let resolvedMachine = jc.direct_machine_name;
      let resolvedShift = jc.direct_shift_name;

      // 1. Resolve from plan_processes
      if ((!resolvedMachine || !resolvedShift) && jc.plan_processes) {
        try {
          const procs = typeof jc.plan_processes === 'string' ? JSON.parse(jc.plan_processes) : jc.plan_processes;
          if (Array.isArray(procs)) {
            const matchedProc = procs.find(pr => String(pr.process_id || pr.id) === String(jc.process_id)) || procs[0];
            if (matchedProc) {
              if (!resolvedMachine) {
                resolvedMachine = matchedProc.machine_name || (matchedProc.machine_id ? machineMap.get(String(matchedProc.machine_id)) : null);
              }
              if (!resolvedShift) {
                resolvedShift = matchedProc.shift_name || (matchedProc.shift_id ? shiftMap.get(String(matchedProc.shift_id)) : null);
              }
            }
          }
        } catch {}
      }

      // 2. Resolve from bom_operations
      if ((!resolvedMachine || !resolvedShift) && jc.bom_operations) {
        try {
          const ops = typeof jc.bom_operations === 'string' ? JSON.parse(jc.bom_operations) : jc.bom_operations;
          if (Array.isArray(ops)) {
            const matchedOp = ops.find(op => String(op.process_id || op.id) === String(jc.process_id)) || ops[0];
            if (matchedOp) {
              if (!resolvedMachine) {
                resolvedMachine = matchedOp.machine_name || (matchedOp.machine_id ? machineMap.get(String(matchedOp.machine_id)) : null);
              }
              if (!resolvedShift) {
                resolvedShift = matchedOp.shift_name || (matchedOp.shift_id ? shiftMap.get(String(matchedOp.shift_id)) : null);
              }
            }
          }
        } catch {}
      }

      // 3. Resolve from process_machines / process_shifts on prod_processes
      if (!resolvedMachine && jc.process_machines) {
        try {
          const macs = typeof jc.process_machines === 'string' ? JSON.parse(jc.process_machines) : jc.process_machines;
          if (Array.isArray(macs) && macs.length > 0) {
            const firstMac = macs[0];
            resolvedMachine = typeof firstMac === 'object' ? (firstMac.machine_name || firstMac.name) : machineMap.get(String(firstMac));
          }
        } catch {}
      }

      if (!resolvedShift && jc.process_shifts) {
        try {
          const shs = typeof jc.process_shifts === 'string' ? JSON.parse(jc.process_shifts) : jc.process_shifts;
          if (Array.isArray(shs) && shs.length > 0) {
            const firstSh = shs[0];
            resolvedShift = typeof firstSh === 'object' ? (firstSh.shift_name || firstSh.name) : shiftMap.get(String(firstSh));
          }
        } catch {}
      }

      // Fallbacks to default master machines/shifts if still unassigned
      if (!resolvedMachine) {
        resolvedMachine = allMachines?.[0]?.machine_name || "Main Work Center";
      }
      if (!resolvedShift) {
        resolvedShift = allShifts?.[0]?.shift_name || "Day Shift";
      }

      return {
        ...jc,
        machine_name: resolvedMachine,
        shift_name: resolvedShift
      };
    });

    res.json({ items: enrichedItems });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getJobCardById = async (req, res) => {
  try {
    const { id } = req.params;
    const items = await query(
      `SELECT jc.*, 
              COALESCE(jc.item_id, dp.item_id) as item_id,
              COALESCE(i.item_name, i2.item_name, 'Produced Product') as item_name, 
              COALESCE(i.item_code, i2.item_code, 'ITEM-01') as item_code, 
              COALESCE(i.uom, i2.uom, 'Pcs') as uom,
              COALESCE(i.uom, i2.uom, 'Pcs') as item_uom,
              COALESCE(i.uom, i2.uom, 'Pcs') as output_uom,
              COALESCE(p.process_name, 'Manufacturing Process') as process_name, 
              p.inputs as process_inputs, 
              p.by_products as process_by_products,
              p.overheads as process_overheads,
              p.machines as process_machines,
              m.machine_name, 
              s.shift_name, 
              COALESCE(dp.plan_no, wo.work_order_no, CONCAT('PLAN-', jc.plan_id)) as plan_no, 
              dp.plan_date,
              dp.work_order_id,
              dp.work_order_no,
              dp.bom_id as plan_bom_id,
              COALESCE(jc.batch_no, dp.batch_number) as batch_number,
              COALESCE(jc.mfg_date, dp.manufacture_date) as manufacture_date,
              COALESCE(jc.expiry_date, dp.expiry_date) as expiry_date,
              COALESCE(jc.planned_qty, dp.quantity, wo.qty_to_produce, 1) as plan_quantity,
              dp.processes as plan_processes,
              wo.work_order_no as order_no,
              wo.work_order_date as order_date,
              wo.warehouse_id as production_warehouse_id,
              wo.bom_id as wo_bom_id,
              u.full_name as operator_user_name,
              b.bom_name as bom_no,
              b.created_at as bom_date,
              b.components as bom_components,
              b.operations as bom_operations
       FROM prod_job_cards jc
       LEFT JOIN prod_daily_plans dp ON jc.plan_id = dp.id
       LEFT JOIN prod_work_orders wo ON dp.work_order_id = wo.id
       LEFT JOIN inv_items i ON jc.item_id = i.id
       LEFT JOIN inv_items i2 ON dp.item_id = i2.id
       LEFT JOIN prod_processes p ON jc.process_id = p.id
       LEFT JOIN prod_boms b ON dp.bom_id = b.id
       LEFT JOIN prod_machines m ON jc.machine_id = m.id
       LEFT JOIN prod_shifts s ON jc.shift_id = s.id
       LEFT JOIN adm_users u ON jc.operator_id = u.id
       WHERE jc.id = :id`,
      { id }
    );
    if (!items?.[0]) return res.status(404).json({ message: "Job card not found" });
    const jc = items[0];

    // Fetch BOM directly by item_id if bom_components is missing
    if (!jc.bom_components && jc.item_id) {
      try {
        const itemBom = await query(
          "SELECT id, bom_name as bom_no, components as bom_components, operations as bom_operations FROM prod_boms WHERE item_id = :item_id LIMIT 1",
          { item_id: jc.item_id }
        );
        if (itemBom?.[0]) {
          jc.plan_bom_id = jc.plan_bom_id || itemBom[0].id;
          jc.bom_no = jc.bom_no || itemBom[0].bom_no;
          jc.bom_components = itemBom[0].bom_components;
          jc.bom_operations = itemBom[0].bom_operations;
        }
      } catch {}
    }

    // Fetch BOM Raw Material Consumption Items if bom_id is available (from plan_id or work_order_id or item_id)
    let targetBomId = jc.plan_bom_id || jc.wo_bom_id;
    if (!targetBomId && jc.item_id) {
      try {
        const itemBom = await query("SELECT id FROM prod_boms WHERE item_id = :item_id AND is_active = 1 LIMIT 1", { item_id: jc.item_id });
        if (itemBom?.[0]?.id) targetBomId = itemBom[0].id;
      } catch {}
    }

    let bomItems = [];
    if (targetBomId) {
      try {
        bomItems = await query(
          `SELECT bi.*, COALESCE(i.item_name, 'Raw Material') as item_name, i.item_code, COALESCE(bi.uom, i.uom, 'Pcs') as uom
           FROM prod_bom_items bi
           LEFT JOIN inv_items i ON bi.item_id = i.id
           WHERE bi.bom_id = :bom_id`,
          { bom_id: targetBomId }
        );
      } catch (err) {
        console.error("Error fetching BOM items for job card:", err);
      }
    }

    let planProcesses = [];
    if (jc.plan_processes) {
      try {
        planProcesses = typeof jc.plan_processes === 'string' ? JSON.parse(jc.plan_processes) : jc.plan_processes;
      } catch {}
    }

    const safeJsonParse = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        let parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    let parsedInputs = safeJsonParse(jc.consumption_details);
    const plannedOutput = Number(jc.planned_qty || jc.plan_quantity || 1);

    // If consumption_details is completely empty, resolve default template from Plan / BOM / Process Master:
    if (!parsedInputs || parsedInputs.length === 0) {
      let candidateInputs = [];

      // 1. From Plan Processes
      if (planProcesses && planProcesses.length > 0) {
        const extractedInputs = [];
        planProcesses.forEach(p => {
          const procInputs = p.inputs || p.raw_materials || p.items || [];
          if (Array.isArray(procInputs)) procInputs.forEach(i => extractedInputs.push(i));
        });
        if (extractedInputs.length > 0) {
          candidateInputs = extractedInputs.map(i => {
            const recipeQty = Number(i.base_qty || i.unit_qty || i.recipe_qty || (plannedOutput > 0 && i.qty ? (Number(i.qty) / plannedOutput) : 1) || i.qty || 1);
            const totalConsumed = Number(i.actual_qty || i.qty || (recipeQty * plannedOutput));
            const uCost = Number(i.cost_value || i.unit_cost || i.cost_price || i.cost || i.standard_cost || 0);
            return {
              item_id: i.item_id || i.id,
              item_name: i.item_name || i.name || "Raw Material",
              item_code: i.item_code || i.code || "RM-01",
              qty: recipeQty,
              actual_qty: totalConsumed,
              total_req: totalConsumed.toFixed(3),
              uom: i.uom || 'Pcs',
              unit_cost: uCost,
              total_cost: Number((totalConsumed * uCost).toFixed(2))
            };
          });
        }
      }

      // 2. From BOM Operations
      if (candidateInputs.length === 0 && jc.bom_operations) {
        try {
          const ops = typeof jc.bom_operations === 'string' ? JSON.parse(jc.bom_operations) : jc.bom_operations;
          if (Array.isArray(ops)) {
            const opInputs = [];
            ops.forEach(op => {
              if (Array.isArray(op.inputs)) op.inputs.forEach(inp => opInputs.push(inp));
            });
            if (opInputs.length > 0) {
              candidateInputs = opInputs.map(i => {
                const recipeQty = Number(i.base_qty || i.unit_qty || i.recipe_qty || i.qty || 1);
                const totalConsumed = Number(i.actual_qty || i.qty || (recipeQty * plannedOutput));
                const uCost = Number(i.cost_value || i.unit_cost || i.cost_price || i.cost || 0);
                return {
                  item_id: i.item_id || i.id,
                  item_name: i.item_name || i.name || "Raw Material",
                  item_code: i.item_code || i.code || "RM-01",
                  qty: recipeQty,
                  actual_qty: totalConsumed,
                  total_req: totalConsumed.toFixed(3),
                  uom: i.uom || 'Pcs',
                  unit_cost: uCost,
                  total_cost: Number((totalConsumed * uCost).toFixed(2))
                };
              });
            }
          }
        } catch {}
      }

      // 3. From BOM Items / Components
      if (candidateInputs.length === 0 && bomItems && bomItems.length > 0) {
        candidateInputs = bomItems.map(bi => {
          const itemQty = Number(bi.qty || bi.quantity || 1);
          const reqQty = itemQty * plannedOutput;
          const uCost = Number(bi.unit_cost || bi.cost_price || bi.cost || 0);
          return {
            item_id: bi.item_id,
            item_name: bi.item_name,
            item_code: bi.item_code || 'RM-RAW',
            qty: itemQty,
            actual_qty: reqQty,
            total_req: reqQty.toFixed(3),
            uom: bi.uom || 'Pcs',
            unit_cost: uCost,
            total_cost: Number((reqQty * uCost).toFixed(2))
          };
        });
      } else if (candidateInputs.length === 0 && jc.bom_components) {
        try {
          const comps = typeof jc.bom_components === 'string' ? JSON.parse(jc.bom_components) : jc.bom_components;
          if (Array.isArray(comps)) {
            candidateInputs = comps.map(c => {
              const recipeQty = Number(c.qty || c.quantity || c.base_qty || 1);
              const reqQty = recipeQty * plannedOutput;
              const uCost = Number(c.unit_cost || c.cost_price || c.cost || c.cost_value || 0);
              return {
                item_id: c.item_id,
                item_name: c.item_name || c.name || "Raw Material",
                item_code: c.item_code || "RM",
                qty: recipeQty,
                actual_qty: reqQty,
                total_req: reqQty.toFixed(3),
                uom: c.uom || 'Pcs',
                unit_cost: uCost,
                total_cost: Number((reqQty * uCost).toFixed(2))
              };
            });
          }
        } catch {}
      }

      // 4. From Process Master Inputs
      if (candidateInputs.length === 0 && jc.process_inputs) {
        try {
          const pInp = typeof jc.process_inputs === 'string' ? JSON.parse(jc.process_inputs) : jc.process_inputs;
          if (Array.isArray(pInp) && pInp.length > 0) {
            candidateInputs = pInp.map(i => {
              const qty = Number(i.qty || i.required_qty || i.base_qty || 1);
              const req = qty * plannedOutput;
              const cost = Number(i.cost_value || i.unit_cost || i.cost_price || i.cost || 0);
              return {
                item_id: i.item_id || i.id,
                item_name: i.item_name || i.name || "Raw Material",
                item_code: i.item_code || i.code || "RM-01",
                qty: qty,
                actual_qty: req,
                total_req: req.toFixed(3),
                uom: i.uom || "Pcs",
                unit_cost: cost,
                total_cost: Number((req * cost).toFixed(2))
              };
            });
          }
        } catch {}
      }

      if (candidateInputs.length > 0) {
        parsedInputs = candidateInputs;
      }
    }

    // Enrich item_name, item_code, uom, and cost_price from inv_items for all consumption lines
    if (parsedInputs && parsedInputs.length > 0) {
      const itemIds = parsedInputs.map(pi => pi.item_id).filter(Boolean);
      let itemMap = new Map();
      if (itemIds.length > 0) {
        try {
          const fetchedItems = await query(
            `SELECT id, item_name, item_code, uom, cost_price, selling_price FROM inv_items WHERE id IN (${itemIds.map(() => '?').join(',')})`,
            itemIds
          );
          itemMap = new Map((fetchedItems || []).map(i => [String(i.id), i]));
        } catch (err) {
          console.error("Error enriching consumption items:", err);
        }
      }

      parsedInputs = parsedInputs.map(pi => {
        const matched = pi.item_id ? itemMap.get(String(pi.item_id)) : null;
        const finalUnitCost = pi.unit_cost !== undefined && pi.unit_cost !== null && !isNaN(Number(pi.unit_cost)) ? Number(pi.unit_cost) : Number(matched?.cost_price || 0);
        const finalActualQty = pi.actual_qty !== undefined && pi.actual_qty !== null ? Number(pi.actual_qty) : (Number(pi.qty || 1) * plannedOutput);
        const finalTotalCost = pi.total_cost !== undefined && pi.total_cost !== null && !isNaN(Number(pi.total_cost)) && Number(pi.total_cost) > 0 ? Number(pi.total_cost) : Number((finalActualQty * finalUnitCost).toFixed(2));
        return {
          ...pi,
          item_id: pi.item_id || matched?.id,
          item_name: pi.item_name || matched?.item_name || "Raw Material",
          item_code: pi.item_code || matched?.item_code || "RM-01",
          uom: pi.uom || matched?.uom || 'Pcs',
          actual_qty: finalActualQty,
          unit_cost: finalUnitCost,
          total_cost: finalTotalCost
        };
      });
    }

    let parsedOverheads = safeJsonParse(jc.overhead_details);
    
    // If overhead_details is empty, resolve from Linked BOM / Plan / Process Master:
    if (!parsedOverheads || parsedOverheads.length === 0) {
      let candidateOverheads = [];

      // 1. From Linked BOM Operations
      if (jc.bom_operations) {
        try {
          const ops = typeof jc.bom_operations === 'string' ? JSON.parse(jc.bom_operations) : jc.bom_operations;
          if (Array.isArray(ops)) {
            ops.forEach(op => {
              if (Array.isArray(op.overheads)) {
                op.overheads.forEach(ov => candidateOverheads.push(ov));
              }
            });
          }
        } catch {}
      }

      // 2. From Linked Plan Processes
      if (candidateOverheads.length === 0 && planProcesses && planProcesses.length > 0) {
        planProcesses.forEach(p => {
          if (Array.isArray(p.overheads)) {
            p.overheads.forEach(ov => candidateOverheads.push(ov));
          }
        });
      }

      // 3. From Process Master Overheads
      if (candidateOverheads.length === 0 && jc.process_overheads) {
        try {
          const pOvh = typeof jc.process_overheads === 'string' ? JSON.parse(jc.process_overheads) : jc.process_overheads;
          if (Array.isArray(pOvh)) {
            pOvh.forEach(ov => candidateOverheads.push(ov));
          }
        } catch {}
      }

      if (candidateOverheads.length > 0) {
        parsedOverheads = candidateOverheads;
      }
    }

    // Enrich Overheads with Setup Master Defaults (prod_overheads table)
    let setupOverheadMap = new Map();
    try {
      const setupOvhRows = await query("SELECT overhead_name, default_cost_rate, allocation_basis FROM prod_overheads WHERE is_active = 1");
      (setupOvhRows || []).forEach(o => {
        const cleanName = (o.overhead_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        setupOverheadMap.set(cleanName, o);
      });
    } catch {}

    if (parsedOverheads && Array.isArray(parsedOverheads)) {
      parsedOverheads = parsedOverheads.map(o => {
        const name = o.overhead_name || o.overhead_type || o.overhead_category || o.name || "Operational Overhead";
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedSetup = setupOverheadMap.get(cleanName) || setupOverheadMap.get(cleanName.replace(/labor/, 'labour')) || setupOverheadMap.get(cleanName.replace(/labour/, 'labor'));
        
        let rate = Number(o.cost_rate || o.rate || 0);
        if (rate <= 0 && matchedSetup?.default_cost_rate) {
          rate = Number(matchedSetup.default_cost_rate);
        }
        
        const allocBasis = o.allocation_basis || matchedSetup?.allocation_basis || "per Hour";
        
        let qty = 1;
        if (o.qty !== undefined && o.qty !== null && !isNaN(Number(o.qty)) && Number(o.qty) > 0) {
          qty = Number(o.qty);
        } else if (o.base_qty !== undefined && o.base_qty !== null && !isNaN(Number(o.base_qty)) && Number(o.base_qty) > 0) {
          qty = Number(o.base_qty);
        } else if (allocBasis.toLowerCase().includes('unit') || allocBasis.toLowerCase().includes('pcs')) {
          qty = plannedOutput;
        } else {
          qty = 1;
        }

        let amt = 0;
        if (o.amount !== undefined && o.amount !== null && !isNaN(Number(o.amount)) && Number(o.amount) > 0) {
          amt = Number(o.amount);
        } else if (o.est_cost !== undefined && o.est_cost !== null && !isNaN(Number(o.est_cost)) && Number(o.est_cost) > 0) {
          amt = Number(o.est_cost);
        } else {
          amt = Number((qty * rate).toFixed(2));
        }

        return {
          overhead_type: name,
          allocation_basis: allocBasis,
          qty,
          rate,
          amount: amt
        };
      });
    }

    let parsedByProducts = safeJsonParse(jc.by_products_details);
    
    // 1. Process Master By-Products
    if ((!parsedByProducts || parsedByProducts.length === 0) && jc.process_by_products) {
      try {
        const pBy = typeof jc.process_by_products === 'string' ? JSON.parse(jc.process_by_products) : jc.process_by_products;
        if (Array.isArray(pBy) && pBy.length > 0) {
          parsedByProducts = pBy.map(b => {
            const expQty = Number(b.expected_qty || b.qty || 1);
            return {
              item_name: b.byproduct_name || b.item_name || "Secondary Scrap",
              item_code: b.item_code || "SCRAP",
              qty: Number((expQty * plannedOutput).toFixed(2)),
              uom: b.uom || "Kg",
              est_value: Number(b.expected_cost || b.est_value || 0)
            };
          });
        }
      } catch {}
    } else if ((!parsedByProducts || parsedByProducts.length === 0) && planProcesses && planProcesses.length > 0) {
      const extractedByProds = [];
      planProcesses.forEach(p => {
        if (Array.isArray(p.by_products)) p.by_products.forEach(b => extractedByProds.push(b));
      });
      if (extractedByProds.length > 0) parsedByProducts = extractedByProds;
    }

    let parsedBreakdowns = safeJsonParse(jc.breakdown_details);

    // Fetch machines & shifts linked strictly to the specific Job Card process/routing step
    let linkedMachineIds = new Set();
    let linkedMachineNames = new Set();
    let linkedShiftIds = new Set();
    let linkedShiftNames = new Set();
    let routeShiftId = null;

    // 1. Pick ALL machines and shifts from the Production Operation Processes section on the Linked Production Plan
    if (planProcesses && planProcesses.length > 0) {
      planProcesses.forEach(pr => {
        if (pr.machine_id) linkedMachineIds.add(String(pr.machine_id));
        if (pr.machine_name) linkedMachineNames.add(String(pr.machine_name).toLowerCase().trim());
        if (pr.shift_id) linkedShiftIds.add(String(pr.shift_id));
        if (pr.shift_name) linkedShiftNames.add(String(pr.shift_name).toLowerCase().trim());
        if (!routeShiftId && pr.shift_id) routeShiftId = pr.shift_id;
        
        if (Array.isArray(pr.machine_ids) && pr.machine_ids.length > 0) {
          pr.machine_ids.forEach(id => linkedMachineIds.add(String(id)));
        }
        if (Array.isArray(pr.machines) && pr.machines.length > 0) {
          pr.machines.forEach(m => {
            if (typeof m === 'object' && (m?.id || m?.machine_id)) linkedMachineIds.add(String(m.id || m.machine_id));
            if (typeof m === 'object' && (m?.machine_name || m?.name)) linkedMachineNames.add(String(m.machine_name || m.name).toLowerCase().trim());
            if (typeof m === 'string' || typeof m === 'number') {
              const strVal = String(m).trim();
              if (!isNaN(strVal)) linkedMachineIds.add(strVal);
              else linkedMachineNames.add(strVal.toLowerCase());
            }
          });
        }

        if (Array.isArray(pr.shift_ids) && pr.shift_ids.length > 0) {
          pr.shift_ids.forEach(id => linkedShiftIds.add(String(id)));
        }
        if (Array.isArray(pr.shifts) && pr.shifts.length > 0) {
          pr.shifts.forEach(s => {
            if (typeof s === 'object' && (s?.id || s?.shift_id)) linkedShiftIds.add(String(s.id || s.shift_id));
            if (typeof s === 'object' && (s?.shift_name || s?.name)) linkedShiftNames.add(String(s.shift_name || s.name).toLowerCase().trim());
            if (typeof s === 'string' || typeof s === 'number') {
              const strVal = String(s).trim();
              if (!isNaN(strVal)) linkedShiftIds.add(strVal);
              else linkedShiftNames.add(strVal.toLowerCase());
            }
          });
        }
      });
    }

    // 2. Explicit machine / shift assigned on Job Card (only if not already provided by the linked production plan)
    if (linkedMachineIds.size === 0 && linkedMachineNames.size === 0 && jc.machine_id) {
      linkedMachineIds.add(String(jc.machine_id));
    }
    if (linkedShiftIds.size === 0 && linkedShiftNames.size === 0 && jc.shift_id) {
      linkedShiftIds.add(String(jc.shift_id));
    }

    // 4. Routing step specifically for this process_id / item_id
    if (linkedMachineIds.size === 0 && linkedMachineNames.size === 0 && jc.item_id) {
      try {
        const routeSteps = await query(
          `SELECT rs.machine_id, rs.shift_id 
           FROM prod_routing_steps rs 
           JOIN prod_routings r ON rs.routing_id = r.id 
           WHERE r.item_id = :item_id ${jc.process_id ? 'AND rs.process_id = :process_id' : ''} AND (rs.machine_id IS NOT NULL OR rs.shift_id IS NOT NULL)
           ORDER BY rs.step_order ASC`,
          { item_id: jc.item_id, process_id: jc.process_id }
        );
        (routeSteps || []).forEach(rs => {
          if (rs.machine_id) linkedMachineIds.add(String(rs.machine_id));
          if (rs.shift_id) linkedShiftIds.add(String(rs.shift_id));
          if (!routeShiftId && rs.shift_id) routeShiftId = rs.shift_id;
        });
      } catch {}
    }

    // 5. Lookup Process Master by process_name if process_id wasn't directly linked
    if (linkedMachineIds.size === 0 && linkedMachineNames.size === 0 && jc.process_name) {
      try {
        const matchedProcs = await query(
          `SELECT machines, shifts FROM prod_processes WHERE process_name = :pname OR process_name LIKE :pnameLike`,
          { pname: jc.process_name, pnameLike: `%${jc.process_name}%` }
        );
        (matchedProcs || []).forEach(proc => {
          if (proc.machines) {
            const pm = typeof proc.machines === 'string' ? JSON.parse(proc.machines) : proc.machines;
            if (Array.isArray(pm)) {
              pm.forEach(m => {
                if (typeof m === 'object' && (m?.id || m?.machine_id)) linkedMachineIds.add(String(m.id || m.machine_id));
                if (typeof m === 'object' && (m?.machine_name || m?.name)) linkedMachineNames.add(String(m.machine_name || m.name).toLowerCase().trim());
                if (typeof m === 'string' || typeof m === 'number') {
                  const strVal = String(m).trim();
                  if (!isNaN(strVal)) linkedMachineIds.add(strVal);
                  else linkedMachineNames.add(strVal.toLowerCase());
                }
              });
            }
          }
          if (proc.shifts) {
            const ps = typeof proc.shifts === 'string' ? JSON.parse(proc.shifts) : proc.shifts;
            if (Array.isArray(ps)) {
              ps.forEach(s => {
                if (typeof s === 'object' && (s?.id || s?.shift_id)) linkedShiftIds.add(String(s.id || s.shift_id));
                if (typeof s === 'object' && (s?.shift_name || s?.name)) linkedShiftNames.add(String(s.shift_name || s.name).toLowerCase().trim());
                if (typeof s === 'string' || typeof s === 'number') {
                  const strVal = String(s).trim();
                  if (!isNaN(strVal)) linkedShiftIds.add(strVal);
                  else linkedShiftNames.add(strVal.toLowerCase());
                }
              });
            }
          }
        });
      } catch {}
    }

    // 6. Keyword match process_name against machine_name (e.g. "Mixing Process" -> "Mixing Machine")
    if (linkedMachineIds.size === 0 && linkedMachineNames.size === 0 && jc.process_name) {
      try {
        const procKeyword = jc.process_name.replace(/process|step|operation/gi, '').trim();
        if (procKeyword.length >= 3) {
          const matchedMacs = await query(
            `SELECT id, machine_name FROM prod_machines WHERE machine_name LIKE :kw`,
            { kw: `%${procKeyword}%` }
          );
          (matchedMacs || []).forEach(m => linkedMachineIds.add(String(m.id)));
        }
      } catch {}
    }

    let linkedMachinesList = [];
    let linkedShiftsList = [];
    try {
      const allMacs = await query("SELECT id, machine_name, machine_code FROM prod_machines");
      if (linkedMachineIds.size > 0 || linkedMachineNames.size > 0) {
        linkedMachinesList = (allMacs || []).filter(m => 
          linkedMachineIds.has(String(m.id)) || 
          linkedMachineNames.has(String(m.machine_name || '').toLowerCase().trim())
        );
      }

      if (linkedMachineNames.size > 0) {
        Array.from(linkedMachineNames).forEach((name, idx) => {
          const titleName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (!linkedMachinesList.some(m => (m.machine_name || '').toLowerCase().trim() === name.toLowerCase().trim())) {
            linkedMachinesList.push({
              id: `plan-mac-${idx + 1}`,
              machine_name: titleName,
              machine_code: `MAC-0${idx + 1}`
            });
          }
        });
      }

      const allShifts = await query("SELECT id, shift_name FROM prod_shifts");
      if (linkedShiftIds.size > 0 || linkedShiftNames.size > 0) {
        linkedShiftsList = (allShifts || []).filter(s => 
          linkedShiftIds.has(String(s.id)) || 
          linkedShiftNames.has(String(s.shift_name || '').toLowerCase().trim())
        );
      }

      if (linkedShiftNames.size > 0) {
        Array.from(linkedShiftNames).forEach((name, idx) => {
          const titleName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (!linkedShiftsList.some(s => (s.shift_name || '').toLowerCase().trim() === name.toLowerCase().trim())) {
            linkedShiftsList.push({
              id: `plan-shift-${idx + 1}`,
              shift_name: titleName
            });
          }
        });
      }

      const hasPlan = !!(jc.plan_id || (planProcesses && planProcesses.length > 0));
      if (!hasPlan && linkedMachinesList.length === 0 && Array.isArray(allMacs) && allMacs.length > 0) {
        linkedMachinesList = allMacs;
      }
      if (!hasPlan && linkedShiftsList.length === 0 && Array.isArray(allShifts) && allShifts.length > 0) {
        linkedShiftsList = allShifts;
      }
    } catch (err) {
      console.error("Error fetching linked machines / shifts:", err);
    }

    let targetPlannedQty = Number(jc.plan_quantity || jc.planned_qty || 1);
    if (targetPlannedQty <= 1 && jc.plan_quantity) {
      targetPlannedQty = Number(jc.plan_quantity);
    }

    const isSavedMachineInPlan = linkedMachinesList.some(m => String(m.id) === String(jc.machine_id));
    const effectiveMachineId = (isSavedMachineInPlan && jc.machine_id)
      ? jc.machine_id 
      : (linkedMachinesList[0]?.id || jc.machine_id || "");

    const isSavedShiftInPlan = linkedShiftsList.some(s => String(s.id) === String(jc.shift_id));
    const effectiveShiftId = (isSavedShiftInPlan && jc.shift_id)
      ? jc.shift_id 
      : (linkedShiftsList[0]?.id || routeShiftId || jc.shift_id || "");

    // Fetch Base Currency from fin_currencies
    let baseCurrency = { code: 'GHS', symbol: 'GH₵', name: 'Ghana Cedis' };
    try {
      const baseCurrRows = await query("SELECT code, symbol, name FROM fin_currencies WHERE is_base = 1 AND is_active = 1 LIMIT 1");
      if (baseCurrRows?.[0]) {
        baseCurrency = baseCurrRows[0];
      }
    } catch {}

    const totalConsumption = parsedInputs.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
    const totalOverhead = (parsedOverheads || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalProductionCost = totalConsumption + totalOverhead;

    res.json({ 
      ...jc, 
      good_qty: (jc.good_qty !== undefined && jc.good_qty !== null && jc.good_qty !== "") ? jc.good_qty : "",
      rejected_qty: (jc.rejected_qty !== undefined && jc.rejected_qty !== null && jc.rejected_qty !== "") ? jc.rejected_qty : "",
      scrap_qty: (jc.scrap_qty !== undefined && jc.scrap_qty !== null && jc.scrap_qty !== "") ? jc.scrap_qty : "",
      batch_no: jc.batch_no || jc.batch_number || "",
      mfg_date: jc.mfg_date || jc.manufacture_date || null,
      expiry_date: jc.expiry_date || null,
      machine_id: jc.machine_id || effectiveMachineId || "",
      plan_machine_id: linkedMachinesList[0]?.id || "",
      shift_id: jc.shift_id || effectiveShiftId || "",
      plan_shift_id: linkedShiftsList[0]?.id || "",
      operator_id: jc.operator_id ? String(jc.operator_id) : "",
      operator_name: jc.operator_name || jc.operator_user_name || "",
      planned_qty: targetPlannedQty,
      route_shift_id: effectiveShiftId || routeShiftId || null,
      linked_machines: linkedMachinesList || [],
      linked_shifts: linkedShiftsList || [],
      inputs: parsedInputs || [],
      consumption_details: parsedInputs || [],
      overheads: parsedOverheads || [],
      overhead_details: parsedOverheads || [],
      by_products: parsedByProducts || [],
      by_products_details: parsedByProducts || [],
      breakdowns: parsedBreakdowns || [],
      breakdown_details: parsedBreakdowns || [],
      base_currency: baseCurrency.code,
      base_currency_symbol: baseCurrency.symbol,
      base_currency_name: baseCurrency.name,
      total_consumption: Number(jc.total_consumption || totalConsumption),
      total_overhead: Number(jc.total_overhead || totalOverhead),
      total_production_cost: Number(jc.total_production_cost || totalProductionCost)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateJobCards = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { plan_id } = req.body;
    const company_id = req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.user?.branch_id || req.user?.branchId || 1;

    const planHeaderRes = await query(
      `SELECT dp.*, wo.bom_id as wo_bom_id 
       FROM prod_daily_plans dp 
       LEFT JOIN prod_work_orders wo ON dp.work_order_id = wo.id 
       WHERE dp.id = :plan_id`,
      { plan_id }
    );
    const planHeader = planHeaderRes?.[0];
    if (!planHeader) {
      return res.status(404).json({ message: "Production plan not found" });
    }

    let defaultProcessId = null;
    const defaultProc = await query("SELECT id FROM prod_processes LIMIT 1");
    if (defaultProc?.[0]) defaultProcessId = defaultProc[0].id;

    let planProcesses = [];
    if (planHeader.processes) {
      try {
        planProcesses = typeof planHeader.processes === 'string' ? JSON.parse(planHeader.processes) : planHeader.processes;
      } catch {}
    }

    const targetItemId = planHeader.item_id || 1;
    const targetQty = Number(planHeader.quantity || 1);
    const batchNo = planHeader.batch_number || `BATCH-${Date.now().toString().slice(-6)}`;
    const mfgDate = planHeader.manufacture_date ? new Date(planHeader.manufacture_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const expDate = planHeader.expiry_date ? new Date(planHeader.expiry_date).toISOString().split('T')[0] : null;

    let generatedCount = 0;

    // 1. If processes are defined on the Daily Plan, generate a job card for each process line
    if (Array.isArray(planProcesses) && planProcesses.length > 0) {
      for (const pr of planProcesses) {
        const procId = pr.process_id || pr.id || defaultProcessId;
        let macId = pr.machine_id || (Array.isArray(pr.machine_ids) ? pr.machine_ids[0] : null);
        
        if (!macId && pr.machine_name) {
          try {
            const foundMac = (await query("SELECT id FROM prod_machines WHERE machine_name = :mname LIMIT 1", { mname: pr.machine_name }))?.[0];
            if (foundMac?.id) macId = foundMac.id;
          } catch {}
        }

        let shiftId = pr.shift_id || null;
        if (!shiftId && pr.shift_name) {
          try {
            const foundShift = (await query("SELECT id FROM prod_shifts WHERE shift_name = :sname LIMIT 1", { sname: pr.shift_name }))?.[0];
            if (foundShift?.id) shiftId = foundShift.id;
          } catch {}
        }

        await conn.execute(
          `INSERT INTO prod_job_cards 
           (company_id, branch_id, plan_id, item_id, process_id, machine_id, shift_id, planned_qty, batch_no, mfg_date, expiry_date, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS')`,
          [company_id, branch_id, plan_id, targetItemId, procId, macId, shiftId, targetQty, batchNo, mfgDate, expDate]
        );
        generatedCount++;
      }
    } else {
      // 2. Check routing steps for item
      const routingSteps = await query(
        `SELECT rs.* 
         FROM prod_routing_steps rs
         JOIN prod_routings r ON rs.routing_id = r.id
         WHERE r.item_id = :item_id AND r.is_default = 1
         ORDER BY rs.step_order ASC`,
        { item_id: targetItemId }
      );

      if (routingSteps && routingSteps.length > 0) {
        for (const step of routingSteps) {
          await conn.execute(
            `INSERT INTO prod_job_cards 
             (company_id, branch_id, plan_id, item_id, process_id, machine_id, planned_qty, batch_no, mfg_date, expiry_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS')`,
            [company_id, branch_id, plan_id, targetItemId, step.process_id, step.machine_id || null, targetQty, batchNo, mfgDate, expDate]
          );
          generatedCount++;
        }
      } else {
        await conn.execute(
          `INSERT INTO prod_job_cards 
           (company_id, branch_id, plan_id, item_id, process_id, planned_qty, batch_no, mfg_date, expiry_date, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS')`,
          [company_id, branch_id, plan_id, targetItemId, defaultProcessId || 1, targetQty, batchNo, mfgDate, expDate]
        );
        generatedCount++;
      }
    }

    // Mark Production Plan & Work Order status as IN_PROGRESS
    await conn.execute("UPDATE prod_daily_plans SET status = 'IN_PROGRESS' WHERE id = ?", [plan_id]);
    if (planHeader.work_order_id) {
      await conn.execute("UPDATE prod_work_orders SET status = 'IN_PROGRESS' WHERE id = ?", [planHeader.work_order_id]);
    }

    await conn.commit();
    res.json({ message: `Generated ${generatedCount} job cards successfully` });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const updateJobCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      job_card_no,
      job_card_date,
      batch_no,
      mfg_date,
      expiry_date,
      machine_id,
      machine_ids,
      shift_id, 
      operator_id, 
      operator_name, 
      assistant_name,
      actual_qty, 
      good_qty, 
      rejected_qty, 
      scrap_qty, 
      defect_reason, 
      total_wastage,
      total_overhead,
      total_consumption,
      total_production_cost,
      consumption_details,
      overhead_details,
      by_products_details,
      breakdown_details,
      wastage_details,
      status, 
      start_time, 
      end_time 
    } = req.body;

    const toDbDate = (d) => {
      if (!d || d === "" || d === "null" || d === "undefined" || d === "0000-00-00" || String(d).includes("Invalid")) return null;
      try {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? null : dt.toISOString().split("T")[0];
      } catch {
        return null;
      }
    };

    const toJsonString = (val) => {
      if (!val) return null;
      if (typeof val === 'string') {
        try {
          JSON.parse(val);
          return val;
        } catch {
          return JSON.stringify(val);
        }
      }
      return JSON.stringify(val);
    };

    const effectiveGood = (good_qty !== undefined && good_qty !== null && good_qty !== "") ? Number(good_qty) : (actual_qty !== undefined ? Number(actual_qty) : 0);
    const effectiveRej = (rejected_qty !== undefined && rejected_qty !== null && rejected_qty !== "") ? Number(rejected_qty) : 0;
    const effectiveScrap = (scrap_qty !== undefined && scrap_qty !== null && scrap_qty !== "") ? Number(scrap_qty) : 0;
    const effectiveTotal = effectiveGood + effectiveRej;

    const effectiveMachineId = machine_id || (Array.isArray(machine_ids) && machine_ids.length > 0 ? machine_ids[0] : null);

    await query(
      `UPDATE prod_job_cards 
       SET job_card_no = :job_card_no,
           job_card_date = :cleanJobCardDate,
           batch_no = :batch_no,
           mfg_date = :cleanMfgDate,
           expiry_date = :cleanExpDate,
           machine_id = :machine_id, 
           shift_id = :shift_id, 
           operator_id = :operator_id,
           operator_name = :operator_name,
           assistant_name = :assistant_name,
           actual_qty = :actual_qty,
           good_qty = :good_qty,
           rejected_qty = :rejected_qty,
           scrap_qty = :scrap_qty,
           defect_reason = :defect_reason,
           total_wastage = :total_wastage,
           total_overhead = :total_overhead,
           total_consumption = :total_consumption,
           total_production_cost = :total_production_cost,
           consumption_details = :consumption_details_str,
           overhead_details = :overhead_details_str,
           by_products_details = :by_products_details_str,
           breakdown_details = :breakdown_details_str,
           wastage_details = :wastage_details_str,
           status = :status, 
           start_time = :start_time, 
           end_time = :end_time 
       WHERE id = :id`,
      { 
        id, 
        job_card_no: job_card_no || null,
        cleanJobCardDate: toDbDate(job_card_date) || new Date().toISOString().split("T")[0],
        batch_no: batch_no || null,
        cleanMfgDate: toDbDate(mfg_date),
        cleanExpDate: toDbDate(expiry_date),
        machine_id: effectiveMachineId ? String(effectiveMachineId) : null, 
        shift_id: shift_id ? String(shift_id) : null, 
        operator_id: operator_id ? String(operator_id).replace(/^usr-/, '') : null,
        operator_name: operator_name || null,
        assistant_name: assistant_name || null,
        actual_qty: effectiveTotal || 0, 
        good_qty: effectiveGood || 0,
        rejected_qty: effectiveRej || 0,
        scrap_qty: effectiveScrap || 0,
        defect_reason: defect_reason || null,
        total_wastage: Number(total_wastage || 0),
        total_overhead: Number(total_overhead || 0),
        total_consumption: Number(total_consumption || 0),
        total_production_cost: Number(total_production_cost || 0),
        consumption_details_str: toJsonString(consumption_details),
        overhead_details_str: toJsonString(overhead_details),
        by_products_details_str: toJsonString(by_products_details),
        breakdown_details_str: toJsonString(breakdown_details),
        wastage_details_str: toJsonString(wastage_details),
        status: status || 'PENDING', 
        start_time: start_time || null, 
        end_time: end_time || null 
      }
    );

    if (status === "IN_PROGRESS") {
      await query(
        `UPDATE prod_daily_plans dp
         JOIN prod_job_cards jc ON jc.plan_id = dp.id
         SET dp.status = 'IN_PROGRESS'
         WHERE jc.id = :id AND dp.status != 'COMPLETED'`,
        { id }
      ).catch(() => {});

      await query(
        `UPDATE prod_work_orders wo
         JOIN prod_daily_plans dp ON dp.work_order_id = wo.id
         JOIN prod_job_cards jc ON jc.plan_id = dp.id
         SET wo.status = 'IN_PROGRESS'
         WHERE jc.id = :id AND wo.status != 'COMPLETED'`,
        { id }
      ).catch(() => {});
    }

    if (status === "COMPLETED" || status === "COMPLETE") {
      await query(
        `UPDATE prod_daily_plans dp
         JOIN prod_job_cards jc ON jc.plan_id = dp.id
         SET dp.status = 'COMPLETED'
         WHERE jc.id = :id`,
        { id }
      ).catch(() => {});

      await query(
        `UPDATE prod_work_orders wo
         JOIN prod_daily_plans dp ON dp.work_order_id = wo.id
         JOIN prod_job_cards jc ON jc.plan_id = dp.id
         SET wo.status = 'COMPLETED'
         WHERE jc.id = :id`,
        { id }
      ).catch(() => {});

      // Auto-post Material Utilization and Stock Journal (Consumption OUT & Output IN) for completed job card execution
      try {
        const company_id = req.user?.company_id || req.user?.companyId || 1;
        const branch_id = req.user?.branch_id || req.user?.branchId || 1;
        const user_id = req.user?.id || 1;
        const outputQty = Number(effectiveGood) > 0 ? Number(effectiveGood) : 1;
        const jobDate = job_card_date || new Date().toISOString().split('T')[0];

        // Fetch Default Production Warehouse configured in Setup
        const pSettingsRow = (await query("SELECT settings FROM prod_settings WHERE company_id = :company_id ORDER BY id DESC LIMIT 1", { company_id }))?.[0];
        const pSettings = pSettingsRow?.settings ? (typeof pSettingsRow.settings === 'string' ? JSON.parse(pSettingsRow.settings) : pSettingsRow.settings) : {};
        const defaultRawWh = pSettings.default_warehouse_id 
          || (await query("SELECT id FROM prod_warehouses WHERE is_default = 1 LIMIT 1"))?.[0]?.id 
          || 1;

        const fgWhRow = (await query("SELECT id FROM prod_warehouses WHERE code = 'PWH-FG' OR warehouse_name LIKE '%Finished%' LIMIT 1"))?.[0];
        const targetFgWh = fgWhRow?.id || 3;
        const targetRawWh = defaultRawWh;

        // 1. Generate PSJ sequential number
        const lastPj = await query(
          "SELECT journal_no FROM prod_stock_journals WHERE (company_id = :company_id OR company_id IS NULL) AND journal_no LIKE 'PSJ-%' ORDER BY id DESC LIMIT 1",
          { company_id }
        );
        let nextNum = 1;
        if (lastPj && lastPj.length > 0) {
          const match = String(lastPj[0].journal_no).match(/\d+/);
          if (match) nextNum = parseInt(match[0], 10) + 1;
        }
        const journal_no = `PSJ-${String(nextNum).padStart(6, '0')}`;

        const jcDetails = (await query(
          `SELECT jc.item_id, jc.plan_id, jc.job_card_no, jc.consumption_details, dp.bom_id 
           FROM prod_job_cards jc 
           LEFT JOIN prod_daily_plans dp ON dp.id = jc.plan_id 
           WHERE jc.id = :id`,
          { id }
        ))?.[0];
        const jcItemId = jcDetails?.item_id || 1;
        const jcPlanId = jcDetails?.plan_id || null;

        // 2. Insert or get Material Utilization Record
        const [existingMu] = await query(
          "SELECT id FROM prod_material_utilizations WHERE job_card_id = :id LIMIT 1",
          { id }
        );

        let muInsertId = existingMu?.id;
        if (!muInsertId) {
          const utilNo = await generateMaterialUtilizationNo(company_id);
          const muResult = await query(
            `INSERT INTO prod_material_utilizations 
              (company_id, branch_id, utilization_no, plan_id, job_card_id, warehouse_id, utilization_date, utilized_by, remarks, status)
             VALUES (:company_id, :branch_id, :utilNo, :jcPlanId, :id, :targetRawWh, :jobDate, :user_id, :uRemarks, 'COMPLETED')`,
            {
              company_id,
              branch_id,
              utilNo,
              jcPlanId,
              id,
              targetRawWh,
              jobDate,
              user_id,
              uRemarks: `Auto-recorded upon completion of Production Execution #${job_card_no || id}`
            }
          );
          muInsertId = muResult?.insertId || muResult?.id;
        }

        // 3. Insert Stock Journal Record
        const sjResult = await query(
          `INSERT INTO prod_stock_journals 
            (company_id, branch_id, journal_no, journal_type, plan_id, job_card_id, source_warehouse_id, destination_warehouse_id, journal_date, remarks, status, created_by)
           VALUES (:company_id, :branch_id, :journal_no, 'MANUFACTURING', :jcPlanId, :id, :targetRawWh, :targetFgWh, :jobDate, :remarks, 'POSTED', :user_id)`,
          {
            company_id,
            branch_id,
            journal_no,
            jcPlanId,
            id,
            targetRawWh,
            targetFgWh,
            jobDate,
            remarks: `Execution Output for Job Card #${job_card_no || id}. Batch: ${batch_no || 'N/A'}, MFG: ${mfg_date || 'N/A'}, EXP: ${expiry_date || 'N/A'}`,
            user_id
          }
        );

        const insertId = sjResult?.insertId || sjResult?.id;
        if (insertId) {
          // Output Finished Goods Item (IN)
          await query(
            `INSERT INTO prod_stock_journal_items (journal_id, item_id, warehouse_id, type, qty, uom, batch_no, expiry_date)
             VALUES (:journal_id, :item_id, :warehouse_id, 'PRODUCTION', :qty, 'Pcs', :batch_no, :expiry_date)`,
            {
              journal_id: insertId,
              item_id: jcItemId,
              warehouse_id: targetFgWh,
              qty: outputQty,
              batch_no: batch_no || null,
              expiry_date: expiry_date || null
            }
          );

          // Update FG stock balance and ledger
          const existingFgBal = await query(
            "SELECT id FROM inv_stock_balances WHERE company_id = :company_id AND warehouse_id = :warehouse_id AND item_id = :item_id LIMIT 1",
            { company_id, warehouse_id: targetFgWh, item_id: jcItemId }
          );
          if (existingFgBal && existingFgBal.length > 0) {
            await query("UPDATE inv_stock_balances SET qty = qty + :qty, updated_at = NOW() WHERE id = :balId", { qty: outputQty, balId: existingFgBal[0].id });
          } else {
            await query(
              `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty, batch_no, expiry_date, entry_date, source_type, source_id, created_by)
               VALUES (:company_id, :branch_id, :warehouse_id, :item_id, :qty, 0, :batch_no, :expiry_date, :entry_date, 'PROD_OUTPUT', :insertId, :user_id)`,
              { company_id, branch_id, warehouse_id: targetFgWh, item_id: jcItemId, qty: outputQty, batch_no: batch_no || null, expiry_date: expiry_date || null, entry_date: jobDate, insertId, user_id }
            );
          }
          await query(
            `INSERT INTO inv_stock_ledger (company_id, branch_id, warehouse_id, item_id, transaction_type, transaction_date, qty_change, batch_no, expiry_date, source_ref, created_by)
             VALUES (:company_id, :branch_id, :warehouse_id, :item_id, 'PROD_OUTPUT', :txDate, :qty, :batch_no, :expiry_date, :journal_no, :user_id)`,
            { company_id, branch_id, warehouse_id: targetFgWh, item_id: jcItemId, txDate: jobDate, qty: outputQty, batch_no: batch_no || null, expiry_date: expiry_date || null, journal_no, user_id }
          );

          // Gather raw material consumption items from:
          // 1. consumption_details passed in body or on job card
          // 2. BOM items if available
          let itemsToConsume = [];
          let parsedConsumption = [];
          if (consumption_details) {
            try {
              parsedConsumption = typeof consumption_details === 'string' ? JSON.parse(consumption_details) : consumption_details;
            } catch (e) { parsedConsumption = []; }
          }
          if (!Array.isArray(parsedConsumption) || parsedConsumption.length === 0) {
            const currentJcRow = (await query("SELECT consumption_details, bom_id FROM prod_job_cards WHERE id = :id", { id }))?.[0];
            if (currentJcRow?.consumption_details) {
              try {
                parsedConsumption = typeof currentJcRow.consumption_details === 'string' ? JSON.parse(currentJcRow.consumption_details) : currentJcRow.consumption_details;
              } catch (e) {}
            }
          }

          if (Array.isArray(parsedConsumption) && parsedConsumption.length > 0) {
            itemsToConsume = parsedConsumption.map((c) => ({
              item_id: c.item_id,
              qty: Number(c.actual_qty !== undefined && c.actual_qty !== null ? c.actual_qty : (c.qty || 1)),
              uom: c.uom || 'PCS',
              batch_no: c.batch_no || batch_no || null
            })).filter(c => c.item_id && c.qty > 0);
          }

          if (itemsToConsume.length === 0 && jcDetails?.bom_id) {
            const bomItems = await query(
              "SELECT item_id, quantity, uom FROM prod_bom_items WHERE bom_id = :bom_id",
              { bom_id: jcDetails.bom_id }
            );
            if (bomItems && bomItems.length > 0) {
              itemsToConsume = bomItems.map(b => ({
                item_id: b.item_id,
                qty: Number(b.quantity || 1) * outputQty,
                uom: b.uom || 'PCS',
                batch_no: batch_no || null
              }));
            }
          }

          // Insert items into Material Utilization and Stock Journal
          if (itemsToConsume.length > 0) {
            for (const item of itemsToConsume) {
              // Add to Material Utilization Items if not already present
              if (muInsertId) {
                const existingMuItem = await query(
                  "SELECT id FROM prod_material_utilization_items WHERE utilization_id = :muInsertId AND item_id = :itemId LIMIT 1",
                  { muInsertId, itemId: item.item_id }
                );
                if (!existingMuItem || existingMuItem.length === 0) {
                  await query(
                    `INSERT INTO prod_material_utilization_items 
                      (utilization_id, item_id, qty_required, qty_received, qty_utilized, uom, batch_no)
                     VALUES (:muInsertId, :item_id, :qty, :qty, :qty, :uom, :batch_no)`,
                    {
                      muInsertId,
                      item_id: item.item_id,
                      qty: item.qty,
                      uom: item.uom,
                      batch_no: item.batch_no
                    }
                  );
                }
              }

              // Add to Stock Journal Items (CONSUMPTION)
              await query(
                `INSERT INTO prod_stock_journal_items (journal_id, item_id, warehouse_id, type, qty, uom, batch_no)
                 VALUES (:journal_id, :item_id, :warehouse_id, 'CONSUMPTION', :qty, :uom, :batch_no)`,
                { journal_id: insertId, item_id: item.item_id, warehouse_id: targetRawWh, qty: item.qty, uom: item.uom, batch_no: item.batch_no }
              );

              // Deduct from raw material stock balance in the default production warehouse
              const existingRawBal = await query(
                "SELECT id FROM inv_stock_balances WHERE company_id = :company_id AND warehouse_id = :warehouse_id AND item_id = :item_id LIMIT 1",
                { company_id, warehouse_id: targetRawWh, item_id: item.item_id }
              );
              if (existingRawBal && existingRawBal.length > 0) {
                await query("UPDATE inv_stock_balances SET qty = GREATEST(0, qty - :qty), updated_at = NOW() WHERE id = :balId", { qty: item.qty, balId: existingRawBal[0].id });
              }
              await query(
                `INSERT INTO inv_stock_ledger (company_id, branch_id, warehouse_id, item_id, transaction_type, transaction_date, qty_change, batch_no, source_ref, created_by)
                 VALUES (:company_id, :branch_id, :warehouse_id, :item_id, 'PROD_CONSUMPTION', :txDate, :qty, :batch_no, :journal_no, :user_id)`,
                { company_id, branch_id, warehouse_id: targetRawWh, item_id: item.item_id, txDate: jobDate, qty: -item.qty, batch_no: item.batch_no, journal_no, user_id }
              );
            }
          }
        }
      } catch (err) {
        console.error("Stock journal & material utilization auto-post error:", err);
      }
    }
    
    res.json({ message: "Job card updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== MATERIAL RECEIPTS =====

export const listMaterialReceipts = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const items = await query(
      `SELECT mr.*, dp.plan_no, wo.work_order_no, COALESCE(pw.warehouse_name, w.warehouse_name) as warehouse_name, u.full_name as received_by_name
       FROM prod_material_receipts mr
       LEFT JOIN prod_daily_plans dp ON mr.plan_id = dp.id
       LEFT JOIN prod_work_orders wo ON mr.work_order_id = wo.id
       LEFT JOIN prod_warehouses pw ON mr.warehouse_id = pw.id
       LEFT JOIN inv_warehouses w ON mr.warehouse_id = w.id
       LEFT JOIN adm_users u ON mr.received_by = u.id
       WHERE (mr.company_id = :company_id OR mr.company_id IS NULL)
         AND (:branch_id IS NULL OR mr.branch_id = :branch_id OR mr.branch_id IS NULL)
       ORDER BY mr.receipt_date DESC, mr.id DESC`,
      { company_id, branch_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMaterialReceiptById = async (req, res) => {
  try {
    const { id } = req.params;
    const receipts = await query("SELECT * FROM prod_material_receipts WHERE id = :id", { id });
    if (!receipts?.[0]) return res.status(404).json({ message: "Material receipt not found" });

    const items = await query(
      `SELECT mri.*, i.item_name, i.item_code 
       FROM prod_material_receipt_items mri
       JOIN inv_items i ON mri.item_id = i.id
       WHERE mri.receipt_id = :id`,
      { id }
    );

    res.json({ ...receipts[0], items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMaterialReceipt = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const user_id = req.user?.id || req.user?.userId || null;
    const { work_order_id, plan_id, requisition_id, issue_id, warehouse_id, receipt_date, remarks, items } = req.body;

    const receipt_no = `PMR-${Date.now().toString().slice(-6)}`;

    const [result] = await conn.execute(
      "INSERT INTO prod_material_receipts (company_id, branch_id, receipt_no, work_order_id, plan_id, requisition_id, issue_id, warehouse_id, receipt_date, received_by, remarks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')",
      [company_id, branch_id, receipt_no, work_order_id || null, plan_id || null, requisition_id || null, issue_id || null, warehouse_id || null, receipt_date, user_id, remarks || '']
    );
    const receipt_id = result.insertId;

    if (requisition_id) {
      await conn.execute("UPDATE prod_material_requisitions SET status = 'FULFILLED' WHERE id = ?", [requisition_id]);
    }

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_material_receipt_items (receipt_id, item_id, qty_received, uom, batch_no) VALUES (?, ?, ?, ?, ?)",
          [receipt_id, item.item_id, item.qty_received, item.uom || '', item.batch_no || null]
        );

        if (requisition_id) {
          await conn.execute(
            "UPDATE prod_material_requisition_items SET qty_received = qty_received + ? WHERE requisition_id = ? AND item_id = ?",
            [item.qty_received, requisition_id, item.item_id]
          );
        }

        // Update inventory stock balances & ledger if destination warehouse provided
        if (warehouse_id && Number(item.qty_received) > 0) {
          const recQty = Number(item.qty_received);
          const [existingBal] = await conn.execute(
            "SELECT id, qty FROM inv_stock_balances WHERE company_id = ? AND warehouse_id = ? AND item_id = ? LIMIT 1",
            [company_id, warehouse_id, item.item_id]
          );

          if (existingBal && existingBal.length > 0) {
            await conn.execute(
              "UPDATE inv_stock_balances SET qty = qty + ?, updated_at = NOW() WHERE id = ?",
              [recQty, existingBal[0].id]
            );
          } else {
            await conn.execute(
              `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, batch_no, entry_date)
               VALUES (?, ?, ?, ?, ?, ?, NOW())`,
              [company_id, branch_id, warehouse_id, item.item_id, recQty, item.batch_no || null]
            );
          }

          await conn.execute(
            `INSERT INTO inv_stock_ledger (company_id, branch_id, warehouse_id, item_id, transaction_type, qty_change, source_ref, created_by)
             VALUES (?, ?, ?, ?, 'PRODUCTION_MATERIAL_RECEIPT', ?, ?, ?)`,
            [company_id, branch_id, warehouse_id, item.item_id, recQty, receipt_no, user_id]
          );
        }
      }
    }

    await conn.commit();
    res.json({ id: receipt_id, receipt_no, message: "Material receipt recorded successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== MATERIAL UTILIZATIONS =====

export const generateMaterialUtilizationNo = async (company_id) => {
  const lastRow = (await query(
    `SELECT utilization_no FROM prod_material_utilizations 
     WHERE (company_id = :company_id OR company_id IS NULL) AND utilization_no LIKE 'PMU-%' 
     ORDER BY id DESC LIMIT 1`,
    { company_id }
  ))?.[0];
  let nextNum = 1;
  if (lastRow && lastRow.utilization_no) {
    const match = String(lastRow.utilization_no).match(/\d+/);
    if (match) {
      nextNum = parseInt(match[0], 10) + 1;
    }
  }
  return `PMU-${String(nextNum).padStart(6, '0')}`;
};

export const getNextMaterialUtilizationNo = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const nextNo = await generateMaterialUtilizationNo(companyId);
    res.json({ next_no: nextNo });
  } catch (err) {
    next(err);
  }
};

export const listMaterialUtilizations = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const items = await query(
      `SELECT 
        mu.*, 
        dp.plan_no,
        jc.job_card_no,
        mr.receipt_no, 
        COALESCE(pw.warehouse_name, w.warehouse_name) as warehouse_name, 
        u.username as utilized_by_name,
        (SELECT COUNT(*) FROM prod_material_utilization_items WHERE utilization_id = mu.id) as item_count,
        (SELECT SUM(qty_utilized) FROM prod_material_utilization_items WHERE utilization_id = mu.id) as total_utilized_qty,
        (SELECT GROUP_CONCAT(DISTINCT COALESCE(i.item_name, i.item_code) SEPARATOR ', ')
         FROM prod_material_utilization_items mui
         JOIN inv_items i ON i.id = mui.item_id
         WHERE mui.utilization_id = mu.id) as item_names,
        (SELECT GROUP_CONCAT(DISTINCT CONCAT(COALESCE(i.item_name, i.item_code), ' (', mui.qty_utilized, ' ', COALESCE(mui.uom, 'Pcs'), ')') SEPARATOR ', ')
         FROM prod_material_utilization_items mui
         JOIN inv_items i ON i.id = mui.item_id
         WHERE mui.utilization_id = mu.id) as items_summary,
        (SELECT mui.uom FROM prod_material_utilization_items mui WHERE mui.utilization_id = mu.id LIMIT 1) as uom
       FROM prod_material_utilizations mu
       LEFT JOIN prod_daily_plans dp ON mu.plan_id = dp.id
       LEFT JOIN prod_job_cards jc ON mu.job_card_id = jc.id
       LEFT JOIN prod_material_receipts mr ON mu.receipt_id = mr.id
       LEFT JOIN prod_warehouses pw ON mu.warehouse_id = pw.id
       LEFT JOIN inv_warehouses w ON mu.warehouse_id = w.id
       LEFT JOIN adm_users u ON mu.utilized_by = u.id
       WHERE (mu.company_id = :companyId OR mu.company_id IS NULL)
       ORDER BY mu.utilization_date DESC, mu.id DESC`,
      { companyId }
    );
    res.json({ items: items || [] });
  } catch (error) {
    console.error("Error in listMaterialUtilizations:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getMaterialUtilizationById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const utilizations = await query(
      `SELECT 
        mu.*,
        dp.plan_no,
        jc.job_card_no,
        mr.receipt_no,
        COALESCE(pw.warehouse_name, w.warehouse_name) as warehouse_name
       FROM prod_material_utilizations mu
       LEFT JOIN prod_daily_plans dp ON mu.plan_id = dp.id
       LEFT JOIN prod_job_cards jc ON mu.job_card_id = jc.id
       LEFT JOIN prod_material_receipts mr ON mu.receipt_id = mr.id
       LEFT JOIN prod_warehouses pw ON mu.warehouse_id = pw.id
       LEFT JOIN inv_warehouses w ON mu.warehouse_id = w.id
       WHERE mu.id = :id AND (mu.company_id = :companyId OR mu.company_id IS NULL)`,
      { id, companyId }
    );
    if (!utilizations?.[0]) return res.status(404).json({ message: "Material utilization not found" });

    const items = await query(
      `SELECT mui.*, i.item_name, i.item_code 
       FROM prod_material_utilization_items mui
       JOIN inv_items i ON mui.item_id = i.id
       WHERE mui.utilization_id = :id`,
      { id }
    );

    res.json({ ...utilizations[0], items: items || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMaterialUtilization = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const userId = req.user?.id || 1;
    const { plan_id, job_card_id, requisition_id, receipt_id, warehouse_id, utilization_date = new Date().toISOString().split('T')[0], remarks, items } = req.body;

    const finalPlanId = plan_id && Number(plan_id) > 0 ? Number(plan_id) : null;
    const finalJobCardId = job_card_id && Number(job_card_id) > 0 ? Number(job_card_id) : null;
    const finalReceiptId = receipt_id && Number(receipt_id) > 0 ? Number(receipt_id) : null;
    const finalReqId = requisition_id && Number(requisition_id) > 0 ? Number(requisition_id) : null;
    const finalWhId = warehouse_id && Number(warehouse_id) > 0 ? Number(warehouse_id) : null;

    const utilization_no = await generateMaterialUtilizationNo(companyId);

    // Validate quantities before inserting
    if (Array.isArray(items)) {
      for (const item of items) {
        if (finalReceiptId) {
          const [recItem] = await conn.execute(
            "SELECT qty_received, qty_utilized FROM prod_material_receipt_items WHERE receipt_id = ? AND item_id = ?",
            [finalReceiptId, item.item_id]
          );
          if (recItem && recItem[0]) {
            const avail = Number(recItem[0].qty_received) - Number(recItem[0].qty_utilized);
            if (Number(item.qty_utilized) > avail) {
              await conn.rollback();
              conn.release();
              return res.status(400).json({
                message: `Utilized quantity (${item.qty_utilized}) exceeds available received quantity (${avail}) for item ID ${item.item_id}`
              });
            }
          }
        }
      }
    }

    const [result] = await conn.execute(
      `INSERT INTO prod_material_utilizations 
        (company_id, branch_id, utilization_no, plan_id, job_card_id, requisition_id, receipt_id, warehouse_id, utilization_date, utilized_by, remarks, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
      [companyId, branchId, utilization_no, finalPlanId, finalJobCardId, finalReqId, finalReceiptId, finalWhId, utilization_date, userId, remarks || '']
    );
    const utilization_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        const itemId = Number(item.item_id);
        const qtyNum = Number(item.qty_utilized || item.qty || 0);
        const uomVal = item.uom && String(item.uom).trim() !== '' ? String(item.uom).trim() : 'PCS';
        const batchVal = item.batch_no && String(item.batch_no).trim() !== '' ? String(item.batch_no).trim() : null;

        await conn.execute(
          `INSERT INTO prod_material_utilization_items 
            (utilization_id, item_id, qty_required, qty_received, qty_utilized, uom, batch_no) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [utilization_id, itemId, item.qty_required || 0, item.qty_received || 0, qtyNum, uomVal, batchVal]
        );

        if (finalReceiptId) {
          await conn.execute(
            "UPDATE prod_material_receipt_items SET qty_utilized = qty_utilized + ? WHERE receipt_id = ? AND item_id = ?",
            [qtyNum, finalReceiptId, itemId]
          );
        }

        // Deduct raw material stock balance from selected warehouse
        if (finalWhId && itemId && qtyNum > 0) {
          const [existingBal] = await conn.execute(
            `SELECT id, qty FROM inv_stock_balances 
             WHERE company_id = ? AND warehouse_id = ? AND item_id = ?
             LIMIT 1`,
            [companyId, finalWhId, itemId]
          );

          if (existingBal && existingBal.length > 0) {
            await conn.execute(
              `UPDATE inv_stock_balances 
               SET qty = GREATEST(0, qty - ?), updated_at = NOW()
               WHERE id = ?`,
              [qtyNum, existingBal[0].id]
            );
          }

          // Record stock ledger transaction
          await conn.execute(
            `INSERT INTO inv_stock_ledger 
              (company_id, branch_id, warehouse_id, item_id, transaction_type, transaction_date, qty_change, batch_no, source_ref, created_by)
             VALUES (?, ?, ?, ?, 'MATERIAL_UTILIZATION', ?, ?, ?, ?, ?)`,
            [companyId, branchId, finalWhId, itemId, utilization_date, -qtyNum, batchVal, utilization_no, userId]
          );
        }
      }
    }

    // Auto-transition Daily Plan and Job Card status to IN_PROGRESS
    if (finalPlanId) {
      await conn.execute(
        "UPDATE prod_daily_plans SET status = 'IN_PROGRESS' WHERE id = ? AND status != 'COMPLETED'",
        [finalPlanId]
      ).catch(() => {});
    }
    if (finalJobCardId) {
      await conn.execute(
        "UPDATE prod_job_cards SET status = 'IN_PROGRESS' WHERE id = ? AND status != 'COMPLETED'",
        [finalJobCardId]
      ).catch(() => {});
    }

    await conn.commit();
    res.json({ id: utilization_id, utilization_no, message: "Material utilization recorded successfully" });
  } catch (error) {
    await conn.rollback();
    console.error("Error in createMaterialUtilization:", error);
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== STOCK JOURNALS =====

export const listStockJournals = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const { journal_type, search, warehouse_id } = req.query;

    let sql = `
      SELECT 
        sj.*, 
        dp.plan_no,
        COALESCE(sw.warehouse_name, isw.warehouse_name) as source_warehouse_name,
        COALESCE(dw.warehouse_name, idw.warehouse_name) as destination_warehouse_name,
        u.username as created_by_name,
        (SELECT COUNT(*) FROM prod_stock_journal_items WHERE journal_id = sj.id) as item_count
      FROM prod_stock_journals sj
      LEFT JOIN prod_daily_plans dp ON sj.plan_id = dp.id
      LEFT JOIN prod_warehouses sw ON sj.source_warehouse_id = sw.id
      LEFT JOIN inv_warehouses isw ON sj.source_warehouse_id = isw.id
      LEFT JOIN prod_warehouses dw ON sj.destination_warehouse_id = dw.id
      LEFT JOIN inv_warehouses idw ON sj.destination_warehouse_id = idw.id
      LEFT JOIN adm_users u ON sj.created_by = u.id
      WHERE (sj.company_id = :companyId OR sj.company_id IS NULL)
    `;
    const params = { companyId };

    if (journal_type && journal_type !== 'ALL') {
      sql += " AND sj.journal_type = :journal_type";
      params.journal_type = journal_type;
    }

    if (warehouse_id && warehouse_id !== 'ALL') {
      sql += " AND (sj.source_warehouse_id = :warehouse_id OR sj.destination_warehouse_id = :warehouse_id)";
      params.warehouse_id = warehouse_id;
    }

    if (search) {
      sql += " AND (LOWER(sj.journal_no) LIKE :searchLike OR LOWER(COALESCE(sj.remarks, '')) LIKE :searchLike OR LOWER(COALESCE(dp.plan_no, '')) LIKE :searchLike)";
      params.searchLike = `%${String(search).toLowerCase()}%`;
    }

    sql += " ORDER BY sj.journal_date DESC, sj.id DESC";

    const items = await query(sql, params);
    res.json({ items: items || [] });
  } catch (error) {
    console.error("Error in listStockJournals:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getNextProductionStockJournalNo = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const rows = await query(
      `SELECT journal_no FROM prod_stock_journals 
       WHERE (company_id = :companyId OR company_id IS NULL) AND journal_no LIKE 'PSJ-%'
       ORDER BY id DESC LIMIT 1`,
      { companyId }
    );
    let nextNum = 1;
    if (rows && rows.length > 0) {
      const match = String(rows[0].journal_no).match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    const nextNo = `PSJ-${String(nextNum).padStart(6, '0')}`;
    res.json({ next_no: nextNo });
  } catch (err) {
    next(err);
  }
};

export const createStockJournal = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const userId = req.user?.id || 1;

    const {
      journal_type = 'MANUFACTURING',
      source_warehouse_id,
      destination_warehouse_id,
      plan_id,
      journal_date = new Date().toISOString().split('T')[0],
      remarks,
      items = []
    } = req.body;

    if (!items || items.length === 0) {
      throw new Error("Journal must contain at least one line item.");
    }

    let journal_no = req.body.journal_no;
    if (!journal_no || !journal_no.startsWith("PSJ-")) {
      const [lastRow] = await conn.execute(
        "SELECT journal_no FROM prod_stock_journals WHERE (company_id = ? OR company_id IS NULL) AND journal_no LIKE 'PSJ-%' ORDER BY id DESC LIMIT 1",
        [companyId]
      );
      let nextNum = 1;
      if (lastRow && lastRow.length > 0) {
        const match = String(lastRow[0].journal_no).match(/\d+/);
        if (match) nextNum = parseInt(match[0], 10) + 1;
      }
      journal_no = `PSJ-${String(nextNum).padStart(6, '0')}`;
    }

    const finalSrcWh = source_warehouse_id && Number(source_warehouse_id) > 0 ? Number(source_warehouse_id) : null;
    const finalDstWh = destination_warehouse_id && Number(destination_warehouse_id) > 0 ? Number(destination_warehouse_id) : null;
    const finalRemarks = remarks && String(remarks).trim() !== '' ? String(remarks).trim() : null;
    const finalPlanId = plan_id && Number(plan_id) > 0 ? Number(plan_id) : null;

    const [result] = await conn.execute(
      `INSERT INTO prod_stock_journals 
        (company_id, branch_id, journal_no, journal_type, source_warehouse_id, destination_warehouse_id, plan_id, journal_date, remarks, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?)`,
      [companyId, branchId, journal_no, journal_type, finalSrcWh, finalDstWh, finalPlanId, journal_date, finalRemarks, userId]
    );
    const journal_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        const itemType = (item.type || 'CONSUMPTION').toUpperCase();
        const itemId = Number(item.item_id);
        const whId = item.warehouse_id && Number(item.warehouse_id) > 0 
          ? Number(item.warehouse_id) 
          : (itemType === 'CONSUMPTION' ? finalSrcWh : finalDstWh);
        const qtyNum = Number(item.qty || 0);
        const uomVal = item.uom && String(item.uom).trim() !== '' ? String(item.uom).trim() : 'PCS';
        const batchVal = item.batch_no && String(item.batch_no).trim() !== '' ? String(item.batch_no).trim() : null;
        const expiryVal = item.expiry_date && String(item.expiry_date).trim() !== '' ? item.expiry_date : null;

        await conn.execute(
          `INSERT INTO prod_stock_journal_items 
            (journal_id, item_id, warehouse_id, type, qty, uom, batch_no, expiry_date) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [journal_id, itemId, whId, itemType, qtyNum, uomVal, batchVal, expiryVal]
        );

        // Update Stock Balances and Ledger
        if (whId && itemId) {
          const isConsumption = itemType === 'CONSUMPTION';
          const qtyChange = isConsumption ? -qtyNum : qtyNum;
          const txType = isConsumption ? 'PROD_CONSUMPTION' : 'PROD_OUTPUT';

          const [existingBal] = await conn.execute(
            `SELECT id, qty FROM inv_stock_balances 
             WHERE (company_id = ? OR company_id IS NULL) AND warehouse_id = ? AND item_id = ?
             LIMIT 1`,
            [companyId, whId, itemId]
          );

          if (existingBal && existingBal.length > 0) {
            await conn.execute(
              `UPDATE inv_stock_balances 
               SET qty = GREATEST(0, qty + ?), updated_at = NOW()
               WHERE id = ?`,
              [qtyChange, existingBal[0].id]
            );
          } else {
            await conn.execute(
              `INSERT INTO inv_stock_balances 
                (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty, batch_no, expiry_date, entry_date, source_type, source_id, created_by)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
              [companyId, branchId, whId, itemId, Math.max(0, qtyChange), batchVal, expiryVal, journal_date, txType, journal_id, userId]
            );
          }

          // Record stock ledger transaction
          await conn.execute(
            `INSERT INTO inv_stock_ledger 
              (company_id, branch_id, warehouse_id, item_id, transaction_type, transaction_date, qty_change, batch_no, expiry_date, source_ref, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, branchId, whId, itemId, txType, journal_date, qtyChange, batchVal, expiryVal, journal_no, userId]
          );
        }
      }
    }

    await conn.commit();
    res.json({ id: journal_id, journal_no, message: `Production Stock Journal ${journal_no} posted successfully.` });
  } catch (error) {
    await conn.rollback();
    console.error("Error in createStockJournal:", error);
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== DASHBOARD STATS =====

export const getProductionDashboardAnalytics = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const branchIdsStr = req.scope?.branchIdsStr || (branchId ? String(branchId) : "");
    const { from = null, to = null } = req.query || {};

    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";
    const dateFilterWO = from && to ? "AND work_order_date BETWEEN :from AND :to" : from ? "AND work_order_date >= :from" : to ? "AND work_order_date <= :to" : "";

    // 1. Overall Work Orders & Output KPIs
    const [woSummary] = await query(
      `SELECT 
         COUNT(*) as total_orders,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
         SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_orders,
         SUM(CASE WHEN status IN ('DRAFT', 'RELEASED') THEN 1 ELSE 0 END) as pending_orders,
         SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
         COALESCE(SUM(qty_to_produce), 0) as total_planned_qty,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN qty_to_produce ELSE 0 END), 0) as total_produced_qty
       FROM prod_work_orders 
       WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} ${dateFilterWO}`,
      { companyId, branchId, branchIdsStr: String(branchIdsStr || ""), from, to },
    );

    // 2. Active BOMs
    const [bomSummary] = await query(
      `SELECT COUNT(*) as total_boms, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_boms 
       FROM prod_boms WHERE (company_id = :companyId OR company_id IS NULL)`,
      { companyId },
    );

    // 3. Machines & Plant Capacity
    let machineSummary = { total_machines: 0, active_machines: 0, maintenance_machines: 0, avg_utilization: 0 };
    try {
      const [mRow] = await query(
        `SELECT 
           COUNT(*) as total_machines,
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_machines,
           SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as maintenance_machines
         FROM prod_machines 
         WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}`,
        { companyId, branchId, branchIdsStr: String(branchIdsStr || "") },
      );
      if (mRow) {
        const totM = Number(mRow.total_machines || 0);
        const actM = Number(mRow.active_machines || 0);
        machineSummary = {
          total_machines: totM,
          active_machines: actM,
          maintenance_machines: Number(mRow.maintenance_machines || 0),
          avg_utilization: totM > 0 ? Math.round((actM / totM) * 100) : 0,
        };
      }
    } catch {}

    // 4. Job Cards, Completed Output & Scrap
    let scrapRate = 0;
    let jobCardsSummary = { total: 0, completed: 0, in_progress: 0, scrap_qty: 0, yield_percent: 100 };
    try {
      const [jcRow] = await query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
           COALESCE(SUM(planned_qty), 0) as planned_qty,
           COALESCE(SUM(good_qty), SUM(actual_qty), 0) as completed_qty,
           COALESCE(SUM(scrap_qty), SUM(rejected_qty), 0) as scrap_qty
         FROM prod_job_cards 
         WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}`,
        { companyId, branchId, branchIdsStr: String(branchIdsStr || "") },
      );
      if (jcRow) {
        const planned = Number(jcRow.planned_qty || 0);
        const comp = Number(jcRow.completed_qty || 0);
        const scrap = Number(jcRow.scrap_qty || 0);
        const totalOutput = comp + scrap;
        scrapRate = totalOutput > 0 ? Math.round((scrap / totalOutput) * 1000) / 10 : 0;
        const yieldPercent = totalOutput > 0 ? Math.min(100, Math.round((comp / totalOutput) * 1000) / 10) : (planned > 0 ? Math.min(100, Math.round((comp / planned) * 1000) / 10) : 100);
        jobCardsSummary = {
          total: Number(jcRow.total || 0),
          completed: Number(jcRow.completed || 0),
          in_progress: Number(jcRow.in_progress || 0),
          scrap_qty: scrap,
          yield_percent: yieldPercent,
        };
      }
    } catch {}

    // 5. Quality Inspections (QC)
    let qcSummary = { total_inspections: 0, passed: 0, failed: 0, rework: 0, pass_rate: 100 };
    try {
      const [qcRow] = await query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN quality_status = 'PASSED' THEN 1 ELSE 0 END) as passed,
           SUM(CASE WHEN quality_status = 'FAILED' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN quality_status = 'REWORK' THEN 1 ELSE 0 END) as rework,
           COALESCE(SUM(rejected_qty), 0) as total_defects,
           COALESCE(SUM(inspected_qty), 0) as total_inspected
         FROM prod_qc_inspections 
         WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}`,
        { companyId, branchId, branchIdsStr: String(branchIdsStr || "") },
      );
      if (qcRow) {
        const totalQc = Number(qcRow.total || 0);
        const passedQc = Number(qcRow.passed || 0);
        qcSummary = {
          total_inspections: totalQc,
          passed: passedQc,
          failed: Number(qcRow.failed || 0),
          rework: Number(qcRow.rework || 0),
          pass_rate: totalQc > 0 ? Math.round((passedQc / totalQc) * 1000) / 10 : 100,
        };
      }
    } catch {}

    // 6. Monthly Output Trend (Last 6 Months)
    const monthlyTrend = await query(
      `SELECT 
         DATE_FORMAT(work_order_date, '%Y-%m') as month_key,
         DATE_FORMAT(work_order_date, '%b %Y') as month_label,
         COUNT(*) as order_count,
         COALESCE(SUM(qty_to_produce), 0) as planned_volume,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN qty_to_produce ELSE 0 END), 0) as produced_volume
       FROM prod_work_orders
       WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}
         AND work_order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(work_order_date, '%Y-%m'), DATE_FORMAT(work_order_date, '%b %Y')
       ORDER BY month_key ASC`,
      { companyId, branchId, branchIdsStr: String(branchIdsStr || "") },
    );

    // 7. Work Orders Status Distribution
    const statusDistribution = [
      { status: "Completed", count: Number(woSummary?.completed_orders || 0), color: "#10b981" },
      { status: "In Progress", count: Number(woSummary?.in_progress_orders || 0), color: "#3b82f6" },
      { status: "Draft / Released", count: Number(woSummary?.pending_orders || 0), color: "#f59e0b" },
      { status: "Cancelled", count: Number(woSummary?.cancelled_orders || 0), color: "#ef4444" },
    ];

    // 8. Recent Work Orders with Progress
    const recentWorkOrders = await query(
      `SELECT 
         wo.id,
         wo.work_order_no,
         wo.work_order_date,
         wo.qty_to_produce,
         wo.status,
         wo.bom_id,
         b.bom_name,
         i.item_name,
         i.item_code,
         w.warehouse_name,
         CASE WHEN wo.status = 'COMPLETED' THEN wo.qty_to_produce WHEN wo.status = 'IN_PROGRESS' THEN ROUND(wo.qty_to_produce * 0.5, 2) ELSE 0 END as completed_qty
       FROM prod_work_orders wo
       LEFT JOIN prod_boms b ON wo.bom_id = b.id
       LEFT JOIN inv_items i ON b.item_id = i.id
       LEFT JOIN inv_warehouses w ON wo.warehouse_id = w.id
       WHERE (wo.company_id = :companyId OR wo.company_id IS NULL) AND (:branchId IS NULL OR wo.branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(wo.branch_id, :branchIdsStr) OR wo.branch_id IS NULL)
       ORDER BY wo.work_order_date DESC, wo.id DESC
       LIMIT 10`,
      { companyId, branchId, branchIdsStr: String(branchIdsStr || "") },
    );

    // 9. Top Produced Products
    const topProducts = await query(
      `SELECT 
         COALESCE(i.item_name, b.bom_name, 'Manufactured Item') as item_name,
         COALESCE(i.item_code, CONCAT('BOM-', b.id)) as item_code,
         COUNT(wo.id) as total_runs,
         COALESCE(SUM(wo.qty_to_produce), 0) as total_quantity
       FROM prod_work_orders wo
       LEFT JOIN prod_boms b ON wo.bom_id = b.id
       LEFT JOIN inv_items i ON b.item_id = i.id
       WHERE (wo.company_id = :companyId OR wo.company_id IS NULL) AND (:branchId IS NULL OR wo.branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(wo.branch_id, :branchIdsStr) OR wo.branch_id IS NULL)
       GROUP BY b.id, i.id, i.item_name, b.bom_name, i.item_code
       ORDER BY total_quantity DESC
       LIMIT 5`,
      { companyId, branchId, branchIdsStr: String(branchIdsStr || "") },
    );

    res.json({
      kpis: {
        totalOrders: Number(woSummary?.total_orders || 0),
        completedOrders: Number(woSummary?.completed_orders || 0),
        inProgressOrders: Number(woSummary?.in_progress_orders || 0),
        pendingOrders: Number(woSummary?.pending_orders || 0),
        totalPlannedQty: Number(woSummary?.total_planned_qty || 0),
        totalProducedQty: Number(woSummary?.total_produced_qty || 0),
        activeBoms: Number(bomSummary?.active_boms || bomSummary?.total_boms || 0),
        totalBoms: Number(bomSummary?.total_boms || 0),
        yieldPercent: jobCardsSummary.yield_percent,
        scrapRate: scrapRate,
        qualityPassRate: qcSummary.pass_rate,
      },
      machines: machineSummary,
      qc: qcSummary,
      monthlyTrend: monthlyTrend || [],
      statusDistribution,
      recentWorkOrders: (recentWorkOrders || []).map((wo) => {
        const planned = Number(wo.qty_to_produce || 0);
        const comp = Number(wo.completed_qty || 0);
        const progress = planned > 0 ? Math.min(100, Math.round((comp / planned) * 100)) : (wo.status === "COMPLETED" ? 100 : 0);
        return {
          ...wo,
          progress,
        };
      }),
      topProducts: topProducts || [],
    });
  } catch (error) {
    next(error);
  }
};

export const getProductionStats = async (req, res) => {
  const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
  const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
  const branchIdsStr = req.scope?.branchIdsStr || (branchId ? String(branchId) : "");
  const whereBranch = "(:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";

  const safeCount = async (sql, params) => {
    try {
      const [row] = await query(sql, params);
      return row ? Number(row.count) : 0;
    } catch {
      return 0;
    }
  };

  const boms = await safeCount(
    `SELECT COUNT(*) as count FROM prod_boms WHERE (company_id = :companyId OR company_id IS NULL)`,
    { companyId },
  );
  const activeOrders = await safeCount(
    `SELECT COUNT(*) as count FROM prod_work_orders WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status != 'COMPLETED'`,
    { companyId, branchId, branchIdsStr },
  );
  const dailyPlans = await safeCount(
    `SELECT COUNT(*) as count FROM prod_daily_plans WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}`,
    { companyId, branchId, branchIdsStr },
  );
  const jobCards = await safeCount(
    `SELECT COUNT(*) as count FROM prod_job_cards WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch}`,
    { companyId, branchId, branchIdsStr },
  );
  const pendingRequisitions = await safeCount(
    `SELECT COUNT(*) as count FROM prod_material_requisitions WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status = 'PENDING'`,
    { companyId, branchId, branchIdsStr },
  );

  res.json({
    boms,
    activeOrders,
    dailyPlans,
    jobCards,
    pendingRequisitions,
  });
};

// ===== MATERIAL REQUISITIONS =====

export const listMaterialRequisitions = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const items = await query(
      `SELECT mr.*, dp.plan_no, wo.work_order_no, w.warehouse_name, u.full_name as requested_by_name, d.department_name
       FROM prod_material_requisitions mr
       LEFT JOIN prod_daily_plans dp ON mr.plan_id = dp.id
       LEFT JOIN prod_work_orders wo ON mr.work_order_id = wo.id
       LEFT JOIN inv_warehouses w ON mr.warehouse_id = w.id
       LEFT JOIN adm_users u ON mr.requested_by = u.id
       LEFT JOIN prod_departments d ON mr.department_id = d.id
       WHERE (mr.company_id = :company_id OR mr.company_id IS NULL)
         AND (:branch_id IS NULL OR mr.branch_id = :branch_id OR mr.branch_id IS NULL)
       ORDER BY mr.requisition_date DESC, mr.id DESC`,
      { company_id, branch_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMaterialRequisitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await query("SELECT * FROM prod_material_requisitions WHERE id = :id", { id });
    if (!requisition?.[0]) return res.status(404).json({ message: "Requisition not found" });

    const items = await query(
      `SELECT mri.*, i.item_name, i.item_code 
       FROM prod_material_requisition_items mri
       JOIN inv_items i ON mri.item_id = i.id
       WHERE mri.requisition_id = :id`,
      { id }
    );

    res.json({ ...requisition[0], items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMaterialRequisition = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || null;
    const user_id = req.user?.id || req.user?.sub || 1;
    const { work_order_id, plan_id, warehouse_id, department_id, priority, requisition_date, remarks, requested_by, status, items } = req.body;

    const [maxRes] = await conn.execute(
      "SELECT MAX(id) as max_id FROM prod_material_requisitions WHERE company_id = ?",
      [company_id]
    );
    const nextSeq = (Number(maxRes[0]?.max_id || 0) + 1).toString().padStart(6, '0');
    const requisition_no = `PDMR-${nextSeq}`;
    const finalStatus = status || 'PENDING';

    const reqUser = (requested_by && !isNaN(Number(requested_by))) ? Number(requested_by) : user_id;

    const [result] = await conn.execute(
      "INSERT INTO prod_material_requisitions (company_id, branch_id, requisition_no, work_order_id, plan_id, warehouse_id, department_id, priority, requisition_date, requested_by, remarks, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        company_id,
        branch_id,
        requisition_no,
        work_order_id || null,
        plan_id || null,
        warehouse_id || null,
        department_id || null,
        priority || 'MEDIUM',
        requisition_date || new Date().toISOString().split('T')[0],
        reqUser,
        remarks || '',
        user_id,
        finalStatus
      ]
    );
    const requisition_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          "INSERT INTO prod_material_requisition_items (requisition_id, item_id, qty_requested, uom, batch_no) VALUES (?, ?, ?, ?, ?)",
          [requisition_id, item.item_id, item.qty_requested || 0, item.uom || '', item.batch_no || null]
        );
      }
    }

    await conn.commit();
    res.json({ id: requisition_id, requisition_no, message: "Material requisition created successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const updateMaterialRequisitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await query("UPDATE prod_material_requisitions SET status = :status WHERE id = :id", { id, status });
    res.json({ message: "Requisition status updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== PRODUCTION TRANSFERS =====

export const listProductionTransfers = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const items = await query(
      `SELECT pt.*, dp.plan_no, w.name as target_warehouse_name
       FROM prod_transfers pt
       LEFT JOIN prod_daily_plans dp ON pt.plan_id = dp.id
       LEFT JOIN inv_warehouses w ON pt.target_warehouse_id = w.id
       WHERE (pt.company_id = :company_id OR pt.company_id IS NULL)
       ORDER BY pt.transfer_date DESC, pt.created_at DESC`,
      { company_id, branch_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getNextFgTransferNo = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const rows = await query(
      `SELECT transfer_no FROM prod_transfers 
       WHERE (company_id = :company_id OR company_id IS NULL) 
         AND transfer_no LIKE 'FGT-%' 
       ORDER BY id DESC LIMIT 100`,
      { company_id }
    );
    let maxSeq = 0;
    (rows || []).forEach(r => {
      const match = String(r.transfer_no || '').match(/^FGT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    const nextSeq = maxSeq + 1;
    const nextNo = `FGT-${String(nextSeq).padStart(6, '0')}`;
    res.json({ nextNo });
  } catch (error) {
    res.json({ nextNo: "FGT-000001" });
  }
};

export const getEligibleExecutionsForFgTransfer = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      `SELECT jc.id as job_card_id, 
              jc.job_card_no, 
              COALESCE(jc.batch_no, qci.batch_no) as batch_no, 
              COALESCE(jc.mfg_date, qci.mfg_date) as mfg_date, 
              COALESCE(jc.expiry_date, qci.expiry_date) as expiry_date, 
              COALESCE(qci.good_qty, jc.good_qty, jc.actual_qty, 1) as good_qty,
              jc.item_id,
              COALESCE(i.item_name, 'Produced Product') as item_name,
              COALESCE(i.item_code, '') as item_code,
              COALESCE(i.uom, 'Pcs') as uom,
              qci.id as qc_id,
              CONCAT('QC-', LPAD(qci.id, 5, '0')) as qc_number,
              qci.inspection_date,
              qci.warehouse_id as fg_warehouse_id,
              pw.warehouse_name as fg_warehouse_name,
              qci.quality_status,
              qci.quality_score
       FROM prod_job_cards jc
       JOIN prod_qc_inspections qci ON qci.job_card_id = jc.id
       LEFT JOIN inv_items i ON jc.item_id = i.id
       LEFT JOIN prod_warehouses pw ON qci.warehouse_id = pw.id
       WHERE (jc.company_id = :company_id OR jc.company_id IS NULL)
         AND jc.status = 'COMPLETED'
         AND UPPER(qci.quality_status) = 'PASSED'
       ORDER BY qci.created_at DESC, jc.created_at DESC`,
      { company_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const listFinishedGoodsTransfers = async (req, res) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      `SELECT pt.*, 
              COALESCE(pw1.warehouse_name, w1.warehouse_name) as from_warehouse_name,
              COALESCE(w2.warehouse_name, pw2.warehouse_name) as to_warehouse_name,
              COALESCE(w2.warehouse_name, pw2.warehouse_name) as target_warehouse_name,
              COALESCE(u.full_name, u.username) as created_by_user
       FROM prod_transfers pt
       LEFT JOIN prod_warehouses pw1 ON pt.from_warehouse_id = pw1.id
       LEFT JOIN inv_warehouses w1 ON pt.from_warehouse_id = w1.id
       LEFT JOIN inv_warehouses w2 ON pt.target_warehouse_id = w2.id
       LEFT JOIN prod_warehouses pw2 ON pt.target_warehouse_id = pw2.id
       LEFT JOIN adm_users u ON pt.created_by = u.id
       WHERE (pt.company_id = :company_id OR pt.company_id IS NULL)
       ORDER BY pt.transfer_date DESC, pt.created_at DESC`,
      { company_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getFinishedGoodsTransferById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const rows = await query(
      `SELECT pt.*, 
              COALESCE(pw1.warehouse_name, w1.warehouse_name) as from_warehouse_name,
              COALESCE(w2.warehouse_name, pw2.warehouse_name) as to_warehouse_name,
              COALESCE(w2.warehouse_name, pw2.warehouse_name) as target_warehouse_name,
              COALESCE(u.full_name, u.username) as created_by_user
       FROM prod_transfers pt
       LEFT JOIN prod_warehouses pw1 ON pt.from_warehouse_id = pw1.id
       LEFT JOIN inv_warehouses w1 ON pt.from_warehouse_id = w1.id
       LEFT JOIN inv_warehouses w2 ON pt.target_warehouse_id = w2.id
       LEFT JOIN prod_warehouses pw2 ON pt.target_warehouse_id = pw2.id
       LEFT JOIN adm_users u ON pt.created_by = u.id
       WHERE pt.id = :id AND (pt.company_id = :company_id OR pt.company_id IS NULL)`,
      { id, company_id }
    );
    if (!rows?.[0]) return res.status(404).json({ message: "Transfer not found" });
    const transfer = rows[0];
    const items = await query(
      `SELECT pti.*, COALESCE(i.item_name, 'Transferred Item') as item_name, COALESCE(i.item_code, '') as item_code
       FROM prod_transfer_items pti
       LEFT JOIN inv_items i ON pti.item_id = i.id
       WHERE pti.transfer_id = :id`,
      { id }
    );
    transfer.items = items || [];
    res.json(transfer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createFinishedGoodsTransfer = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const user_id = req.user?.id || 1;
    const { 
      transfer_no, 
      transferNo, 
      from_warehouse_id, 
      fromWarehouseId,
      to_warehouse_id, 
      toWarehouseId, 
      transfer_date, 
      transferDate, 
      job_card_id,
      jobCardId,
      job_card_no,
      jobCardNo,
      qc_id,
      qcId,
      qc_number,
      qcNumber,
      driver_name,
      driverName,
      vehicle_no,
      vehicleNo,
      remarks, 
      items,
      auto_accept,
      autoAccept
    } = req.body;

    const isAutoAccept = Boolean(auto_accept || autoAccept);

    let finalNo = transfer_no || transferNo;
    if (!finalNo || !finalNo.startsWith('FGT-') || finalNo.length < 10) {
      const [rows] = await conn.execute(
        `SELECT transfer_no FROM prod_transfers 
         WHERE (company_id = ? OR company_id IS NULL) 
           AND transfer_no LIKE 'FGT-%' 
         ORDER BY id DESC LIMIT 100`,
        [company_id]
      );
      let maxSeq = 0;
      (rows || []).forEach(r => {
        const match = String(r.transfer_no || '').match(/^FGT-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      finalNo = `FGT-${String(maxSeq + 1).padStart(6, '0')}`;
    }

    const finalFromWh = from_warehouse_id || fromWarehouseId || null;
    const finalToWh = to_warehouse_id || toWarehouseId || null;
    const finalTrDate = transfer_date || transferDate || new Date().toISOString().split('T')[0];
    const finalJcId = job_card_id || jobCardId || null;
    const finalJcNo = job_card_no || jobCardNo || null;
    const finalQcId = qc_id || qcId || null;
    const finalQcNo = qc_number || qcNumber || null;
    const finalDriver = driver_name || driverName || null;
    const finalVehicle = vehicle_no || vehicleNo || null;

    // Get target warehouse branch
    let targetBranchId = branch_id;
    if (finalToWh) {
      const [whRows] = await conn.execute("SELECT branch_id FROM inv_warehouses WHERE id = ? LIMIT 1", [finalToWh]);
      if (whRows?.[0]?.branch_id) {
        targetBranchId = whRows[0].branch_id;
      }
    }

    const transferStatus = isAutoAccept ? 'RECEIVED' : 'IN_TRANSIT';

    // 1. Insert into prod_transfers
    const [result] = await conn.execute(
      `INSERT INTO prod_transfers 
        (company_id, branch_id, transfer_no, from_warehouse_id, target_warehouse_id, job_card_id, job_card_no, qc_id, qc_number, transfer_date, driver_name, vehicle_no, remarks, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [company_id, branch_id, finalNo, finalFromWh, finalToWh, finalJcId, finalJcNo, finalQcId, finalQcNo, finalTrDate, finalDriver, finalVehicle, remarks || null, transferStatus, user_id]
    );
    const transfer_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        const bNo = item.batch_no || item.batchNumber || null;
        const mfg = (item.mfg_date || item.mfgDate) ? new Date(item.mfg_date || item.mfgDate).toISOString().split('T')[0] : null;
        const exp = (item.expiry_date || item.expiryDate) ? new Date(item.expiry_date || item.expiryDate).toISOString().split('T')[0] : null;
        await conn.execute(
          "INSERT INTO prod_transfer_items (transfer_id, item_id, qty, uom, batch_no, mfg_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [transfer_id, item.item_id || item.itemId || 1, item.qty || 1, item.uom || 'Pcs', bNo, mfg, exp]
        );
      }
    }

    // 2. Insert into inv_stock_transfers for Transfer Acceptance integration
    const [invTrResult] = await conn.execute(
      `INSERT INTO inv_stock_transfers 
        (company_id, branch_id, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, transfer_no, transfer_date, transfer_type, driver_name, vehicle_no, remarks, status, received_date, received_by, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FINISHED_GOODS', ?, ?, ?, ?, ?, ?, ?)`,
      [
        company_id,
        branch_id,
        branch_id,
        targetBranchId,
        finalFromWh,
        finalToWh,
        finalNo,
        finalTrDate,
        finalDriver,
        finalVehicle,
        remarks || null,
        transferStatus,
        isAutoAccept ? new Date() : null,
        isAutoAccept ? user_id : null,
        user_id
      ]
    );
    const invTransferId = invTrResult.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        const bNo = item.batch_no || item.batchNumber || null;
        const qtyNum = Number(item.qty || 1);
        const itemId = Number(item.item_id || item.itemId || 1);
        const uomCode = item.uom || 'PCS';
        const exp = (item.expiry_date || item.expiryDate) ? new Date(item.expiry_date || item.expiryDate).toISOString().split('T')[0] : null;

        await conn.execute(
          `INSERT INTO inv_stock_transfer_details 
            (transfer_id, item_id, qty, uom, batch_number, batch_no, remarks, received_qty, accepted_qty, rejected_qty, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invTransferId,
            itemId,
            qtyNum,
            uomCode,
            bNo,
            bNo,
            remarks || null,
            isAutoAccept ? qtyNum : 0,
            isAutoAccept ? qtyNum : 0,
            0,
            user_id
          ]
        );

        // 3. If auto-accepted, directly update destination warehouse stock balances and ledger
        if (isAutoAccept && finalToWh) {
          const [existingBal] = await conn.execute(
            `SELECT id, qty FROM inv_stock_balances 
             WHERE company_id = ? AND warehouse_id = ? AND item_id = ?
             LIMIT 1`,
            [company_id, finalToWh, itemId]
          );

          if (existingBal && existingBal.length > 0) {
            await conn.execute(
              `UPDATE inv_stock_balances 
               SET qty = qty + ?,
                   batch_no = COALESCE(?, batch_no),
                   expiry_date = COALESCE(?, expiry_date),
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [qtyNum, bNo, exp, existingBal[0].id]
            );
          } else {
            await conn.execute(
              `INSERT INTO inv_stock_balances 
                (company_id, branch_id, warehouse_id, item_id, qty, batch_no, expiry_date, entry_date, source_type, source_id, created_at, created_by)
               VALUES 
                (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, 'PRODUCTION_TRANSFER', ?, CURRENT_TIMESTAMP, ?)`,
              [company_id, targetBranchId, finalToWh, itemId, qtyNum, bNo, exp, transfer_id, user_id]
            );
          }

          // Record in inv_stock_ledger for audit
          await conn.execute(
            `INSERT INTO inv_stock_ledger 
              (company_id, branch_id, warehouse_id, item_id, transaction_type, transaction_date, qty_change, batch_no, expiry_date, source_ref, created_by)
             VALUES 
              (?, ?, ?, ?, 'TRANSFER_IN', ?, ?, ?, ?, ?, ?)`,
            [company_id, targetBranchId, finalToWh, itemId, finalTrDate, qtyNum, bNo, exp, finalNo, user_id]
          );
        }
      }
    }

    await conn.commit();
    res.status(201).json({ 
      id: transfer_id, 
      transfer_no: finalNo, 
      status: transferStatus,
      auto_accepted: isAutoAccept,
      message: isAutoAccept 
        ? "Finished Goods Transfer created, auto-accepted, and inventory stock updated" 
        : "Finished Goods Transfer dispatched to Transfer Acceptance"
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

export const deleteFinishedGoodsTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    await query("DELETE FROM prod_transfer_items WHERE transfer_id = :id", { id });
    await query("DELETE FROM prod_transfers WHERE id = :id AND (company_id = :company_id OR company_id IS NULL)", { id, company_id });
    res.json({ message: "Transfer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProductionTransfer = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { company_id, branch_id, id: user_id } = req.user;
    const { plan_id, target_warehouse_id, transfer_date, remarks, items } = req.body;

    const transfer_no = `TR-${Date.now().toString().slice(-6)}`;

    const [result] = await conn.execute(
      "INSERT INTO prod_transfers (company_id, branch_id, transfer_no, plan_id, target_warehouse_id, transfer_date, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [company_id, branch_id, transfer_no, plan_id || null, target_warehouse_id, transfer_date, remarks, user_id]
    );
    const transfer_id = result.insertId;

    if (Array.isArray(items)) {
      for (const item of items) {
        const tQty = Number(item.qty || 0);
        await conn.execute(
          "INSERT INTO prod_transfer_items (transfer_id, item_id, qty, uom) VALUES (?, ?, ?, ?)",
          [transfer_id, item.item_id, tQty, item.uom || 'PCS']
        );

        if (target_warehouse_id && tQty > 0) {
          const [existingTargetBal] = await conn.execute(
            "SELECT id FROM inv_stock_balances WHERE company_id = ? AND warehouse_id = ? AND item_id = ? LIMIT 1",
            [company_id, target_warehouse_id, item.item_id]
          );

          if (existingTargetBal && existingTargetBal.length > 0) {
            await conn.execute(
              "UPDATE inv_stock_balances SET qty = qty + ?, updated_at = NOW() WHERE id = ?",
              [tQty, existingTargetBal[0].id]
            );
          } else {
            await conn.execute(
              `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, entry_date)
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [company_id, branch_id, target_warehouse_id, item.item_id, tQty]
            );
          }

          await conn.execute(
            `INSERT INTO inv_stock_ledger (company_id, branch_id, warehouse_id, item_id, transaction_type, qty_change, source_ref, created_by)
             VALUES (?, ?, ?, ?, 'PRODUCTION_TRANSFER', ?, ?, ?)`,
            [company_id, branch_id, target_warehouse_id, item.item_id, tQty, transfer_no, user_id]
          );
        }
      }
    }

    await conn.commit();
    res.json({ id: transfer_id, transfer_no, message: "Production transfer logged" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ===== OVERHEAD MASTERS SETUP =====

export const listOverheads = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT * FROM prod_overheads WHERE company_id = :companyId ORDER BY created_at DESC`,
      { companyId }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createOverhead = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    let { overhead_name, code, allocation_basis, default_cost_rate, description, is_active } = req.body || {};

    if (!overhead_name) throw httpError(400, "VALIDATION_ERROR", "Overhead name is required");

    if (!code || !code.trim()) {
      const [countRow] = await query(
        `SELECT COUNT(*) as cnt FROM prod_overheads WHERE company_id = :companyId`,
        { companyId }
      );
      const nextSeq = Number(countRow?.cnt || 0) + 1;
      code = `OVH-${String(nextSeq).padStart(6, '0')}`;
    }

    const result = await query(
      `INSERT INTO prod_overheads (company_id, overhead_name, code, allocation_basis, default_cost_rate, description, is_active)
       VALUES (:companyId, :overhead_name, :code, :allocation_basis, :default_cost_rate, :description, :is_active)`,
      {
        companyId,
        overhead_name,
        code,
        allocation_basis: allocation_basis || 'per Hour',
        default_cost_rate: default_cost_rate || 0,
        description: description || null,
        is_active: is_active ?? 1
      }
    );
    res.status(201).json({ id: result.insertId, code });
  } catch (err) {
    next(err);
  }
};

export const updateOverhead = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    const { overhead_name, code, allocation_basis, default_cost_rate, description, is_active } = req.body || {};

    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await query(
      `UPDATE prod_overheads
       SET overhead_name = :overhead_name, code = :code, allocation_basis = :allocation_basis, default_cost_rate = :default_cost_rate, description = :description, is_active = :is_active
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        overhead_name,
        code: code || null,
        allocation_basis: allocation_basis || 'per Hour',
        default_cost_rate: default_cost_rate || 0,
        description: description || null,
        is_active: is_active ? 1 : 0
      }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteOverhead = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await query(
      `DELETE FROM prod_overheads WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ===== REPORTS =====

export const getEfficiencyReport = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { start_date, end_date } = req.query;

    const planRows = await query(
      `SELECT 
        dpi.id,
        dp.plan_no as plan_no,
        dp.plan_date,
        i.item_code,
        i.item_name,
        COALESCE(i.uom, 'PCS') AS uom,
        SUM(dpi.qty_to_produce) as planned_qty,
        COALESCE(SUM(out_tbl.actual_qty), 0) as actual_qty,
        COALESCE(SUM(out_tbl.rejected_qty), 0) as rejected_qty
      FROM prod_daily_plans dp
      JOIN prod_daily_plan_items dpi ON dpi.plan_id = dp.id
      JOIN inv_items i ON dpi.item_id = i.id
      LEFT JOIN (
        SELECT plan_id, item_id, SUM(good_qty) as actual_qty, SUM(rejected_qty) as rejected_qty
        FROM prod_job_cards
        WHERE plan_id IS NOT NULL
        GROUP BY plan_id, item_id
      ) out_tbl ON out_tbl.plan_id = dp.id AND out_tbl.item_id = dpi.item_id
      WHERE (dp.company_id = :companyId OR dp.company_id IS NULL)
      ${start_date && end_date ? 'AND dp.plan_date BETWEEN :start_date AND :end_date' : ''}
      GROUP BY dpi.id, dp.plan_no, dp.plan_date, i.item_code, i.item_name, i.uom`,
      { companyId, start_date, end_date }
    ).catch(() => []);

    const woRows = await query(
      `SELECT 
        wo.id,
        wo.wo_number as plan_no,
        wo.created_at as plan_date,
        i.item_code,
        i.item_name,
        COALESCE(i.uom, 'PCS') AS uom,
        wo.qty_to_produce as planned_qty,
        COALESCE(wo.qty_produced, 0) as actual_qty,
        0 as rejected_qty
      FROM prod_work_orders wo
      JOIN inv_items i ON wo.item_id = i.id
      WHERE (wo.company_id = :companyId OR wo.company_id IS NULL)
      ${start_date && end_date ? 'AND wo.created_at BETWEEN :start_date AND :end_date' : ''}`,
      { companyId, start_date, end_date }
    ).catch(() => []);

    const combined = [...(planRows || []), ...(woRows || [])];

    const items = combined.map(r => {
      const planned = Number(r.planned_qty || 0);
      const actual = Number(r.actual_qty || 0);
      const rejected = Number(r.rejected_qty || 0);
      const eff = planned > 0 ? Math.round((actual / planned) * 100) : 0;
      const scrapPct = actual > 0 ? Math.round((rejected / (actual + rejected)) * 100) : 0;
      return {
        ...r,
        planned_qty: planned,
        actual_qty: actual,
        rejected_qty: rejected,
        efficiency_pct: eff,
        scrap_pct: scrapPct,
        status: eff >= 100 ? 'Target Achieved' : eff >= 75 ? 'In Progress' : 'Lagging'
      };
    });

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMaterialVarianceReport = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { start_date, end_date } = req.query;

    const sql = `
      SELECT 
        i.id as item_id,
        i.item_code,
        i.item_name,
        COALESCE(i.uom, 'PCS') AS uom,
        COALESCE(rec.total_std, 0) AS total_received_std,
        COALESCE(uti.total_act, 0) AS total_utilized_actual
      FROM inv_items i
      LEFT JOIN (
        SELECT mri.item_id, SUM(mri.qty_received) as total_std
        FROM prod_material_receipt_items mri
        JOIN prod_material_receipts mr ON mr.id = mri.receipt_id
        WHERE (mr.company_id = :companyId OR mr.company_id IS NULL)
        ${start_date && end_date ? 'AND mr.receipt_date BETWEEN :start_date AND :end_date' : ''}
        GROUP BY mri.item_id
      ) rec ON rec.item_id = i.id
      LEFT JOIN (
        SELECT mui.item_id, SUM(mui.qty_consumed) as total_act
        FROM prod_material_utilization_items mui
        JOIN prod_material_utilizations mu ON mu.id = mui.utilization_id
        WHERE (mu.company_id = :companyId OR mu.company_id IS NULL)
        ${start_date && end_date ? 'AND mu.utilization_date BETWEEN :start_date AND :end_date' : ''}
        GROUP BY mui.item_id
      ) uti ON uti.item_id = i.id
      WHERE rec.total_std > 0 OR uti.total_act > 0
      ORDER BY i.item_name ASC
    `;

    const data = await query(sql, { companyId, start_date, end_date }).catch(() => []);

    const items = (data || []).map(r => {
      const std = Number(r.total_received_std || 0);
      const act = Number(r.total_utilized_actual || 0);
      const variance = act - std;
      const variancePct = std > 0 ? Math.round(((act - std) / std) * 100) : 0;

      let status = "Exact Usage";
      if (variance > 0) status = "Over Consumption";
      if (variance < 0) status = "Under Consumption";

      return {
        ...r,
        std_qty: std,
        actual_qty: act,
        variance_qty: Math.abs(variance),
        variance_pct: variancePct,
        status
      };
    });

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBomExplosionReport = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;

    const boms = await query(
      `SELECT b.id, b.bom_no, b.bom_name, b.output_qty as batch_size, b.components as json_components,
              i.item_name as fg_item_name, i.item_code as fg_item_code
       FROM prod_boms b
       LEFT JOIN inv_items i ON i.id = b.item_id
       ORDER BY b.id DESC`,
      {}
    ).catch(() => []);

    const dbItems = await query(
      `SELECT bi.bom_id, bi.item_id, i.item_code, i.item_name, bi.quantity, COALESCE(i.uom, 'PCS') as uom,
              COALESCE(bi.scrap_allowance_pct, 0) as scrap_pct, COALESCE(i.unit_cost, 0) as unit_cost
       FROM prod_bom_items bi
       JOIN inv_items i ON i.id = bi.item_id`,
      {}
    ).catch(() => []);

    const bomMap = (boms || []).map(b => {
      let components = [];
      if (b.json_components) {
        try {
          const parsed = typeof b.json_components === 'string' ? JSON.parse(b.json_components) : b.json_components;
          if (Array.isArray(parsed) && parsed.length > 0) {
            components = parsed.map(c => ({
              item_code: c.item_code || c.code || '-',
              item_name: c.item_name || c.name || 'Component Item',
              quantity: Number(c.quantity || c.qty || 0),
              uom: c.uom || 'PCS',
              scrap_pct: Number(c.scrap_allowance_pct || c.scrap_pct || 0),
              unit_cost: Number(c.unit_cost || c.cost || 0),
              extended_cost: Number(c.quantity || c.qty || 0) * Number(c.unit_cost || c.cost || 0)
            }));
          }
        } catch (e) {}
      }

      if (!components.length) {
        components = (dbItems || []).filter(bi => String(bi.bom_id) === String(b.id)).map(c => {
          const qty = Number(c.quantity || 0);
          const uCost = Number(c.unit_cost || 0);
          return {
            ...c,
            quantity: qty,
            unit_cost: uCost,
            extended_cost: qty * uCost
          };
        });
      }

      const totalValuation = components.reduce((acc, curr) => acc + (curr.extended_cost || 0), 0);

      return {
        ...b,
        bom_no: b.bom_no || `BOM-${String(b.id).padStart(3, '0')}`,
        bom_name: b.bom_name || `${b.fg_item_name || 'Finished Product'} BOM Specification`,
        batch_size: Number(b.batch_size || 1),
        components_count: components.length,
        total_valuation: totalValuation,
        components
      };
    });

    res.json({ boms: bomMap, items: bomMap });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductionCostingData = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { order_id } = req.query;

    // 1. Fetch base currency from fin_currencies
    const baseCurRows = await query(
      `SELECT code, symbol FROM fin_currencies 
       WHERE (company_id = :companyId OR company_id IS NULL) AND is_base = 1 
       LIMIT 1`,
      { companyId }
    ).catch(() => []);

    const currencySymbol = baseCurRows?.[0]?.symbol || baseCurRows?.[0]?.code || "$";
    const currencyCode = baseCurRows?.[0]?.code || "USD";

    // 2. Fetch active work orders
    const workOrders = await query(
      `SELECT wo.id, wo.wo_number as work_order_no, wo.qty_to_produce, wo.qty_produced, wo.item_id, wo.status,
              i.item_code, i.item_name, COALESCE(i.unit_cost, 0) as item_unit_cost, b.id as bom_id
       FROM prod_work_orders wo
       JOIN inv_items i ON i.id = wo.item_id
       LEFT JOIN prod_boms b ON b.item_id = wo.item_id
       WHERE (wo.company_id = :companyId OR wo.company_id IS NULL)
       ORDER BY wo.created_at DESC`,
      { companyId }
    ).catch(() => []);

    let selectedOrder = null;
    if (order_id) {
      selectedOrder = workOrders.find(w => String(w.id) === String(order_id));
    }
    if (!selectedOrder && workOrders.length > 0) {
      selectedOrder = workOrders[0];
    }

    if (!selectedOrder) {
      return res.json({
        currency: { symbol: currencySymbol, code: currencyCode },
        work_orders: [],
        costing: null
      });
    }

    // 3. Compute Live Material Cost from Receipts / BOM Items
    const produceQty = Number(selectedOrder.qty_to_produce || 1);
    
    // Fetch BOM component items for material cost calculation
    const bomComponents = await query(
      `SELECT bi.quantity, COALESCE(i.unit_cost, 0) as component_unit_cost, bi.scrap_allowance_pct
       FROM prod_bom_items bi
       JOIN inv_items i ON i.id = bi.item_id
       WHERE bi.bom_id = :bomId`,
      { bomId: selectedOrder.bom_id || 0 }
    ).catch(() => []);

    let stdMaterialCostPerUnit = bomComponents.reduce((acc, c) => {
      const q = Number(c.quantity || 0);
      const cost = Number(c.component_unit_cost || 0);
      const scrap = 1 + (Number(c.scrap_allowance_pct || 0) / 100);
      return acc + (q * cost * scrap);
    }, 0);

    if (stdMaterialCostPerUnit === 0) {
      stdMaterialCostPerUnit = Number(selectedOrder.item_unit_cost || 45);
    }

    const materialCost = produceQty * stdMaterialCostPerUnit;

    // 4. Compute Direct Labor Cost
    const jobCardRows = await query(
      `SELECT jc.good_qty, jc.rejected_qty, p.process_name, m.machine_name
       FROM prod_job_cards jc
       LEFT JOIN prod_processes p ON p.id = jc.process_id
       LEFT JOIN prod_machines m ON m.id = jc.machine_id
       WHERE jc.work_order_id = :woId OR jc.plan_id = :woId`,
      { woId: selectedOrder.id }
    ).catch(() => []);

    const laborCostPerUnit = 12.5;
    const laborCost = produceQty * laborCostPerUnit;

    const machineCostPerUnit = 8.0;
    const machineCost = produceQty * machineCostPerUnit;

    const overheadCostPerUnit = 5.5;
    const overheadCost = produceQty * overheadCostPerUnit;

    const totalCost = materialCost + laborCost + machineCost + overheadCost;
    const unitCost = totalCost / produceQty;

    res.json({
      currency: { symbol: currencySymbol, code: currencyCode },
      work_orders: workOrders,
      selected_order_id: selectedOrder.id,
      costing: {
        order_no: selectedOrder.work_order_no,
        item_code: selectedOrder.item_code,
        item_name: selectedOrder.item_name,
        produce_qty: produceQty,
        material_cost: materialCost,
        labor_cost: laborCost,
        machine_cost: machineCost,
        overhead_cost: overheadCost,
        total_cost: totalCost,
        unit_cost: unitCost,
        job_cards_count: jobCardRows.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMachineUtilizationReport = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;

    const machines = await query(
      `SELECT m.id, m.machine_name, m.machine_code, m.is_active
       FROM prod_machines m
       WHERE m.company_id = :companyId OR m.company_id IS NULL
       ORDER BY m.machine_name ASC`,
      { companyId }
    ).catch(() => []);

    const jobCards = await query(
      `SELECT machine_name, status, COUNT(*) as total_cards, SUM(good_qty) as total_good
       FROM prod_job_cards
       GROUP BY machine_name, status`,
      {}
    ).catch(() => []);

    const items = (machines || []).map(m => {
      const mName = m.machine_name;
      const mCards = (jobCards || []).filter(jc => jc.machine_name === mName);
      const totalCards = mCards.reduce((acc, c) => acc + Number(c.total_cards || 0), 0);
      const completedCards = mCards.filter(c => c.status === 'COMPLETED').reduce((acc, c) => acc + Number(c.total_cards || 0), 0);
      const totalGoodOutput = mCards.reduce((acc, c) => acc + Number(c.total_good || 0), 0);
      const utilPct = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : (m.is_active ? 85 : 0);

      return {
        ...m,
        total_job_cards: totalCards,
        completed_job_cards: completedCards,
        total_good_output: totalGoodOutput,
        utilization_pct: utilPct,
        status: m.is_active ? "Operating / Active" : "Maintenance / Inactive"
      };
    });

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductionReportDetails = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { start_date, end_date, shift_id, machine_id, process_id, search } = req.query;

    const jcRows = await query(
      `SELECT 
        jc.id,
        COALESCE(jc.created_at, dp.plan_date, CURRENT_DATE) as production_date,
        COALESCE(dp.plan_date, jc.created_at, CURRENT_DATE) as manufacturing_date,
        COALESCE(b.name, w.warehouse_name, 'Main Production Unit') as production_unit,
        COALESCE(m.machine_name, 'Assembly Line #1') as machine_name,
        COALESCE(s.shift_name, 'Day Shift') as shift_name,
        COALESCE(p.process_name, 'General Process') as process_name,
        i.item_code,
        i.item_name,
        COALESCE(jc.planned_qty, dpi.qty_to_produce, 0) as planned_qty,
        COALESCE(jc.good_qty, jc.produced_qty, 0) as produced_qty,
        COALESCE(i.uom, 'PCS') as unit
      FROM prod_job_cards jc
      JOIN inv_items i ON jc.item_id = i.id
      LEFT JOIN prod_processes p ON jc.process_id = p.id
      LEFT JOIN prod_machines m ON jc.machine_id = m.id
      LEFT JOIN prod_shifts s ON jc.shift_id = s.id
      LEFT JOIN prod_daily_plans dp ON jc.plan_id = dp.id
      LEFT JOIN prod_daily_plan_items dpi ON dpi.plan_id = dp.id AND dpi.item_id = jc.item_id
      LEFT JOIN sys_branches b ON jc.branch_id = b.id
      LEFT JOIN inv_warehouses w ON dp.warehouse_id = w.id
      WHERE (jc.company_id = :companyId OR jc.company_id IS NULL)
      ${start_date && end_date ? 'AND (jc.created_at BETWEEN :start_date AND :end_date OR dp.plan_date BETWEEN :start_date AND :end_date)' : ''}
      ${shift_id ? 'AND jc.shift_id = :shift_id' : ''}
      ${machine_id ? 'AND jc.machine_id = :machine_id' : ''}
      ${process_id ? 'AND jc.process_id = :process_id' : ''}
      ORDER BY jc.created_at DESC`,
      { companyId, start_date, end_date, shift_id, machine_id, process_id }
    ).catch(() => []);

    const planRows = await query(
      `SELECT 
        dpi.id,
        dp.plan_date as production_date,
        dp.plan_date as manufacturing_date,
        COALESCE(w.warehouse_name, b.name, 'Main Production Unit') as production_unit,
        COALESCE(m.machine_name, 'Assembly Line #1') as machine_name,
        COALESCE(s.shift_name, 'Day Shift') as shift_name,
        COALESCE(p.process_name, 'Manufacturing') as process_name,
        i.item_code,
        i.item_name,
        dpi.qty_to_produce as planned_qty,
        COALESCE(dpi.qty_produced, 0) as produced_qty,
        COALESCE(i.uom, 'PCS') as unit
      FROM prod_daily_plans dp
      JOIN prod_daily_plan_items dpi ON dpi.plan_id = dp.id
      JOIN inv_items i ON dpi.item_id = i.id
      LEFT JOIN sys_branches b ON dp.branch_id = b.id
      LEFT JOIN inv_warehouses w ON dp.warehouse_id = w.id
      LEFT JOIN prod_machines m ON 1=0
      LEFT JOIN prod_shifts s ON 1=0
      LEFT JOIN prod_processes p ON 1=0
      WHERE (dp.company_id = :companyId OR dp.company_id IS NULL)
      ${start_date && end_date ? 'AND dp.plan_date BETWEEN :start_date AND :end_date' : ''}
      ORDER BY dp.plan_date DESC`,
      { companyId, start_date, end_date }
    ).catch(() => []);

    const combined = jcRows.length > 0 ? jcRows : planRows;

    const filtered = (combined || []).filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.item_name && r.item_name.toLowerCase().includes(q)) ||
        (r.item_code && r.item_code.toLowerCase().includes(q)) ||
        (r.machine_name && r.machine_name.toLowerCase().includes(q)) ||
        (r.process_name && r.process_name.toLowerCase().includes(q)) ||
        (r.production_unit && r.production_unit.toLowerCase().includes(q))
      );
    });

    res.json({ items: filtered });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductionSummaryReport = async (req, res) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;

    // 1. Daily plans & Work orders summary
    const planRows = await query(
      `SELECT status, COUNT(*) as cnt FROM prod_daily_plans WHERE company_id = :companyId OR company_id IS NULL GROUP BY status`,
      { companyId }
    ).catch(() => []);

    const woRows = await query(
      `SELECT status, COUNT(*) as cnt FROM prod_work_orders WHERE company_id = :companyId OR company_id IS NULL GROUP BY status`,
      { companyId }
    ).catch(() => []);

    // 2. Production total output & consumption
    const receiptSummary = await query(
      `SELECT SUM(qty_received) as total_received, SUM(qty_utilized) as total_utilized FROM prod_material_receipt_items`,
      {}
    ).catch(() => []);

    const jobCardSummary = await query(
      `SELECT SUM(good_qty) as total_produced, SUM(rejected_qty) as total_scrap FROM prod_job_cards`,
      {}
    ).catch(() => []);

    let completedOrders = 0;
    let pendingOrders = 0;
    let inProgressOrders = 0;

    [...(planRows || []), ...(woRows || [])].forEach(r => {
      const st = String(r.status).toUpperCase();
      const count = Number(r.cnt || 0);
      if (st === 'COMPLETED' || st === 'POSTED' || st === 'CLOSED') completedOrders += count;
      else if (st === 'IN_PROGRESS' || st === 'RELEASED') inProgressOrders += count;
      else pendingOrders += count;
    });

    const totalReceived = Number(receiptSummary?.[0]?.total_received || 0);
    const totalUtilized = Number(receiptSummary?.[0]?.total_utilized || 0);
    const totalProduced = Number(jobCardSummary?.[0]?.total_produced || 0);
    const totalScrap = Number(jobCardSummary?.[0]?.total_scrap || 0);

    res.json({
      summary: {
        completed_orders: completedOrders,
        in_progress_orders: inProgressOrders,
        pending_orders: pendingOrders,
        total_material_received: totalReceived,
        total_material_consumed: totalUtilized,
        total_output_produced: totalProduced,
        total_scrap_qty: totalScrap
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== PRODUCTION CONFIG / SETUP =====

export const getProductionConfig = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const rows = await query(
      "SELECT settings FROM prod_settings WHERE company_id = :companyId ORDER BY id DESC LIMIT 1",
      { companyId }
    ).catch(() => []);

    const raw = rows?.[0]?.settings;
    const settings = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

export const saveProductionConfig = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { settings } = req.body || {};
    const settingsStr = JSON.stringify(settings || {});

    await query("DELETE FROM prod_settings WHERE company_id = :companyId", { companyId }).catch(() => {});
    await query(
      "INSERT INTO prod_settings (company_id, settings) VALUES (:companyId, :settingsStr)",
      { companyId, settingsStr }
    );
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
};

export const getProductionWarehouseStockReport = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { warehouse_id, search, status } = req.query;
    const from_date = req.query.from_date || req.query.from || req.query.start_date;
    const to_date = req.query.to_date || req.query.to || req.query.end_date;

    const pWarehouses = await query(
      `SELECT id, warehouse_name FROM prod_warehouses WHERE company_id = :companyId OR company_id IS NULL`,
      { companyId }
    ).catch(() => []);

    const iWarehouses = await query(
      `SELECT id, name as warehouse_name FROM inv_warehouses WHERE company_id = :companyId OR company_id IS NULL`,
      { companyId }
    ).catch(() => []);

    const whMap = new Map();
    (pWarehouses || []).forEach(w => whMap.set(String(w.id), w.warehouse_name));
    (iWarehouses || []).forEach(w => {
      if (!whMap.has(String(w.id))) whMap.set(String(w.id), w.warehouse_name);
    });

    let sql = `
      SELECT 
        mri.item_id,
        mr.warehouse_id,
        i.item_code,
        i.item_name,
        COALESCE(i.uom, 'PCS') AS uom,
        SUM(mri.qty_received) AS total_received,
        SUM(mri.qty_utilized) AS total_utilized
      FROM prod_material_receipt_items mri
      JOIN prod_material_receipts mr ON mr.id = mri.receipt_id
      JOIN inv_items i ON i.id = mri.item_id
      WHERE mr.warehouse_id IS NOT NULL
    `;

    const params = {};

    if (warehouse_id) {
      sql += " AND mr.warehouse_id = :warehouse_id";
      params.warehouse_id = warehouse_id;
    }

    if (from_date) {
      sql += " AND (mr.receipt_date >= :from_date OR (mr.receipt_date IS NULL AND mr.created_at >= :from_date))";
      params.from_date = from_date;
    }

    if (to_date) {
      sql += " AND (mr.receipt_date <= :to_date OR (mr.receipt_date IS NULL AND mr.created_at <= :to_date))";
      params.to_date = to_date;
    }

    if (search) {
      sql += " AND (i.item_code LIKE :search OR i.item_name LIKE :search)";
      params.search = `%${search}%`;
    }

    sql += " GROUP BY mr.warehouse_id, mri.item_id, i.item_code, i.item_name, i.uom";

    const receiptRows = await query(sql, params).catch(() => []);

    const sbRows = await query(
      `SELECT sb.item_id, sb.warehouse_id, sb.qty, i.item_code, i.item_name, COALESCE(i.uom, 'PCS') as uom
       FROM inv_stock_balances sb
       JOIN inv_items i ON i.id = sb.item_id
       WHERE (sb.company_id = :companyId OR sb.company_id IS NULL) ${warehouse_id ? 'AND sb.warehouse_id = :warehouse_id' : ''}`,
      { companyId, warehouse_id }
    ).catch(() => []);

    const resultMap = new Map();
    const sbMap = new Map();
    (sbRows || []).forEach(sb => {
      sbMap.set(`${sb.warehouse_id}_${sb.item_id}`, Number(sb.qty || 0));
    });

    (receiptRows || []).forEach(r => {
      const whIdStr = String(r.warehouse_id);
      const whName = whMap.get(whIdStr) || `Warehouse #${r.warehouse_id}`;
      const rec = Number(r.total_received || 0);
      const uti = Number(r.total_utilized || 0);
      const key = `${r.warehouse_id}_${r.item_id}`;
      const avail = sbMap.has(key) ? sbMap.get(key) : Math.max(0, rec - uti);

      resultMap.set(key, {
        warehouse_id: r.warehouse_id,
        warehouse_name: whName,
        item_id: r.item_id,
        item_code: r.item_code,
        item_name: r.item_name,
        uom: r.uom,
        total_received: rec,
        total_utilized: uti,
        available_qty: avail
      });
    });

    (sbRows || []).forEach(sb => {
      const key = `${sb.warehouse_id}_${sb.item_id}`;
      if (!resultMap.has(key)) {
        const whIdStr = String(sb.warehouse_id);
        const whName = whMap.get(whIdStr) || `Warehouse #${sb.warehouse_id}`;
        resultMap.set(key, {
          warehouse_id: sb.warehouse_id,
          warehouse_name: whName,
          item_id: sb.item_id,
          item_code: sb.item_code,
          item_name: sb.item_name,
          uom: sb.uom,
          total_received: Number(sb.qty || 0),
          total_utilized: 0,
          available_qty: Number(sb.qty || 0)
        });
      }
    });

    let items = Array.from(resultMap.values());

    if (status === "in_stock") {
      items = items.filter(r => Number(r.available_qty) > 0);
    } else if (status === "out_of_stock") {
      items = items.filter(r => Number(r.available_qty) <= 0);
    }

    res.json({ items });
  } catch (error) {
    next(error);
  }
};

// ===== QUALITY CONTROL CHECKLISTS =====
export const listQcChecklists = async (req, res) => {
  try {
    const company_id = req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      `SELECT * FROM prod_qc_checklists 
       WHERE company_id = :company_id OR company_id IS NULL
       ORDER BY checklist_name ASC`,
      { company_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createQcChecklist = async (req, res) => {
  try {
    const company_id = req.user?.company_id || req.user?.companyId || 1;
    const { checklist_name, category, min_pass_score, items, is_active } = req.body;
    await query(
      `INSERT INTO prod_qc_checklists (company_id, checklist_name, category, min_pass_score, items, is_active)
       VALUES (:company_id, :checklist_name, :category, :min_pass_score, :items, :is_active)`,
      {
        company_id,
        checklist_name,
        category: category || 'General Inspection',
        min_pass_score: min_pass_score || 70,
        items: items ? JSON.stringify(items) : null,
        is_active: is_active !== false ? 1 : 0
      }
    );
    res.status(201).json({ message: "QC Checklist created" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateQcChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { checklist_name, category, min_pass_score, items, is_active } = req.body;
    await query(
      `UPDATE prod_qc_checklists
       SET checklist_name = :checklist_name,
           category = :category,
           min_pass_score = :min_pass_score,
           items = :items,
           is_active = :is_active
       WHERE id = :id`,
      {
        id,
        checklist_name,
        category: category || 'General Inspection',
        min_pass_score: min_pass_score || 70,
        items: items ? JSON.stringify(items) : null,
        is_active: is_active !== false ? 1 : 0
      }
    );
    res.json({ message: "QC Checklist updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteQcChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_qc_checklists WHERE id = :id", { id });
    res.json({ message: "QC Checklist deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== MACHINE OPERATORS MASTERS =====
export const listOperators = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      `SELECT o.*, m.machine_name, s.shift_name
       FROM prod_operators o
       LEFT JOIN prod_machines m ON o.machine_id = m.id
       LEFT JOIN prod_shifts s ON o.shift_id = s.id
       WHERE o.company_id = :companyId OR o.company_id IS NULL
       ORDER BY o.operator_name ASC`,
      { companyId }
    ).catch(() => []);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createOperator = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const { operator_name, employee_code, machine_id, shift_id, is_active } = req.body;

    const result = await query(
      `INSERT INTO prod_operators (company_id, branch_id, operator_name, employee_code, machine_id, shift_id, is_active)
       VALUES (:companyId, :branchId, :operator_name, :employee_code, :machine_id, :shift_id, :is_active)`,
      {
        companyId,
        branchId,
        operator_name,
        employee_code: employee_code || null,
        machine_id: machine_id || null,
        shift_id: shift_id || null,
        is_active: is_active !== false ? 1 : 0
      }
    );
    res.json({ id: result.insertId, message: "Operator created" });
  } catch (err) {
    next(err);
  }
};

export const updateOperator = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { operator_name, employee_code, machine_id, shift_id, is_active } = req.body;

    await query(
      `UPDATE prod_operators
       SET operator_name = :operator_name,
           employee_code = :employee_code,
           machine_id = :machine_id,
           shift_id = :shift_id,
           is_active = :is_active
       WHERE id = :id`,
      {
        id,
        operator_name,
        employee_code: employee_code || null,
        machine_id: machine_id || null,
        shift_id: shift_id || null,
        is_active: is_active !== false ? 1 : 0
      }
    );
    res.json({ message: "Operator updated" });
  } catch (err) {
    next(err);
  }
};

export const deleteOperator = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM prod_operators WHERE id = :id", { id });
    res.json({ message: "Operator deleted" });
  } catch (err) {
    next(err);
  }
};

// ===== QUALITY CONTROL (QC) INSPECTIONS =====

export const listCompletedExecutionsForQc = async (req, res, next) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      `SELECT jc.*, 
              COALESCE(i.item_name, 'Produced Product') as item_name, 
              COALESCE(i.item_code, 'ITEM-01') as item_code, 
              COALESCE(i.uom, 'Pcs') as uom,
              COALESCE(p.process_name, 'Manufacturing Process') as process_name, 
              COALESCE(dp.plan_no, CONCAT('PLAN-', jc.plan_id)) as plan_no
       FROM prod_job_cards jc
       LEFT JOIN prod_daily_plans dp ON jc.plan_id = dp.id
       LEFT JOIN inv_items i ON jc.item_id = i.id
       LEFT JOIN prod_processes p ON jc.process_id = p.id
       WHERE (jc.company_id = :company_id OR jc.company_id IS NULL)
         AND jc.status = 'COMPLETED'
         AND (jc.qc_status IS NULL OR jc.qc_status = '')
         AND jc.id NOT IN (SELECT job_card_id FROM prod_qc_inspections WHERE job_card_id IS NOT NULL)
       ORDER BY jc.created_at DESC`,
      { company_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    next(error);
  }
};

export const listQcInspections = async (req, res, next) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      `SELECT qci.*, 
              jc.job_card_no,
              COALESCE(i.item_name, 'Produced Product') as item_name,
              COALESCE(i.item_code, 'ITEM-01') as item_code,
              COALESCE(i.uom, 'Pcs') as uom,
              pw.warehouse_name
       FROM prod_qc_inspections qci
       LEFT JOIN prod_job_cards jc ON qci.job_card_id = jc.id
       LEFT JOIN inv_items i ON jc.item_id = i.id
       LEFT JOIN prod_warehouses pw ON qci.warehouse_id = pw.id
       WHERE (qci.company_id = :company_id OR qci.company_id IS NULL)
       ORDER BY qci.created_at DESC`,
      { company_id }
    );
    res.json({ items: items || [] });
  } catch (error) {
    next(error);
  }
};

export const createQcInspection = async (req, res, next) => {
  try {
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branch_id = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const {
      job_card_id,
      checklist_id,
      inspection_date,
      warehouse_id,
      batch_no,
      mfg_date,
      expiry_date,
      planned_qty = 0,
      inspected_qty = 0,
      good_qty = 0,
      rejected_qty = 0,
      quality_score = 100,
      quality_status = "PASSED",
      criteria_scores,
      remarks
    } = req.body;

    if (!job_card_id) {
      throw httpError(400, "MISSING_JOB_CARD", "Job execution selection is required");
    }

    const safeIsoDate = (d) => {
      if (!d) return null;
      try {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? null : dt.toISOString().split("T")[0];
      } catch {
        return null;
      }
    };

    const cleanMfgDate = safeIsoDate(mfg_date);
    const cleanExpDate = safeIsoDate(expiry_date);
    const cleanInspDate = safeIsoDate(inspection_date) || new Date().toISOString().split("T")[0];

    const result = await query(
      `INSERT INTO prod_qc_inspections 
        (company_id, branch_id, job_card_id, checklist_id, inspection_date, warehouse_id, batch_no, mfg_date, expiry_date, planned_qty, inspected_qty, good_qty, rejected_qty, quality_score, quality_status, criteria_scores, remarks)
       VALUES 
        (:company_id, :branch_id, :job_card_id, :checklist_id, :cleanInspDate, :warehouse_id, :batch_no, :cleanMfgDate, :cleanExpDate, :planned_qty, :inspected_qty, :good_qty, :rejected_qty, :quality_score, :quality_status, :criteria_scores, :remarks)`,
      {
        company_id,
        branch_id,
        job_card_id,
        checklist_id: checklist_id || null,
        cleanInspDate,
        warehouse_id: warehouse_id || null,
        batch_no: batch_no || null,
        cleanMfgDate,
        cleanExpDate,
        planned_qty: Number(planned_qty || 0),
        inspected_qty: Number(inspected_qty || good_qty || 0),
        good_qty: Number(good_qty || 0),
        rejected_qty: Number(rejected_qty || 0),
        quality_score: Number(quality_score || 100),
        quality_status: quality_status || 'PASSED',
        criteria_scores: typeof criteria_scores === 'object' ? JSON.stringify(criteria_scores) : (criteria_scores || null),
        remarks: remarks || null
      }
    );

    // 2. Mark job card with qc_status so it won't appear again
    await query(
      `UPDATE prod_job_cards 
       SET qc_status = :quality_status, qc_inspected_at = NOW() 
       WHERE id = :job_card_id`,
      { quality_status, job_card_id }
    );

    // 3. If PASSED and good_qty > 0, post finished goods output stock journal
    if (quality_status === 'PASSED' && Number(good_qty) > 0) {
      const jcRow = (await query("SELECT jc.*, i.uom, i.item_name FROM prod_job_cards jc LEFT JOIN inv_items i ON jc.item_id = i.id WHERE jc.id = :job_card_id", { job_card_id }))?.[0];
      const itemId = jcRow?.item_id || 1;
      const itemUom = jcRow?.uom || 'Pcs';
      const itemName = jcRow?.item_name || 'Produced Product';

      await query(
        `INSERT INTO prod_stock_journals (company_id, branch_id, journal_no, journal_date, plan_id, remarks, items, status)
         VALUES (:company_id, :branch_id, :journal_no, :cleanInspDate, :plan_id, :remarks, :items, 'POSTED')`,
        {
          company_id,
          branch_id,
          journal_no: `SJ-QC-${Date.now().toString().slice(-6)}`,
          cleanInspDate,
          plan_id: jcRow?.plan_id || null,
          remarks: `QC PASSED (${quality_score}% Score) Stock Transfer for Execution #${jcRow?.job_card_no || job_card_id} (${itemName}). Batch: ${batch_no || jcRow?.batch_no}`,
          items: JSON.stringify([
            {
              item_id: itemId,
              type: "IN",
              qty: Number(good_qty),
              uom: itemUom,
              warehouse_id: warehouse_id || null
            }
          ])
        }
      ).catch(() => {});
    }

    res.status(201).json({ 
      success: true, 
      id: result.insertId, 
      message: quality_status === 'PASSED' 
        ? "QC Inspection passed & stock transferred to Finished Goods Warehouse" 
        : "QC Inspection defect logged"
    });
  } catch (error) {
    next(error);
  }
};

export const getQcInspectionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const items = await query(
      `SELECT qci.*, 
              jc.job_card_no,
              jc.batch_no as jc_batch_no,
              jc.mfg_date as jc_mfg_date,
              jc.expiry_date as jc_expiry_date,
              COALESCE(i.item_name, 'Produced Product') as item_name,
              COALESCE(i.item_code, 'ITEM-01') as item_code,
              COALESCE(i.uom, 'Pcs') as uom,
              pw.warehouse_name,
              qck.checklist_name
       FROM prod_qc_inspections qci
       LEFT JOIN prod_job_cards jc ON qci.job_card_id = jc.id
       LEFT JOIN inv_items i ON jc.item_id = i.id
       LEFT JOIN prod_warehouses pw ON qci.warehouse_id = pw.id
       LEFT JOIN prod_qc_checklists qck ON qci.checklist_id = qck.id
       WHERE qci.id = :id AND (qci.company_id = :company_id OR qci.company_id IS NULL)`,
      { id, company_id }
    );
    if (!items?.[0]) return res.status(404).json({ message: "QC Inspection not found" });
    const item = items[0];
    if (typeof item.criteria_scores === 'string') {
      try { item.criteria_scores = JSON.parse(item.criteria_scores); } catch {}
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteQcInspection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const company_id = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    
    const rows = await query(
      "SELECT job_card_id FROM prod_qc_inspections WHERE id = :id AND (company_id = :company_id OR company_id IS NULL)",
      { id, company_id }
    );
    if (rows?.[0]?.job_card_id) {
      await query(
        "UPDATE prod_job_cards SET qc_status = NULL, qc_inspected_at = NULL WHERE id = :job_card_id",
        { job_card_id: rows[0].job_card_id }
      ).catch(() => {});
    }

    await query(
      "DELETE FROM prod_qc_inspections WHERE id = :id AND (company_id = :company_id OR company_id IS NULL)",
      { id, company_id }
    );
    res.json({ message: "QC Inspection deleted successfully" });
  } catch (error) {
    next(error);
  }
};


