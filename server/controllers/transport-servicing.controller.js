import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

async function generateServiceNo(companyId) {
  const [rows] = await query(
    `SELECT service_no FROM trans_vehicle_servicing 
     WHERE company_id = :companyId AND service_no LIKE 'VS-%'
     ORDER BY id DESC LIMIT 1`,
    { companyId }
  );
  
  const prefix = "VS-";
  if (rows && rows.length > 0) {
    const lastNo = rows[0].service_no;
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

// Ensure proper JSON serialization
function safeJsonStringify(obj) {
  if (!obj) return null;
  return JSON.stringify(obj);
}

export const listServicing = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    
    // Auto-update status before fetching
    // Upcoming, Due, Overdue, Completed
    // If next_service_date is passed, it's Overdue.
    // If current odometer >= next_service_mileage, it's Overdue.
    // If next_service_date is within 14 days, it's Due.
    await query(`
      UPDATE trans_vehicle_servicing s
      JOIN trans_vehicles v ON s.vehicle_id = v.id
      SET s.service_status = CASE 
        WHEN s.next_service_date < CURDATE() OR (s.next_service_mileage > 0 AND v.current_odometer >= s.next_service_mileage) THEN 'Overdue'
        WHEN s.next_service_date IS NOT NULL AND DATEDIFF(s.next_service_date, CURDATE()) <= COALESCE(s.reminder_days, 30) THEN 'Due'
        ELSE 'Upcoming'
      END
      WHERE s.company_id = :companyId AND s.next_service_date IS NOT NULL
    `, { companyId });

    const items = await query(`
      SELECT s.*, v.reg_number as registration_number, v.make, v.model, v.current_odometer
      FROM trans_vehicle_servicing s
      LEFT JOIN trans_vehicles v ON s.vehicle_id = v.id
      WHERE s.company_id = :companyId
      ORDER BY s.id DESC
    `, { companyId });
    
    let rows = Array.isArray(items) ? (Array.isArray(items[0]) ? items[0] : items) : [];
    if (!Array.isArray(rows) && rows && typeof rows === 'object') {
       if (Array.isArray(rows.items)) rows = rows.items;
       else rows = [rows];
    }

    // Parse JSON
    rows = rows.map(r => ({
      ...r,
      services_performed: r.services_performed ? (typeof r.services_performed === 'string' ? JSON.parse(r.services_performed) : r.services_performed) : [],
      parts_replaced: r.parts_replaced ? (typeof r.parts_replaced === 'string' ? JSON.parse(r.parts_replaced) : r.parts_replaced) : []
    }));
    
    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
};

export const getServicingById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    const rows = await query(`
      SELECT s.*, v.reg_number as registration_number, v.make, v.model, v.current_odometer
      FROM trans_vehicle_servicing s
      LEFT JOIN trans_vehicles v ON s.vehicle_id = v.id
      WHERE s.id = :id AND s.company_id = :companyId
    `, { id, companyId });
    
    const results = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    
    if (!results || results.length === 0) {
      throw httpError(404, "Servicing record not found");
    }
    
    const item = results[0];
    item.services_performed = item.services_performed ? (typeof item.services_performed === 'string' ? JSON.parse(item.services_performed) : item.services_performed) : [];
    item.parts_replaced = item.parts_replaced ? (typeof item.parts_replaced === 'string' ? JSON.parse(item.parts_replaced) : item.parts_replaced) : [];
    
    res.json({ item });
  } catch (error) {
    next(error);
  }
};

