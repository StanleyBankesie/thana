import re

with open('ServiceInvoiceList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. API replacement
content = content.replace('/sales/invoices', '/services/invoices')

with open('ServiceInvoiceList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Modifications complete')
