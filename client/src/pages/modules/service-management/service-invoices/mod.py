import re

with open('ServiceInvoiceForm.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. API replacement
content = content.replace('/sales/invoices', '/services/invoices')

# 2. Replace 'Order' label
content = content.replace('<label className="label">Order</label>', '<label className="label">Execution No</label>')

# 3. Remove Warehouse block
warehouse_pattern = re.compile(r'<div className="form-control">.*?<label className="label">Warehouse</label>.*?</div>', re.DOTALL)
content = warehouse_pattern.sub('', content, count=1)

# 4. Remove Project block
project_pattern = re.compile(r'<div className="form-control">.*?<label className="label">Project</label>.*?</div>', re.DOTALL)
content = project_pattern.sub('', content, count=1)

# 5. Remove Auto Delivery switch block
auto_delivery_pattern = re.compile(r'<div className="flex items-center gap-2 mb-4">.*?Auto Delivery.*?</div>', re.DOTALL)
content = auto_delivery_pattern.sub('', content)

# 6. Remove Print button
print_btn_pattern = re.compile(r'<button[^>]*onClick=\{[^}]*action=print[^}]*\}[^>]*>.*?</button>', re.DOTALL)
content = print_btn_pattern.sub('', content)

# 7. Remove Download PDF button
pdf_btn_pattern = re.compile(r'<button[^>]*onClick=\{[^}]*action=pdf[^}]*\}[^>]*>.*?</button>', re.DOTALL)
content = pdf_btn_pattern.sub('', content)

with open('ServiceInvoiceForm.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Modifications complete')
