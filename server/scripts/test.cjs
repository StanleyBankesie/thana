const pool = require('./db/pool.js');
/**
 * Test function to execute a purchase service execution insertion.
 * @returns {Promise<void>}
 */
async function test() {
  const conn = await pool.getConnection();
  try {
    const body = {
      order_id: null,
      execution_no: '',
      execution_date: '2026-06-27',
      scheduled_time: '10:00',
      assigned_supervisor_user_id: null,
      assigned_supervisor_username: null,
      requisition_notes: 'Test',
      work_status: 'OPENED',
      status: 'PENDING',
      photos: []
    };
    const companyId = 1;
    const branchId = 1;
    const userId = 1;
    
    await conn.beginTransaction();
    const execNo = 'EXEC-TEST1';
    
    const [resExec] = await conn.execute(
      `
      INSERT INTO pur_service_executions (
        company_id, branch_id, order_id, execution_no, execution_date, scheduled_time,
        assigned_supervisor_user_id, assigned_supervisor_username, requisition_notes, status, created_by,
        work_status, work_performed_description, photos_json
      ) VALUES (
        :companyId, :branchId, :order_id, :execution_no, :execution_date, :scheduled_time,
        :assigned_supervisor_user_id, :assigned_supervisor_username, :requisition_notes, :status, :created_by,
        :work_status, :work_performed_description, :photos_json
      )
      `,
      {
        companyId,
        branchId,
        order_id: Number(body.order_id || 0) || null,
        execution_no: execNo,
        execution_date: body.execution_date || null,
        scheduled_time: body.scheduled_time || null,
        assigned_supervisor_user_id:
          body.assigned_supervisor_user_id === undefined
            ? null
            : Number(body.assigned_supervisor_user_id || 0) || null,
        assigned_supervisor_username:
          body.assigned_supervisor_username || null,
        requisition_notes: body.requisition_notes || null,
        status: body.status || 'PENDING',
        work_status: body.work_status || 'OPENED',
        work_performed_description: body.work_performed_description || null,
        photos_json: Array.isArray(body.photos) ? JSON.stringify(body.photos) : null,
        created_by: userId || null,
      }
    );
    console.log('Success', resExec.insertId);
    await conn.rollback();
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}
test();
