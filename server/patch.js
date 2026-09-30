import fs from 'fs';

const path = 'C:/Users/stanl/baseline/server/controllers/maintenance.controller.js';
let content = fs.readFileSync(path, 'utf8');

const ensureMuTables = `
async function ensureMaintMaterialUtilizationTables(companyId, branchId) {
  await query(\`CREATE TABLE IF NOT EXISTS maint_material_utilization (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    branch_id BIGINT UNSIGNED NOT NULL,
    utilization_no VARCHAR(50) NOT NULL,
    utilization_date DATE NOT NULL,
    execution_id INT NOT NULL,
    warehouse_id BIGINT UNSIGNED DEFAULT NULL,
    remarks TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maint_mu_scope_no (company_id, branch_id, utilization_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4\`);

  await query(\`CREATE TABLE IF NOT EXISTS maint_material_utilization_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    utilization_id BIGINT UNSIGNED NOT NULL,
    item_id INT NOT NULL,
    item_name VARCHAR(255) DEFAULT NULL,
    uom VARCHAR(50) DEFAULT 'PCS',
    required_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
    qty_in_stock DECIMAL(10,2) DEFAULT 0,
    cost_price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_maint_mu_id (utilization_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4\`);
}
`;

if (!content.includes('ensureMaintMaterialUtilizationTables')) {
  content = content.replace('export const createJobExecution', ensureMuTables + '\nexport const createJobExecution');
}

const createJobExecTarget = /export const createJobExecution = async \(req, res, next\) => \{[\s\S]*?res\.status\(201\)\.json\(\{ id: r\.insertId, execution_no \}\);\n  \} catch \(err\) \{\n    next\(err\);\n  \}\n\};/;

const createJobExecReplacement = `export const createJobExecution = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureTables(companyId, branchId);
    await ensureMaintMaterialUtilizationTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(\`SELECT execution_no AS no FROM maint_job_executions WHERE company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))\`,
      { companyId, branchId, branchIdsStr }
    );
    const execution_no = b.execution_no || nextNo("MJE", existing);
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    
    await conn.beginTransaction();

    const [r] = await conn.execute(\`INSERT INTO maint_job_executions (company_id,branch_id,execution_no,job_order_id,start_date,start_time,end_date,end_time,downtime_hours,technicians,work_done,materials_used,material_lines,checklist,completion_status,sign_off_by,sign_off_date,status,notes,approval_status,approved_by,approval_date,approval_notes,total_labor_hours,labor_cost,materials_cost,total_cost,current_step,created_by,warehouse_id) VALUES (:companyId,:branchId,:execution_no,:job_order_id,:start_date,:start_time,:end_date,:end_time,:downtime_hours,:technicians,:work_done,:materials_used,:material_lines,:checklist,:completion_status,:sign_off_by,:sign_off_date,:status,:notes,:approval_status,:approved_by,:approval_date,:approval_notes,:total_labor_hours,:labor_cost,:materials_cost,:total_cost,:current_step,:created_by,:warehouse_id)\`,
      {
        companyId,
        branchId,
        execution_no,
        job_order_id: Number(b.job_order_id) || 0,
        start_date: b.start_date || null,
        start_time: b.start_time || null,
        end_date: b.end_date || null,
        end_time: b.end_time || null,
        downtime_hours: b.downtime_hours || null,
        technicians: JSON.stringify(b.technicians || []),
        work_done: b.work_done || null,
        materials_used: b.materials_used || null,
        material_lines: JSON.stringify(b.material_lines || []),
        checklist: JSON.stringify(b.checklist || []),
        completion_status: b.completion_status || "IN_PROGRESS",
        sign_off_by: b.sign_off_by || null,
        sign_off_date: b.sign_off_date || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
        approval_status: b.approval_status || "PENDING",
        approved_by: b.approved_by || null,
        approval_date: b.approval_date || null,
        approval_notes: b.approval_notes || null,
        total_labor_hours: Number(b.total_labor_hours || 0),
        labor_cost: Number(b.labor_cost || 0),
        materials_cost: Number(b.materials_cost || 0),
        total_cost: Number(b.total_cost || 0),
        current_step: Number(b.current_step || 1),
        created_by: userId,
        warehouse_id: Number(b.warehouse_id) || null,
      }
    );
    const executionId = r.insertId;

    const warehouseId = Number(b.warehouse_id) || null;
    const materialLines = Array.isArray(b.material_lines) ? b.material_lines : [];
    
    if (materialLines.length > 0) {
      const utilNo = "MU-" + execution_no;
      const [mu] = await conn.execute(\`INSERT INTO maint_material_utilization (company_id, branch_id, utilization_no, utilization_date, execution_id, warehouse_id, remarks, status, created_by) VALUES (:companyId, :branchId, :utilNo, :utilDate, :executionId, :warehouseId, :remarks, :status, :createdBy)\`, {
        companyId, branchId,
        utilNo,
        utilDate: b.start_date || new Date().toISOString().split('T')[0],
        executionId: executionId,
        warehouseId: warehouseId,
        remarks: 'Auto-generated from Job Execution ' + execution_no,
        status: b.status === 'POSTED' || b.status === 'COMPLETED' ? 'POSTED' : 'DRAFT',
        createdBy: userId
      });
      const muId = mu.insertId;

      for (const m of materialLines) {
        const itemId = Number(m.item_id) || 0;
        if (!itemId) continue;
        const reqQty = Number(m.qty) || 0;
        await conn.execute(\`INSERT INTO maint_material_utilization_items (utilization_id, item_id, item_name, uom, required_qty, qty_in_stock, cost_price) VALUES (:muId, :itemId, :itemName, :uom, :reqQty, :qtyInStock, :costPrice)\`, {
          muId, itemId,
          itemName: m.description || m.itemName || null,
          uom: m.unit || 'PCS',
          reqQty,
          qtyInStock: Number(m.availableQty) || 0,
          costPrice: Number(m.unit_cost) || 0
        });

        if ((b.status === 'POSTED' || b.status === 'COMPLETED') && warehouseId) {
          const [stockRows] = await conn.execute(
            \`SELECT id, qty FROM inv_stock_balances WHERE company_id = :companyId AND branch_id = :branchId AND warehouse_id = :warehouseId AND item_id = :itemId LIMIT 1\`,
            { companyId, branchId, warehouseId, itemId }
          );
          const currentQty = Number(stockRows?.[0]?.qty || 0);
          if (currentQty < reqQty) {
            throw { status: 400, message: \`Insufficient stock for item \${m.description || itemId}\` };
          }
          await conn.execute(
            \`UPDATE inv_stock_balances SET qty = GREATEST(qty - :reqQty, 0) WHERE id = :id\`,
            { reqQty, id: stockRows[0].id }
          );
          await conn.execute(
            \`INSERT INTO inv_stock_ledger (company_id, branch_id, warehouse_id, item_id, transaction_type, qty_change, source_ref, created_by) VALUES (:companyId, :branchId, :warehouseId, :itemId, 'MATERIAL_UTILIZATION', :qtyChange, :sourceRef, :createdBy)\`,
            {
              companyId, branchId, warehouseId, itemId,
              qtyChange: -reqQty,
              sourceRef: utilNo,
              createdBy: userId,
            }
          );
        }
      }
    }

    await conn.commit();
    res.status(201).json({ id: executionId, execution_no });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch {}
    next(err);
  } finally {
    if (conn) conn.release();
  }
};`;

