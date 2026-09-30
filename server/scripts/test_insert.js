import { pool } from './db/pool.js';
import { query } from './db/pool.js';

/**
 * Test function to insert a record into pur_service_executions.
 * @returns {Promise<void>}
 */
async function test() {
  const conn = await pool.getConnection();
  try {
    console.log("Got connection");
    const body = {
      order_id: 1,
      execution_no: "EX-TEST",
      execution_date: null,
      scheduled_time: null,
      assigned_supervisor_user_id: null,
      assigned_supervisor_username: null,
      requisition_notes: null,
      status: "PENDING",
      work_status: "OPENED",
      work_performed_description: null,
      photos: [],
      actual_end_date: null,
      actual_end_time: null
    };

    const [resExec] = await conn.execute(
        `
        INSERT INTO pur_service_executions (
          company_id, branch_id, order_id, execution_no, execution_date, scheduled_time,
          assigned_supervisor_user_id, assigned_supervisor_username, requisition_notes, status, created_by,
            work_status, work_performed_description, photos_json, actual_end_date, actual_end_time
          ) VALUES (
          :companyId, :branchId, :order_id, :execution_no, :execution_date, :scheduled_time,
          :assigned_supervisor_user_id, :assigned_supervisor_username, :requisition_notes, :status, :created_by,
            :work_status, :work_performed_description, :photos_json, :actual_end_date, :actual_end_time
          )
        `,
        {
            companyId: 1,
            branchId: 1,
            order_id: Number(body.order_id || 0) || null,
          execution_no: body.execution_no,
          execution_date: body.execution_date || null,
          scheduled_time: body.scheduled_time || null,
          assigned_supervisor_user_id:
            body.assigned_supervisor_user_id === undefined
              ? null
              : Number(body.assigned_supervisor_user_id || 0) || null,
          assigned_supervisor_username:
            body.assigned_supervisor_username || null,
          requisition_notes: body.requisition_notes || null,
          status: body.status || "PENDING",
          created_by: 1,
          work_status: body.work_status || "OPENED",
          work_performed_description: body.work_performed_description || null,
          photos_json: Array.isArray(body.photos) ? JSON.stringify(body.photos) : null,
          actual_end_date: body.actual_end_date || null,
          actual_end_time: body.actual_end_time || null,
        },
      );
      console.log("Success! Inserted ID:", resExec.insertId);
      
      // Rollback just in case
      await conn.query(`DELETE FROM pur_service_executions WHERE id = ${resExec.insertId}`);
  } catch (err) {
    console.error("ERROR:");
    console.error(err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

test();
