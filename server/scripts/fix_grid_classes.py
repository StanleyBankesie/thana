import os
import glob

# 1. Update styles.css to remove :has() and use classes
css_path = r"C:\Users\stanl\baseline\client\src\styles.css"
with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

# We will replace all occurrences of 	d:has(button) with .grid-actions-cell
content = content.replace("td:has(button)", ".grid-actions-cell")
content = content.replace("td:nth-last-child(1):not(.grid-actions-cell)", ".grid-created-date-cell")
content = content.replace("td:nth-last-child(2):not(.grid-actions-cell)", ".grid-created-by-cell")

with open(css_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated styles.css")

# 2. Inject classes into SalesOrderList.jsx
jsx_path = r"C:\Users\stanl\baseline\client\src\pages\modules\sales\sales-orders\SalesOrderList.jsx"
with open(jsx_path, "r", encoding="utf-8") as f:
    jsx_content = f.read()

# Add grid-actions-cell
jsx_content = jsx_content.replace('<td className="px-6 py-4 text-right">', '<td className="px-6 py-4 text-right grid-actions-cell">')
jsx_content = jsx_content.replace('className="flex items-center justify-end gap-2"', 'className="flex items-center justify-start gap-2 grid-actions-wrapper"')

# Add grid-created-by-cell and grid-created-date-cell
# Find the exact lines
jsx_content = jsx_content.replace('''<td>
                          {order.created_by_username ||''', '''<td className="grid-created-by-cell">
                          {order.created_by_username ||''')
jsx_content = jsx_content.replace('''<td>
                          {order.created_at''', '''<td className="grid-created-date-cell">
                          {order.created_at''')

with open(jsx_path, "w", encoding="utf-8") as f:
    f.write(jsx_content)

print("Updated SalesOrderList.jsx")