content = content.replace(createJobExecTarget, createJobExecReplacement);

const updateJobExecTarget = /export const updateJobExecution = async \(req, res, next\) => \{[\s\S]*?res\.json\(\{ ok: true \}\);\n  \} catch \(err\) \{\n    next\(err\);\n  \}\n\};/;

const updateJobExecReplacement = `export const updateJobExecution = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = Number(req.params.id);
    const b = req.body || {};
    await ensureTables(companyId, branchId);
    await ensureMaintMaterialUtilizationTables(companyId, branchId);
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    
    await conn.beginTransaction();
    
    await conn.execute(\`UPDATE maint_job_executions SET job_order_id=:job_order_id,start_date=:start_date,start_time=:start_time,end_date=:end_date,end_time=:end_time,downtime_hours=:downtime_hours,technicians=:technicians,work_done=:work_done,materials_used=:materials_used,material_lines=:material_lines,checklist=:checklist,completion_status=:completion_status,sign_off_by=:sign_off_by,sign_off_date=:sign_off_date,status=:status,notes=:notes,approval_status=:approval_status,approved_by=:approved_by,approval_date=:approval_date,approval_notes=:approval_notes,total_labor_hours=:total_labor_hours,labor_cost=:labor_cost,materials_cost=:materials_cost,total_cost=:total_cost,current_step=:current_step,warehouse_id=:warehouse_id WHERE id=:id AND company_id=:companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))\`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        job_order_id: Number(b.job_order_id) || 0,
        start_date: b.start_date || null,
        start_time: b.start_time || null,
        end_date: b.end_date || null,
        end_time: b.end_time || null,
        downtime_hours: b.downtime_hours || null,
        technicians: JSON.stringify(b.technicians || []),
        work_done: b.work_done || null,
        materials_used: b.materials_used || null,
        material_lines: JSON.stringify(b.material_lines || []),
        checklist: JSON.stringify(b.checklist || []),
        completion_status: b.completion_status || "IN_PROGRESS",
        sign_off_by: b.sign_off_by || null,
        sign_off_date: b.sign_off_date || null,
        status: b.status || "DRAFT",
        notes: b.notes || null,
        approval_status: b.approval_status || "PENDING",
        approved_by: b.approved_by || null,
        approval_date: b.approval_date || null,
        approval_notes: b.approval_notes || null,
        total_labor_hours: Number(b.total_labor_hours || 0),
        labor_cost: Number(b.labor_cost || 0),
        materials_cost: Number(b.materials_cost || 0),
        total_cost: Number(b.total_cost || 0),
        current_step: Number(b.current_step || 1),
        warehouse_id: Number(b.warehouse_id) || null,
      }
    );
    
    const [exec] = await conn.execute(\`SELECT execution_no FROM maint_job_executions WHERE id = :id\`, { id });
    const execution_no = exec[0]?.execution_no;

    const warehouseId = Number(b.warehouse_id) || null;
    const materialLines = Array.isArray(b.material_lines) ? b.material_lines : [];
    
    if (materialLines.length > 0 && (b.status === 'POSTED' || b.status === 'COMPLETED') && warehouseId) {
      const [existingMu] = await conn.execute(\`SELECT id, status FROM maint_material_utilization WHERE execution_id = :id LIMIT 1\`, { id });
      
      if (!existingMu.length) {
        const utilNo = "MU-" + execution_no;
        const [mu] = await conn.execute(\`INSERT INTO maint_material_utilization (company_id, branch_id, utilization_no, utilization_date, execution_id, warehouse_id, remarks, status, created_by) VALUES (:companyId, :branchId, :utilNo, :utilDate, :executionId, :warehouseId, :remarks, :status, :createdBy)\`, {
          companyId, branchId,
          utilNo,
          utilDate: b.start_date || new Date().toISOString().split('T')[0],
          executionId: id,
          warehouseId: warehouseId,
          remarks: 'Auto-generated from Job Execution ' + execution_no,
          status: 'POSTED',
          createdBy: userId
        });
        const muId = mu.insertId;

        for (const m of materialLines) {
          const itemId = Number(m.item_id) || 0;
          if (!itemId) continue;
          const reqQty = Number(m.qty) || 0;
          await conn.execute(\`INSERT INTO maint_material_utilization_items (utilization_id, item_id, item_name, uom, required_qty, qty_in_stock, cost_price) VALUES (:muId, :itemId, :itemName, :uom, :reqQty, :qtyInStock, :costPrice)\`, {
            muId, itemId,
            itemName: m.description || m.itemName || null,
            uom: m.unit || 'PCS',
            reqQty,
            qtyInStock: Number(m.availableQty) || 0,
            costPrice: Number(m.unit_cost) || 0
          });

          const [stockRows] = await conn.execute(
            \`SELECT id, qty FROM inv_stock_balances WHERE company_id = :companyId AND branch_id = :branchId AND warehouse_id = :warehouseId AND item_id = :itemId LIMIT 1\`,
            { companyId, branchId, warehouseId, itemId }
          );
          const currentQty = Number(stockRows?.[0]?.qty || 0);
          if (currentQty < reqQty) {
            throw { status: 400, message: \`Insufficient stock for item \${m.description || itemId}\` };
          }
          await conn.execute(
            \`UPDATE inv_stock_balances SET qty = GREATEST(qty - :reqQty, 0) WHERE id = :id\`,
            { reqQty, id: stockRows[0].id }
          );
          await conn.execute(
            \`INSERT INTO inv_stock_ledger (company_id, branch_id, warehouse_id, item_id, transaction_type, qty_change, source_ref, created_by) VALUES (:companyId, :branchId, :warehouseId, :itemId, 'MATERIAL_UTILIZATION', :qtyChange, :sourceRef, :createdBy)\`,
            {
              companyId, branchId, warehouseId, itemId,
              qtyChange: -reqQty,
              sourceRef: utilNo,
              createdBy: userId,
            }
          );
        }
      }
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch {}
    next(err);
  } finally {
    if (conn) conn.release();
  }
};`;

content = content.replace(updateJobExecTarget, updateJobExecReplacement);

const ensureTablesTarget2 = /await query\(\`CREATE TABLE IF NOT EXISTS maint_job_executions .*? ENGINE=InnoDB DEFAULT CHARSET=utf8mb4\`\);/s;
const ensureTablesMatch2 = content.match(ensureTablesTarget2);
if (ensureTablesMatch2) {
  const addCol = `\n  await query('ALTER TABLE maint_job_executions ADD COLUMN IF NOT EXISTS warehouse_id BIGINT UNSIGNED DEFAULT NULL AFTER created_by').catch(() => {});`;
  content = content.replace(ensureTablesMatch2[0], ensureTablesMatch2[0] + addCol);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Patched maintenance.controller.js');
