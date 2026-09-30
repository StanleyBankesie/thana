const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'routes', 'purchase.routes.js');
let code = fs.readFileSync(filepath, 'utf8');

// 1. Fix CREATE TABLE
const createTableRegex = /requisition_notes TEXT NULL,\s*status VARCHAR\(50\) NOT NULL DEFAULT 'PENDING',\s*created_by BIGINT UNSIGNED NULL,/;
const createTableReplacement = `requisition_notes TEXT NULL,
          work_status VARCHAR(50) NOT NULL DEFAULT 'OPENED',
          work_performed_description TEXT NULL,
          photos_json JSON NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          actual_end_date DATE NULL,
          actual_end_time VARCHAR(10) NULL,
          created_by BIGINT UNSIGNED NULL,`;
code = code.replace(createTableRegex, createTableReplacement);

// 2. Fix POST /service-executions
const postTarget1 = /assigned_supervisor_user_id,\s*assigned_supervisor_username,\s*requisition_notes,\s*status,\s*created_by\s*\)\s*VALUES\s*\(/;
const postReplacement1 = `assigned_supervisor_user_id, assigned_supervisor_username, requisition_notes, status, created_by,
            work_status, work_performed_description, photos_json, actual_end_date, actual_end_time
          ) VALUES (`
code = code.replace(postTarget1, postReplacement1);

const postTarget2 = /:assigned_supervisor_user_id,\s*:assigned_supervisor_username,\s*:requisition_notes,\s*:status,\s*:created_by\s*\)/;
const postReplacement2 = `:assigned_supervisor_user_id, :assigned_supervisor_username, :requisition_notes, :status, :created_by,
            :work_status, :work_performed_description, :photos_json, :actual_end_date, :actual_end_time
          )`;
code = code.replace(postTarget2, postReplacement2);

const postTarget3 = /requisition_notes:\s*body\.requisition_notes\s*\|\|\s*null,\s*status:\s*"PENDING",\s*created_by:\s*userId,\s*\}/;
const postReplacement3 = `requisition_notes: body.requisition_notes || null,
            status: "PENDING",
            created_by: userId,
            work_status: body.work_status || 'OPENED',
            work_performed_description: body.work_performed_description || null,
            photos_json: Array.isArray(body.photos) ? JSON.stringify(body.photos) : null,
            actual_end_date: body.actual_end_date || null,
            actual_end_time: body.actual_end_time || null,
          }`;
code = code.replace(postTarget3, postReplacement3);

// 2.5 Fix POST companyId bug
const companyIdBugTarget2 = /\{\s*branchId,\s*order_id:\s*Number\(body\.order_id\s*\|\|\s*0\)\s*\|\|\s*null,/;
const companyIdBugReplacement2 = `{\n            companyId,\n            branchId,\n            order_id: Number(body.order_id || 0) || null,`;
code = code.replace(companyIdBugTarget2, companyIdBugReplacement2);

const companyIdBugTarget1 = /INSERT\s*INTO\s*pur_service_executions\s*\(\s*branch_id,\s*order_id,\s*execution_no,\s*execution_date,\s*scheduled_time,/;
const companyIdBugReplacement1 = `INSERT INTO pur_service_executions (
            company_id, branch_id, order_id, execution_no, execution_date, scheduled_time,`;
code = code.replace(companyIdBugTarget1, companyIdBugReplacement1);

// 3. Fix GET /service-executions/:id
const getTarget = /assigned_supervisor_user_id,\s*assigned_supervisor_username,\s*requisition_notes,\s*status,\s*created_by,\s*created_at,\s*updated_at/;
const getReplacement = `assigned_supervisor_user_id,
            assigned_supervisor_username,
            requisition_notes,
            status,
            created_by,
            created_at,
            updated_at,
            work_status,
            work_performed_description,
            photos_json,
            actual_end_date,
            actual_end_time`;
code = code.replace(getTarget, getReplacement);

// Also fix GET list query
const getListTarget = /assigned_supervisor_username,\s*status,\s*created_at/;
const getListReplacement = `assigned_supervisor_username,
          status,
          created_at,
          work_status,
          actual_end_date,
          actual_end_time`;
code = code.replace(getListTarget, getListReplacement);

fs.writeFileSync(filepath, code);
console.log("Fixed purchase.routes.js completely.");