export const createServicing = async (req, res, next) => {
  try {
    const { companyId, branchId, userId } = req.scope;
    const data = req.body;
    
    if (!data.vehicle_id) throw httpError(400, "Vehicle is required");
    
    const service_no = await generateServiceNo(companyId);
    const total_cost = (Number(data.labour_cost) || 0) + (Number(data.parts_cost) || 0) + (Number(data.other_charges) || 0);

    const result = await query(`
      INSERT INTO trans_vehicle_servicing (
        company_id, branch_id, vehicle_id, service_no, service_type, service_date, 
        next_service_date, reminder_days, current_service_mileage, next_service_mileage, 
        odometer_reading, service_status, provider_garage, provider_mechanic, 
        provider_contact_person, provider_contact_number, labour_cost, parts_cost, 
        other_charges, total_cost, payment_status, payment_reference, 
        services_performed, parts_replaced, invoice_url, receipt_url, 
        report_url, support_doc_url, notes, completion_date, created_by
      ) VALUES (
        :companyId, :branchId, :vehicle_id, :service_no, :service_type, :service_date, 
        :next_service_date, :reminder_days, :current_service_mileage, :next_service_mileage, 
        :odometer_reading, :service_status, :provider_garage, :provider_mechanic, 
        :provider_contact_person, :provider_contact_number, :labour_cost, :parts_cost, 
        :other_charges, :total_cost, :payment_status, :payment_reference, 
        :services_performed, :parts_replaced, :invoice_url, :receipt_url, 
        :report_url, :support_doc_url, :notes, :completion_date, :userId
      )
    `, {
      companyId,
      branchId,
      userId,
      service_no,
      vehicle_id: data.vehicle_id,
      service_type: data.service_type || 'Routine',
      service_date: data.service_date || null,
      next_service_date: data.next_service_date || null,
      reminder_days: data.reminder_days || null,
      current_service_mileage: data.current_service_mileage || 0,
      next_service_mileage: data.next_service_mileage || 0,
      odometer_reading: data.odometer_reading || 0,
      service_status: data.service_status || 'Completed',
      provider_garage: data.provider_garage || null,
      provider_mechanic: data.provider_mechanic || null,
      provider_contact_person: data.provider_contact_person || null,
      provider_contact_number: data.provider_contact_number || null,
      labour_cost: data.labour_cost || 0,
      parts_cost: data.parts_cost || 0,
      other_charges: data.other_charges || 0,
      total_cost,
      payment_status: data.payment_status || 'Pending',
      payment_reference: data.payment_reference || null,
      services_performed: safeJsonStringify(data.services_performed),
      parts_replaced: safeJsonStringify(data.parts_replaced),
      invoice_url: data.invoice_url || null,
      receipt_url: data.receipt_url || null,
      report_url: data.report_url || null,
      support_doc_url: data.support_doc_url || null,
      notes: data.notes || null,
      completion_date: data.completion_date || null
    });
    
    const insertId = Array.isArray(result) ? result[0]?.insertId : result?.insertId;
    res.status(201).json({ success: true, id: insertId });
  } catch (error) {
    next(error);
  }
};

export const updateServicing = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const data = req.body;
    
    const total_cost = (Number(data.labour_cost) || 0) + (Number(data.parts_cost) || 0) + (Number(data.other_charges) || 0);
    
    await query(`
      UPDATE trans_vehicle_servicing SET
        vehicle_id = :vehicle_id,
        service_type = :service_type,
        service_date = :service_date,
        next_service_date = :next_service_date,
        reminder_days = :reminder_days,
        current_service_mileage = :current_service_mileage,
        next_service_mileage = :next_service_mileage,
        odometer_reading = :odometer_reading,
        service_status = :service_status,
        provider_garage = :provider_garage,
        provider_mechanic = :provider_mechanic,
        provider_contact_person = :provider_contact_person,
        provider_contact_number = :provider_contact_number,
        labour_cost = :labour_cost,
        parts_cost = :parts_cost,
        other_charges = :other_charges,
        total_cost = :total_cost,
        payment_status = :payment_status,
        payment_reference = :payment_reference,
        services_performed = :services_performed,
        parts_replaced = :parts_replaced,
        invoice_url = :invoice_url,
        receipt_url = :receipt_url,
        report_url = :report_url,
        support_doc_url = :support_doc_url,
        notes = :notes,
        completion_date = :completion_date
      WHERE id = :id AND company_id = :companyId
    `, {
      id,
      companyId,
      vehicle_id: data.vehicle_id,
      service_type: data.service_type || 'Routine',
      service_date: data.service_date || null,
      next_service_date: data.next_service_date || null,
      reminder_days: data.reminder_days || null,
      current_service_mileage: data.current_service_mileage || 0,
      next_service_mileage: data.next_service_mileage || 0,
      odometer_reading: data.odometer_reading || 0,
      service_status: data.service_status || 'Completed',
      provider_garage: data.provider_garage || null,
      provider_mechanic: data.provider_mechanic || null,
      provider_contact_person: data.provider_contact_person || null,
      provider_contact_number: data.provider_contact_number || null,
      labour_cost: data.labour_cost || 0,
      parts_cost: data.parts_cost || 0,
      other_charges: data.other_charges || 0,
      total_cost,
      payment_status: data.payment_status || 'Pending',
      payment_reference: data.payment_reference || null,
      services_performed: safeJsonStringify(data.services_performed),
      parts_replaced: safeJsonStringify(data.parts_replaced),
      invoice_url: data.invoice_url || null,
      receipt_url: data.receipt_url || null,
      report_url: data.report_url || null,
      support_doc_url: data.support_doc_url || null,
      notes: data.notes || null,
      completion_date: data.completion_date || null
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const deleteServicing = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    await query(`
      DELETE FROM trans_vehicle_servicing 
      WHERE id = :id AND company_id = :companyId
    `, { id, companyId });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
