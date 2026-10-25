import fs from 'fs';

const filePath = './server/controllers/finance.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

const insertion = `
export const listAllTaxComponents = async (req, res, next) => {
  try {
    await ensureTaxTables();
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers['x-company-id'] ||
      1
    );

    const components = await query(
      \`SELECT 
        d.id as detail_id,
        COALESCE(c.id, d.id) as component_id,
        d.tax_code_id,
        tc.code as tax_code,
        tc.name as tax_code_name,
        d.component_name,
        COALESCE(c.rate_percent, d.rate_percent, 0) as rate_percent,
        d.account_id,
        d.is_active
      FROM fin_tax_details d
      LEFT JOIN fin_tax_components c ON c.tax_detail_id = d.id AND c.company_id = d.company_id
      LEFT JOIN fin_tax_codes tc ON tc.id = d.tax_code_id
      WHERE d.company_id = :companyId AND d.is_active = 1
      ORDER BY tc.code ASC, d.id ASC\`,
      { companyId }
    );

    const taxCodes = await query(
      \`SELECT id, code, name, rate_percent, is_sales_tax, is_purchase_tax, is_service_tax
       FROM fin_tax_codes
       WHERE company_id = :companyId AND is_active = 1
       ORDER BY sort_order ASC, name ASC\`,
      { companyId }
    );

    res.json({
      success: true,
      items: Array.isArray(components) ? components : [],
      taxCodes: Array.isArray(taxCodes) ? taxCodes : []
    });
  } catch (err) {
    next(err);
  }
};
\r\n`;

const target = 'export const listVouchers = async (req, res, next)';
if (!content.includes(target)) {
  console.error('Target not found');
  process.exit(1);
}
content = content.replace(target, insertion + target);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added listAllTaxComponents to finance.controller.js');
