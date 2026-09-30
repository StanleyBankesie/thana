import os
import re

# 1. Update styles.css
css_path = r"C:\Users\stanl\baseline\client\src\styles.css"
with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("/* Table Grid Mode Engine */")
if start_idx != -1:
    new_css = '''/* Table Grid Mode Engine */
.table-grid-mode {
  display: grid !important;
  grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
  gap: 1rem !important;
  border: none !important;
  background: transparent !important;
  padding: 0.5rem !important;
}

@media (min-width: 640px) {
  .table-grid-mode {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1024px) {
  .table-grid-mode {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1400px) {
  .table-grid-mode {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

.table-grid-mode thead {
  display: none !important;
}
.table-grid-mode tbody {
  display: contents !important;
}
.table-grid-mode tr {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: wrap !important;
  background: white !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 0.75rem !important;
  padding: 1rem !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
  transition: transform 0.2s, box-shadow 0.2s !important;
  height: auto !important;
}
.table-grid-mode tr:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
  background-color: white !important;
}
.table-grid-mode td {
  display: flex !important;
  justify-content: flex-start !important;
  align-items: center !important;
  padding: 0.25rem 0 !important;
  border-bottom: 1px dashed #e2e8f0 !important;
  font-size: 0.875rem !important;
  flex-wrap: wrap !important;
  gap: 0.25rem !important;
  width: 100% !important; /* All TDs take full width by default in the flex row */
}

/* Move the actions cell to the very bottom */
.table-grid-mode .grid-actions-cell {
  order: 99 !important;
  border-bottom: none !important;
  margin-top: auto !important;
  padding-top: 1rem !important;
}

/* Put Created By and Created Date on the same row */
.table-grid-mode .grid-created-by-cell {
  width: 50% !important;
  border-bottom: none !important;
}
.table-grid-mode .grid-created-date-cell {
  width: 50% !important;
  border-bottom: none !important;
  justify-content: flex-end !important;
}

/* Action buttons flex arrangement */
.table-grid-mode .grid-actions-cell > div {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 0.25rem !important;
  width: 100% !important;
  justify-content: flex-start !important;
}
.table-grid-mode .grid-actions-cell > div > div {
  min-width: 0 !important;
}

/* Row 1 order */
.table-grid-mode .grid-actions-cell > div > div:nth-child(1) { order: 1 !important; flex: 1 1 auto !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(2) { order: 2 !important; flex: 1 1 auto !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(3) { order: 3 !important; flex: 1 1 auto !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(4) { order: 4 !important; flex: 1 1 auto !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(6) { order: 5 !important; flex: 1 1 auto !important; }

/* Force line break for second row */
.table-grid-mode .grid-actions-cell > div::after {
  content: "" !important;
  display: block !important;
  width: 100% !important;
  order: 6 !important;
}

/* Row 2 order */
.table-grid-mode .grid-actions-cell > div > div:nth-child(5) { order: 7 !important; flex: 1 1 auto !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(7) { order: 8 !important; flex: 1 1 auto !important; }

/* Ensure internal workflows wrap properly instead of squishing */
.table-grid-mode .grid-actions-cell > div > div:nth-child(5) > div {
  display: flex !important;
  flex-direction: row !important;
  gap: 0.25rem !important;
  width: 100% !important;
}
.table-grid-mode .grid-actions-cell > div > div:nth-child(5) > div > * {
  flex: 1 1 auto !important;
}

.table-grid-mode td:first-child {
  font-size: 1.125rem !important;
  font-weight: 600 !important;
  color: #0f172a !important;
  border-bottom: 2px solid #f1f5f9 !important;
  padding-bottom: 0.5rem !important;
  margin-bottom: 0.25rem !important;
}

/* Standardize buttons so they fit without breaking */
.table-grid-mode .grid-actions-cell button {
  padding: 0.25rem 0.5rem !important;
  font-size: 0.75rem !important;
  height: auto !important;
  min-height: 28px !important;
  width: 100% !important;
  white-space: normal !important; /* allow text wrapping if needed */
  word-wrap: break-word !important;
}
'''
    content = content[:start_idx] + new_css
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated styles.css successfully!")
else:
    print("Could not find Table Grid Mode Engine block.")

# 2. Update SalesOrderList.jsx regex
jsx_path = r"C:\Users\stanl\baseline\client\src\pages\modules\sales\sales-orders\SalesOrderList.jsx"
with open(jsx_path, "r", encoding="utf-8") as f:
    jsx_content = f.read()

# Fix the classes directly with regex
jsx_content = re.sub(r'<td([^>]*)>\s*\{order\.created_by_username\s*\|\|', r'<td\1 className="grid-created-by-cell">\n                          {order.created_by_username ||', jsx_content)

jsx_content = re.sub(r'<td([^>]*)>\s*\{order\.created_at\s*\?', r'<td\1 className="grid-created-date-cell">\n                          {order.created_at ?', jsx_content)

with open(jsx_path, "w", encoding="utf-8") as f:
    f.write(jsx_content)

print("Updated SalesOrderList.jsx successfully!")
