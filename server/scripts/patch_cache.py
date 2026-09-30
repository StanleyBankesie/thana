import re
import sys

with open('server/controllers/maintenance.controller.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Add imports
if 'cacheGet' not in code:
    code = code.replace(
        'import { recordMovementTx } from "../services/stock.service.js";',
        'import { recordMovementTx } from "../services/stock.service.js";\nimport { cacheGet, cacheSet, cacheDelPattern } from "../utils/redis.js";'
    )

# List of list functions and their corresponding cache prefixes
list_funcs = {
    'listAssets': 'maint_assets',
    'listRequests': 'maint_requests',
    'listJobOrders': 'maint_job_orders',
    'listRFQs': 'maint_rfqs',
    'listSupplierQuotations': 'maint_supplier_quotations',
    'listJobExecutions': 'maint_job_executions',
    'listBills': 'maint_bills',
    'listSchedules': 'maint_schedules',
    'listRosters': 'maint_rosters',
    'listEquipment': 'maint_equipment',
}

for func, prefix in list_funcs.items():
    # Find the function definition
    pattern = rf'(export const {func} = async \(req, res, next\) => {{\s*try {{\s*const {{ companyId, branchId = null, branchIdsStr = \'\' }} = req.scope \|\| {{}};)'
    
    # We want to insert the cache check after ensureTables if it exists, but it's easier to just insert right after req.scope
    match = re.search(pattern, code)
    if match:
        cache_check = f"""
    const cacheKey = `{prefix}:company:${{companyId}}:branches:${{branchIdsStr}}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({{ items: cached }});
"""
        # Inject cache check
        if cacheKey_check := f"`{prefix}:company" not in code:
            code = code[:match.end()] + cache_check + code[match.end():]
        
        # Now find the corresponding res.json({ items }) or res.json({ items: rows }) inside this function
        # We'll just search for res.json({ items }) and replace it, but restricted to this function body
        # Actually it's easier to just regex replace `res.json({ items });` and `res.json({ items: rows });`
        # in the block between this function and the next function
        
def inject_cache_set(func_name, prefix, text):
    start_idx = text.find(f"export const {func_name} =")
    if start_idx == -1: return text
    end_idx = text.find("export const", start_idx + 10)
    if end_idx == -1: end_idx = len(text)
    
    func_body = text[start_idx:end_idx]
    
    # Replace res.json({ items })
    func_body = re.sub(
        r'res\.json\(\{\s*items\s*\}\);',
        f'await cacheSet(`{prefix}:company:${{companyId}}:branches:${{branchIdsStr}}`, items, 300);\n    res.json({{ items }});',
        func_body
    )
    
    # Replace res.json({ items: rows })
    func_body = re.sub(
        r'res\.json\(\{\s*items:\s*rows\s*\}\);',
        f'await cacheSet(`{prefix}:company:${{companyId}}:branches:${{branchIdsStr}}`, rows, 300);\n    res.json({{ items: rows }});',
        func_body
    )
    
    return text[:start_idx] + func_body + text[end_idx:]

for func, prefix in list_funcs.items():
    if f'cacheSet(`{prefix}' not in code:
        code = inject_cache_set(func, prefix, code)

# Now for create, update, delete functions, inject cacheDelPattern
modify_prefixes = ['create', 'update', 'delete', 'submit']
for func_name in re.findall(r'export const ([A-Za-z0-9_]+) = async', code):
    is_mod = any(func_name.startswith(p) for p in modify_prefixes)
    if is_mod:
        # Determine which prefix it affects
        entity = func_name.replace('create', '').replace('update', '').replace('delete', '').replace('submit', '')
        # Pluralize roughly
        if entity == 'Asset': entity_prefix = 'maint_assets'
        elif entity == 'Request': entity_prefix = 'maint_requests'
        elif entity == 'JobOrder': entity_prefix = 'maint_job_orders'
        elif entity == 'RFQ': entity_prefix = 'maint_rfqs'
        elif entity == 'SupplierQuotation': entity_prefix = 'maint_supplier_quotations'
        elif entity == 'JobExecution': entity_prefix = 'maint_job_executions'
        elif entity == 'Bill': entity_prefix = 'maint_bills'
        elif entity == 'Schedule': entity_prefix = 'maint_schedules'
        elif entity == 'Roster': entity_prefix = 'maint_rosters'
        elif entity == 'Equipment': entity_prefix = 'maint_equipment'
        else: continue
        
        # Inject cacheDelPattern before res.json
        start_idx = code.find(f"export const {func_name} =")
        end_idx = code.find("export const", start_idx + 10)
        if end_idx == -1: end_idx = len(code)
        
        func_body = code[start_idx:end_idx]
        if 'cacheDelPattern' not in func_body:
            func_body = re.sub(
                r'res\.json\(',
                f'await cacheDelPattern(`{entity_prefix}:company:${{companyId}}:*`);\n    res.json(',
                func_body
            )
            code = code[:start_idx] + func_body + code[end_idx:]

with open('server/controllers/maintenance.controller.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patch applied")
