$path = "server/routes/purchase.routes.js"
$content = Get-Content $path
$newContent = @()
for ($i = 0; $i -lt $content.Length; $i++) {
    $lineNum = $i + 1
    # Remove lines 1199 to 1292
    if ($lineNum -ge 1199 -and $lineNum -le 1292) {
        continue
    }
    # Insert tax helpers at line 1353
    if ($lineNum -eq 1353) {
        $newContent += 'async function loadTaxComponentsByCodeTx(conn, { companyId, taxCodeId }) {'
        $newContent += '  const [rows] = await conn.execute('
        $newContent += '    `SELECT c.tax_detail_id,'
        $newContent += '            COALESCE(c.rate_percent, d.rate_percent, 0) AS rate_percent,'
        $newContent += '            COALESCE(c.compound_level, 0) AS compound_level,'
        $newContent += '            COALESCE(c.sort_order, 100) AS sort_order,'
        $newContent += '            d.component_name'
        $newContent += '       FROM fin_tax_components c'
        $newContent += '       JOIN fin_tax_details d'
        $newContent += '         ON d.id = c.tax_detail_id'
        $newContent += '      WHERE c.company_id = :companyId'
        $newContent += '        AND c.tax_code_id = :taxCodeId'
        $newContent += '        AND c.is_active = 1'
        $newContent += '      ORDER BY c.compound_level ASC, c.sort_order ASC, d.component_name ASC`,'
        $newContent += '    { companyId, taxCodeId },'
        $newContent += '  );'
        $newContent += '  return Array.isArray(rows) ? rows : [];'
        $newContent += '}'
        $newContent += ''
        $newContent += 'function allocateTaxComponents(baseAmount, taxAmount, components) {'
        $newContent += '  const base = Math.max(0, Number(baseAmount || 0));'
        $newContent += '  const expectedTax = Math.max(0, Number(taxAmount || 0));'
        $newContent += '  const list = Array.isArray(components) ? components : [];'
        $newContent += '  if (!list.length || !(expectedTax > 0)) return [];'
        $newContent += '  const grouped = new Map();'
        $newContent += '  for (const comp of list) {'
        $newContent += '    const level = Number(comp.compound_level || 0);'
        $newContent += '    if (!grouped.has(level)) grouped.set(level, []);'
        $newContent += '    grouped.get(level).push(comp);'
        $newContent += '  }'
        $newContent += '  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);'
        $newContent += '  let currentBase = base;'
        $newContent += '  const raw = [];'
        $newContent += '  for (const level of levels) {'
        $newContent += '    const comps = grouped.get(level) || [];'
        $newContent += '    let levelTotal = 0;'
        $newContent += '    for (const comp of comps) {'
        $newContent += '      const amt = (currentBase * Number(comp.rate_percent || 0)) / 100;'
        $newContent += '      raw.push({ ...comp, amount: amt });'
        $newContent += '      levelTotal += amt;'
        $newContent += '    }'
        $newContent += '    currentBase += levelTotal;'
        $newContent += '  }'
        $newContent += '  const rounded = raw.map((r) => ({'
        $newContent += '    ...r,'
        $newContent += '    amount: Math.round(Number(r.amount || 0) * 100) / 100,'
        $newContent += '  }));'
        $newContent += '  const totalRounded = rounded.reduce((s, r) => s + Number(r.amount || 0), 0);'
        $newContent += '  const diff = Math.round((expectedTax - totalRounded) * 100) / 100;'
        $newContent += '  if (rounded.length && Math.abs(diff) > 0.00001) {'
        $newContent += '    rounded[rounded.length - 1].amount ='
        $newContent += '      Math.round('
        $newContent += '        (Number(rounded[rounded.length - 1].amount || 0) + diff) * 100,'
        $newContent += '      ) / 100;'
        $newContent += '  }'
        $newContent += '  return rounded.filter((r) => Number(r.amount || 0) > 0);'
        $newContent += '}'
        $newContent += ''
    }
    $newContent += $content[$i]
}
$newContent | Set-Content $path
