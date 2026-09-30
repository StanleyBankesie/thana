import os

path = r'c:\Users\stanl\OneDrive\Documents\serianamart\client\src\pages\modules\service-management\service-invoices\ServiceInvoiceForm.jsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace frontend navigation and links
content = content.replace('navigate("/sales/invoices"', 'navigate("/service-management/service-invoices"')
content = content.replace('navigate(`/sales/invoices`', 'navigate(`/service-management/service-invoices`')
content = content.replace('to="/sales/invoices"', 'to="/service-management/service-invoices"')
content = content.replace('to="/sales"', 'to="/service-management"')

# Replace title
content = content.replace('Sales Invoice', 'Service Invoice')
content = content.replace('sales_order_id', 'service_execution_id')
content = content.replace('Sales Order', 'Service Execution')

# Replace API endpoints for orders -> executions
content = content.replace('api.get("/projects/project-orders")', 'api.get("/purchase/service-executions")')
content = content.replace('api.get(`/projects/project-orders/', 'api.get(`/purchase/service-executions/')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced strings successfully.")
