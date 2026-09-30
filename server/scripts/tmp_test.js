const { pool } = require('./db/pool.js');
async function testQuery() {
    const query = \
    CREATE VIEW v_inv_stock_ledger_computed AS
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty_accepted, 0) AS qty_change, h.grn_date AS transaction_date, 'GRN' AS type
    FROM inv_goods_receipt_notes h JOIN inv_goods_receipt_note_details d ON d.grn_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty, 0), h.updation_date, 'UPDATE' 
    FROM inv_stock_updations h JOIN inv_stock_updation_details d ON d.updation_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.adjusted_stock - d.current_stock, 0), h.adjustment_date, 'ADJUST' 
    FROM inv_stock_adjustments h JOIN inv_stock_adjustment_details d ON d.adjustment_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty_returned, 0), h.rts_date, 'RTS' 
    FROM inv_return_to_stores h JOIN inv_return_to_stores_details d ON d.rts_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty_returned, 0), h.return_date, 'SR' 
    FROM sal_returns h JOIN sal_return_details d ON d.return_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, -COALESCE(d.qty_issued, 0), h.issue_date, 'ISSUE' 
    FROM inv_issue_to_requirement h JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, -COALESCE(d.quantity, 0), h.invoice_date, 'SI' 
    FROM sal_invoices h JOIN sal_invoice_details d ON d.invoice_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.from_warehouse_id, d.item_id, -COALESCE(d.qty, 0), h.transfer_date, 'TF_OUT' 
    FROM inv_stock_transfers h JOIN inv_stock_transfer_details d ON d.transfer_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.to_branch_id, h.to_warehouse_id, d.item_id, COALESCE(d.received_qty, 0), h.received_date, 'TF_IN' 
    FROM inv_stock_transfers h JOIN inv_stock_transfer_details d ON d.transfer_id = h.id WHERE h.status IN ('received', 'completed')
    UNION ALL
    SELECT company_id, branch_id, warehouse_id, item_id, qty_change, transaction_date, transaction_type AS type
    FROM inv_stock_ledger
    \;
    try {
        await pool.query('DROP VIEW IF EXISTS v_inv_stock_ledger_computed');
        await pool.query(query);
        console.log('View created successfully');
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}
testQuery();\
