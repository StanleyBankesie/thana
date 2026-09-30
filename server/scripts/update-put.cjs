const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'routes', 'purchase.routes.js');
let code = fs.readFileSync(filepath, 'utf8');

// 1. Update ensureServiceExecutionTables schema
code = code.replace(
  "execution_date DATE NULL,\n          scheduled_time VARCHAR(10) NULL,\n          assigned_supervisor_user_id BIGINT UNSIGNED NULL,",
  "execution_date DATE NULL,\n          scheduled_time VARCHAR(10) NULL,\n          actual_end_date DATE NULL,\n          actual_end_time VARCHAR(10) NULL,\n          assigned_supervisor_user_id BIGINT UNSIGNED NULL,"
);

// 2. Update POST /service-executions
code = code.replace(
  "work_status, work_performed_description, photos_json\n          ) VALUES (",
  "work_status, work_performed_description, photos_json, actual_end_date, actual_end_time\n          ) VALUES ("
);

code = code.replace(
  ":work_status, :work_performed_description, :photos_json\n          )\n          `,\n          {",
  ":work_status, :work_performed_description, :photos_json, :actual_end_date, :actual_end_time\n          )\n          `,\n          {"
);

code = code.replace(
  "work_performed_description: body.work_performed_description || null,",
  "work_performed_description: body.work_performed_description || null,\n            actual_end_date: body.actual_end_date || null,\n            actual_end_time: body.actual_end_time || null,"
);

// 3. Add PUT /service-executions/:id
const putEndpointCode = `
router.put(
  "/service-executions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { id } = req.params;
      const body = req.body || {};
      const userId = req.user?.id || req.scope?.userId;

      // Check if exists
      const [existing] = await conn.execute(
        \`SELECT id FROM pur_service_executions WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))\`,
        { id, companyId, branchIdsStr }
      );
      if (!existing.length) {
        conn.release();
        return res.status(404).json({ error: "Not found" });
      }

      await conn.beginTransaction();

      let finalStatus = body.status || "PENDING";
      if (body.work_status === "COMPLETED") {
        finalStatus = "POSTED";
      }

      await conn.execute(
        \`
        UPDATE pur_service_executions SET
          order_id = :order_id,
          execution_date = :execution_date,
          scheduled_time = :scheduled_time,
          actual_end_date = :actual_end_date,
          actual_end_time = :actual_end_time,
          assigned_supervisor_user_id = :assigned_supervisor_user_id,
          assigned_supervisor_username = :assigned_supervisor_username,
          requisition_notes = :requisition_notes,
          status = :status,
          work_status = :work_status,
          work_performed_description = :work_performed_description,
          photos_json = :photos_json
        WHERE id = :id
        \`,
        {
          id,
          order_id: Number(body.order_id || 0) || null,
          execution_date: body.execution_date || null,
          scheduled_time: body.scheduled_time || null,
          actual_end_date: body.actual_end_date || null,
          actual_end_time: body.actual_end_time || null,
          assigned_supervisor_user_id:
            body.assigned_supervisor_user_id === undefined
              ? null
              : Number(body.assigned_supervisor_user_id || 0) || null,
          assigned_supervisor_username:
            body.assigned_supervisor_username || null,
          requisition_notes: body.requisition_notes || null,
          status: finalStatus,
          work_status: body.work_status || "OPENED",
          work_performed_description: body.work_performed_description || null,
          photos_json: Array.isArray(body.photos) ? JSON.stringify(body.photos) : null,
        }
      );

      // Re-insert materials
      await conn.execute(
        \`DELETE FROM pur_service_execution_materials WHERE execution_id = :id\`,
        { id }
      );

      const materials = Array.isArray(body.materials) ? body.materials : [];
      for (const m of materials) {
        await conn.execute(
          \`
          INSERT INTO pur_service_execution_materials (
            execution_id, item_id, name, unit, qty, note
          ) VALUES (
            :execution_id, :item_id, :name, :unit, :qty, :note
          )
          \`,
          {
            execution_id: id,
            item_id: m.code ? Number(m.code) || null : null,
            name: m.name || null,
            unit: m.unit || null,
            qty: Number(m.qty || 0) || null,
            note: m.note || null,
          }
        );
      }

      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);
`;

// Insert PUT endpoint right after POST endpoint
const postEndStr = "res.status(201).json({ id: execId, execution_no: execNo, status: \"PENDING\" });\n    } catch (err) {\n      if (conn) await conn.rollback();\n      next(err);\n    } finally {\n      if (conn) conn.release();\n    }\n  },\n);\n";
if (code.includes(postEndStr)) {
  code = code.replace(postEndStr, postEndStr + "\n" + putEndpointCode);
} else {
  // Try another approach
  const altStr = "res.status(201).json({ id: execId, execution_no: execNo, status: \"PENDING\" });\n    } catch (err) {\n      if (conn) await conn.rollback();\n      next(err);\n    } finally {\n      if (conn) conn.release();\n    }\n  },\n);";
  if (code.includes(altStr)) {
    code = code.replace(altStr, altStr + "\n" + putEndpointCode);
  } else {
    console.error("Could not find POST endpoint end block to insert PUT endpoint");
  }
}

// 4. Update GET /service-executions/:id
code = code.replace(
  "execution_date,\n          scheduled_time,\n          assigned_supervisor_user_id,",
  "execution_date,\n          scheduled_time,\n          actual_end_date,\n          actual_end_time,\n          assigned_supervisor_user_id,"
);

fs.writeFileSync(filepath, code);
console.log("Updated purchase.routes.js successfully.");
