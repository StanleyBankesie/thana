const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'routes', 'purchase.routes.js');
let code = fs.readFileSync(filepath, 'utf8');
code = code.replace(/\r\n/g, '\n');

// 1. Fix CREATE TABLE
const createTableTarget = "requisition_notes TEXT NULL,\n          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',\n          created_by BIGINT UNSIGNED NULL,";
const createTableReplacement = "requisition_notes TEXT NULL,\n          work_status VARCHAR(50) NOT NULL DEFAULT 'OPENED',\n          work_performed_description TEXT NULL,\n          photos_json JSON NULL,\n          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',\n          actual_end_date DATE NULL,\n          actual_end_time VARCHAR(10) NULL,\n          created_by BIGINT UNSIGNED NULL,";

if (code.includes(createTableTarget)) {
  code = code.replace(createTableTarget, createTableReplacement);
} else {
  console.log("Could not find CREATE TABLE target");
}

// 2. Fix POST /service-executions
const postTarget1 = "assigned_supervisor_user_id, assigned_supervisor_username, requisition_notes, status, created_by\n          ) VALUES (";
const postReplacement1 = "assigned_supervisor_user_id, assigned_supervisor_username, requisition_notes, status, created_by,\n            work_status, work_performed_description, photos_json, actual_end_date, actual_end_time\n          ) VALUES (";

if (code.includes(postTarget1)) {
  code = code.replace(postTarget1, postReplacement1);
} else {
  console.log("Could not find POST target 1");
}

const postTarget2 = ":assigned_supervisor_user_id, :assigned_supervisor_username, :requisition_notes, :status, :created_by\n          )";
const postReplacement2 = ":assigned_supervisor_user_id, :assigned_supervisor_username, :requisition_notes, :status, :created_by,\n            :work_status, :work_performed_description, :photos_json, :actual_end_date, :actual_end_time\n          )";

if (code.includes(postTarget2)) {
  code = code.replace(postTarget2, postReplacement2);
} else {
  console.log("Could not find POST target 2");
}

const postTarget3 = "requisition_notes: body.requisition_notes || null,\n            status: \"PENDING\",\n            created_by: userId,\n          }";
const postReplacement3 = "requisition_notes: body.requisition_notes || null,\n            status: \"PENDING\",\n            created_by: userId,\n            work_status: body.work_status || 'OPENED',\n            work_performed_description: body.work_performed_description || null,\n            photos_json: Array.isArray(body.photos) ? JSON.stringify(body.photos) : null,\n            actual_end_date: body.actual_end_date || null,\n            actual_end_time: body.actual_end_time || null,\n          }";

if (code.includes(postTarget3)) {
  code = code.replace(postTarget3, postReplacement3);
} else {
  console.log("Could not find POST target 3");
}

// 2.5 Fix POST companyId bug that was lost
const companyIdBugTarget = "        const [resExec] = await conn.execute(\n          `\n          INSERT INTO pur_service_executions (\n            company_id, branch_id, order_id, execution_no, execution_date, scheduled_time,";
const companyIdBugReplacement = "        const [resExec] = await conn.execute(\n          `\n          INSERT INTO pur_service_executions (\n            company_id, branch_id, order_id, execution_no, execution_date, scheduled_time,";

const companyIdBugTarget2 = "          {\n            branchId,\n            order_id: Number(body.order_id || 0) || null,";
const companyIdBugReplacement2 = "          {\n            companyId,\n            branchId,\n            order_id: Number(body.order_id || 0) || null,";

if (code.includes(companyIdBugTarget2)) {
  code = code.replace(companyIdBugTarget2, companyIdBugReplacement2);
} else {
  console.log("Could not find POST companyId target 2");
}

// 3. Fix GET /service-executions/:id
const getTarget = "assigned_supervisor_user_id,\n            assigned_supervisor_username,\n            requisition_notes,\n            status,\n            created_by,\n            created_at,\n            updated_at";
const getReplacement = "assigned_supervisor_user_id,\n            assigned_supervisor_username,\n            requisition_notes,\n            status,\n            created_by,\n            created_at,\n            updated_at,\n            work_status,\n            work_performed_description,\n            photos_json,\n            actual_end_date,\n            actual_end_time";

if (code.includes(getTarget)) {
  code = code.replace(getTarget, getReplacement);
} else {
  console.log("Could not find GET target");
}

// Also fix GET list query
const getListTarget = "assigned_supervisor_username,\n          status,\n          created_at";
const getListReplacement = "assigned_supervisor_username,\n          status,\n          created_at,\n          work_status,\n          actual_end_date,\n          actual_end_time";
if (code.includes(getListTarget)) {
  code = code.replace(getListTarget, getListReplacement);
} else {
  console.log("Could not find GET List target");
}


fs.writeFileSync(filepath, code);
console.log("Fixed purchase.routes.js completely.");
