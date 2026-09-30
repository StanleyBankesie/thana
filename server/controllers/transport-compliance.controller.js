import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

// Utility to generate a unique compliance number
async function generateComplianceNo(companyId) {
  const [rows] = await query(
    `SELECT compliance_no FROM trans_vehicle_compliance 
     WHERE company_id = :companyId AND compliance_no LIKE 'VC-%'
     ORDER BY id DESC LIMIT 1`,
    { companyId }
  );
  
  const prefix = "VC-";
  
  if (rows && rows.length > 0) {
    const lastNo = rows[0].compliance_no;
    const parts = lastNo.split("-");
    if (parts.length === 2 && lastNo.startsWith(prefix)) {
      const seq = parseInt(parts[1], 10);
      if (!isNaN(seq)) {
        return `${prefix}${String(seq + 1).padStart(6, "0")}`;
      }
    }
  }
  
  return `${prefix}000001`;
}

// Utility to determine status based on expiry and reminder
function getComplianceStatus(expiryDateStr, reminderDays) {
  if (!expiryDateStr) return "Valid";
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  if (expiry < now) {
    return "Expired";
  }
  
  const diffTime = Math.abs(expiry - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= (reminderDays || 30)) {
    return "Expiring Soon";
  }
  
  return "Valid";
}

export const listCompliances = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    
    // Add logic to update statuses automatically on list fetch if needed
    // For performance, we can just do a mass update based on dates
    await query(`
      UPDATE trans_vehicle_compliance
      SET status = CASE 
        WHEN expiry_date < CURDATE() THEN 'Expired'
        WHEN DATEDIFF(expiry_date, CURDATE()) <= COALESCE(reminder_days, 30) THEN 'Expiring Soon'
        ELSE 'Valid'
      END
      WHERE company_id = :companyId AND expiry_date IS NOT NULL
    `, { companyId });

    const items = await query(`
      SELECT c.*, v.reg_number as registration_number, v.make, v.model
      FROM trans_vehicle_compliance c
      LEFT JOIN trans_vehicles v ON c.vehicle_id = v.id
      WHERE c.company_id = :companyId
      ORDER BY c.id DESC
    `, { companyId });
    
    // Convert to Array safely since query returns an array or results
    let rows = Array.isArray(items) ? (Array.isArray(items[0]) ? items[0] : items) : [];
    if (!Array.isArray(rows) && rows && typeof rows === 'object') {
       if (Array.isArray(rows.items)) rows = rows.items;
       else rows = [rows];
    }
    
    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
};

export const getComplianceById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    const rows = await query(`
      SELECT c.*, v.reg_number as registration_number, v.make, v.model
      FROM trans_vehicle_compliance c
      LEFT JOIN trans_vehicles v ON c.vehicle_id = v.id
      WHERE c.id = :id AND c.company_id = :companyId
    `, { id, companyId });
    
    const results = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    
    if (!results || results.length === 0) {
      throw httpError(404, "Compliance record not found");
    }
    
    res.json({ item: results[0] });
  } catch (error) {
    next(error);
  }
};

export const createCompliance = async (req, res, next) => {
  try {
    const { companyId, branchId, userId } = req.scope;
    const data = req.body;
    
    if (!data.vehicle_id) throw httpError(400, "Vehicle is required");
    if (!data.compliance_type) throw httpError(400, "Compliance type is required");
    
    const compliance_no = await generateComplianceNo(companyId);
    const status = getComplianceStatus(data.expiry_date, data.reminder_days);

    const result = await query(`
      INSERT INTO trans_vehicle_compliance (
        company_id, branch_id, vehicle_id, compliance_no, compliance_type, 
        document_no, status, issue_date, expiry_date, reminder_days, 
        issuing_authority, policy_type, insurance_company, policy_no, 
        premium_amount, coverage_amount, amount_fee, payment_date, 
        payment_reference, attachment_url, receipt_url, notes, created_by
      ) VALUES (
        :companyId, :branchId, :vehicle_id, :compliance_no, :compliance_type, 
        :document_no, :status, :issue_date, :expiry_date, :reminder_days, 
        :issuing_authority, :policy_type, :insurance_company, :policy_no, 
        :premium_amount, :coverage_amount, :amount_fee, :payment_date, 
        :payment_reference, :attachment_url, :receipt_url, :notes, :userId
      )
    `, {
      companyId,
      branchId,
      userId,
      compliance_no,
      status,
      vehicle_id: data.vehicle_id,
      compliance_type: data.compliance_type,
      document_no: data.document_no || null,
      issue_date: data.issue_date || null,
      expiry_date: data.expiry_date || null,
      reminder_days: data.reminder_days || 30,
      issuing_authority: data.issuing_authority || null,
      policy_type: data.policy_type || null,
      insurance_company: data.insurance_company || null,
      policy_no: data.policy_no || null,
      premium_amount: data.premium_amount || 0,
      coverage_amount: data.coverage_amount || 0,
      amount_fee: data.amount_fee || 0,
      payment_date: data.payment_date || null,
      payment_reference: data.payment_reference || null,
      attachment_url: data.attachment_url || null,
      receipt_url: data.receipt_url || null,
      notes: data.notes || null
    });
    
    const insertId = Array.isArray(result) ? result[0]?.insertId : result?.insertId;
    res.status(201).json({ success: true, id: insertId, compliance_no });
  } catch (error) {
    next(error);
  }
};

export const updateCompliance = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const data = req.body;
    
    const status = getComplianceStatus(data.expiry_date, data.reminder_days);
    
    await query(`
      UPDATE trans_vehicle_compliance SET
        vehicle_id = :vehicle_id,
        compliance_type = :compliance_type,
        document_no = :document_no,
        status = :status,
        issue_date = :issue_date,
        expiry_date = :expiry_date,
        reminder_days = :reminder_days,
        issuing_authority = :issuing_authority,
        policy_type = :policy_type,
        insurance_company = :insurance_company,
        policy_no = :policy_no,
        premium_amount = :premium_amount,
        coverage_amount = :coverage_amount,
        amount_fee = :amount_fee,
        payment_date = :payment_date,
        payment_reference = :payment_reference,
        attachment_url = :attachment_url,
        receipt_url = :receipt_url,
        notes = :notes
      WHERE id = :id AND company_id = :companyId
    `, {
      id,
      companyId,
      status,
      vehicle_id: data.vehicle_id,
      compliance_type: data.compliance_type,
      document_no: data.document_no || null,
      issue_date: data.issue_date || null,
      expiry_date: data.expiry_date || null,
      reminder_days: data.reminder_days || 30,
      issuing_authority: data.issuing_authority || null,
      policy_type: data.policy_type || null,
      insurance_company: data.insurance_company || null,
      policy_no: data.policy_no || null,
      premium_amount: data.premium_amount || 0,
      coverage_amount: data.coverage_amount || 0,
      amount_fee: data.amount_fee || 0,
      payment_date: data.payment_date || null,
      payment_reference: data.payment_reference || null,
      attachment_url: data.attachment_url || null,
      receipt_url: data.receipt_url || null,
      notes: data.notes || null
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const deleteCompliance = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    await query(`
      DELETE FROM trans_vehicle_compliance 
      WHERE id = :id AND company_id = :companyId
    `, { id, companyId });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
