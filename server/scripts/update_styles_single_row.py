import os
import re

css_path = r"C:\Users\stanl\baseline\client\src\styles.css"
with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("/* Table Grid Mode Engine */")
if start_idx != -1:
    new_css = '''/* Table Grid Mode Engine */
.table-grid-mode {
  display: grid !important;
  grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
  gap: 0.75rem !important;
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
  padding: 0.75rem !important; /* Reduced card padding */
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
  padding: 0.125rem 0 !important; /* REDUCED empty space between rows */
  border-bottom: none !important;
  font-size: 0.875rem !important;
  flex-wrap: wrap !important;
  gap: 0.125rem !important;
  width: 100% !important; 
}

.table-grid-mode .grid-actions-cell {
  order: 99 !important;
  border-bottom: none !important;
  margin-top: auto !important;
  padding-top: 0.5rem !important;
}

.table-grid-mode .grid-created-by-cell,
.table-grid-mode .grid-created-date-cell {
  display: none !important;
}

/* ALL BUTTONS ON THE SAME ROW */
.table-grid-mode .grid-actions-cell > div {
  display: flex !important;
  flex-wrap: nowrap !important; /* FORCE same row */
  gap: 0.125rem !important;
  width: 100% !important;
  justify-content: flex-start !important;
  overflow-x: auto !important; /* Allow scroll if screen is too narrow */
  padding-bottom: 0.25rem !important; /* Scrollbar breathing room */
}
.table-grid-mode .grid-actions-cell > div::-webkit-scrollbar {
  height: 4px;
}
.table-grid-mode .grid-actions-cell > div::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.table-grid-mode .grid-actions-cell > div > div {
  min-width: 0 !important;
  flex: 1 1 auto !important;
}

/* Let the nested workflow buttons also sit on the same row */
.table-grid-mode .grid-actions-cell > div > div > div.flex {
  display: flex !important;
  flex-direction: row !important;
  gap: 0.125rem !important;
  flex-wrap: nowrap !important;
  width: 100% !important;
}

/* Apply order sequentially so they appear correctly in the single row */
.table-grid-mode .grid-actions-cell > div > div:nth-child(1) { order: 1 !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(2) { order: 2 !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(3) { order: 3 !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(4) { order: 4 !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(6) { order: 5 !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(5) { order: 6 !important; }
.table-grid-mode .grid-actions-cell > div > div:nth-child(7) { order: 7 !important; }

.table-grid-mode td:first-child {
  font-size: 1.0rem !important;
  font-weight: 600 !important;
  color: #0f172a !important;
  border-bottom: 2px solid #f1f5f9 !important;
  padding-bottom: 0.25rem !important;
  margin-bottom: 0.125rem !important;
}

/* Unified button styling for the single row */
.table-grid-mode .grid-actions-cell button,
.table-grid-mode .grid-actions-cell .list-approval-forwarded-pill,
.table-grid-mode .grid-actions-cell .list-approval-badge-success,
.table-grid-mode .grid-actions-cell .list-approval-badge-warning,
.table-grid-mode .grid-actions-cell .list-approval-badge-danger {
  padding: 0.125rem 0.25rem !important;
  font-size: 0.65rem !important;
  height: auto !important;
  min-height: 24px !important;
  width: 100% !important;
  white-space: nowrap !important;
  text-overflow: ellipsis !important;
  overflow: hidden !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 1 1 auto !important;
}

/* Ensure icons inside buttons are small enough */
.table-grid-mode .grid-actions-cell button svg {
  width: 0.75rem !important;
  height: 0.75rem !important;
}
'''
    
    # We replace everything from start_idx to the end, since we are rewriting the whole block.
    # But wait, my previous scripts just appended things, so the block might be duplicated or messy.
    # Let's cleanly replace the block.
    end_idx = len(content)
    content = content[:start_idx] + new_css
    
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated styles.css successfully!")
else:
    print("Could not find Table Grid Mode Engine block.")
