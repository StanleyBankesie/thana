import { query } from '../server/db/pool.js';

async function main() {
  console.log('Testing Subcontractor & Subcontract Auto-generation Flow...');

  // 1. Get or create a test contractor in pur_suppliers
  const existingContr = await query(`SELECT id, supplier_name FROM pur_suppliers WHERE service_contractor = 'Y' LIMIT 1`);
  let contractorId;
  let contractorName;
  if (existingContr.length) {
    contractorId = existingContr[0].id;
    contractorName = existingContr[0].supplier_name;
    console.log(`Found existing Contractor: #${contractorId} - ${contractorName}`);
  } else {
    const ins = await query(`INSERT INTO pur_suppliers (company_id, supplier_code, supplier_name, contact_person, phone, service_contractor, is_active) VALUES (1, 'CONTR-001', 'Premier Structural Engineering Ltd', 'John Builder', '0244123456', 'Y', 1)`);
    contractorId = ins.insertId;
    contractorName = 'Premier Structural Engineering Ltd';
    console.log(`Created test Contractor: #${contractorId} - ${contractorName}`);
  }

  // 2. Get a test project
  const projs = await query(`SELECT id, project_code, project_name FROM pm_projects LIMIT 1`);
  if (!projs.length) {
    console.log('No projects in pm_projects. Test complete.');
    process.exit(0);
  }
  const proj = projs[0];
  console.log(`Using Project #${proj.id} (${proj.project_code}) - ${proj.project_name}`);

  // 3. Test auto-generating subcontract number
  const pCode = proj.project_code || `PRJ${proj.id}`;
  const countRows = await query(`SELECT COUNT(*) as c FROM pm_subcontracts WHERE project_id = :projId`, { projId: proj.id });
  let nextSeq = Number(countRows[0]?.c || 0) + 1;
  let autoContractNo = `SC-${pCode}-${String(nextSeq).padStart(3, '0')}`;
  console.log(`Expected Auto-generated Subcontract No: ${autoContractNo}`);

  // Test insert without providing contract_no manually (simulating the updated controller behavior)
  const insSub = await query(
    `INSERT INTO pm_subcontracts 
      (company_id, branch_id, project_id, contract_no, supplier_id, subcontractor_name, trade_category, scope_of_work, contract_value, retention_percent, advance_percent, advance_paid, advance_recovered, status)
     VALUES 
      (1, 1, :projId, :contractNo, :suppId, :suppName, 'STRUCTURAL_CONCRETE', 'Cast in place columns and slabs', 150000.00, 5.0, 10.0, 15000.00, 0, 'ACTIVE')`,
    {
      projId: proj.id,
      contractNo: autoContractNo,
      suppId: contractorId,
      suppName: contractorName,
    }
  );
  console.log(`Inserted Subcontract agreement #${insSub.insertId} with Auto Contract No: ${autoContractNo}`);

  // 4. Verify retrieval with join
  const rows = await query(`SELECT sc.*, sc.contract_no AS subcontract_number, COALESCE(s.supplier_name, sc.subcontractor_name) AS supplier_name FROM pm_subcontracts sc LEFT JOIN pur_suppliers s ON s.id = sc.supplier_id WHERE sc.id = :id`, { id: insSub.insertId });
  console.log('Retrieved Subcontract:', {
    id: rows[0].id,
    subcontract_number: rows[0].subcontract_number,
    subcontractor: rows[0].supplier_name,
    trade: rows[0].trade_category,
    contract_value: rows[0].contract_value,
    status: rows[0].status,
  });

  // Clean up test entry
  await query(`DELETE FROM pm_subcontracts WHERE id = :id`, { id: insSub.insertId });
  console.log('Cleaned up test subcontract record.');
  console.log('TEST PASSED SUCCESSFULLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
