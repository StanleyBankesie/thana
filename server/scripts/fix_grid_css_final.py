import os

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
  .table-grid-mode { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
@media (min-width: 1024px) {
  .table-grid-mode { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
}
@media (min-width: 1400px) {
  .table-grid-mode { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
}

.table-grid-mode thead { display: none !important; }
.table-grid-mode tbody { display: contents !important; }

.table-grid-mode tr {
  display: flex !important;
  flex-direction: column !important;
  background: white !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 0.75rem !important;
  padding: 1rem !important;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.07) !important;
  transition: transform 0.18s ease, box-shadow 0.18s ease !important;
  height: auto !important;
  overflow: visible !important;
}
.table-grid-mode tr:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 24px 0 rgba(0,0,0,0.12) !important;
}

/* All data cells stack vertically */
.table-grid-mode td {
  display: block !important;
  padding: 0.2rem 0 !important;
  border-bottom: none !important;
  font-size: 0.875rem !important;
  width: 100% !important;
  overflow: visible !important;
}

/* First cell = card title */
.table-grid-mode td:first-child {
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
  padding-bottom: 0.5rem !important;
  margin-bottom: 0.35rem !important;
  border-bottom: 2px solid #f1f5f9 !important;
}

/* Hide created by / date in grid */
.table-grid-mode .grid-created-by-cell,
.table-grid-mode .grid-created-date-cell {
  display: none !important;
}

/* Actions cell: push to bottom */
.table-grid-mode .grid-actions-cell {
  margin-top: 0.75rem !important;
  border-top: 1px solid #f1f5f9 !important;
  padding-top: 0.75rem !important;
}

/* -- Row 1: utility buttons (View, Edit, Print, PDF, Attachment) -- */
.table-grid-mode .grid-action-row-1 {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  gap: 0.375rem !important;
  width: 100% !important;
  margin-bottom: 0.5rem !important;
}

/* Generic utility button (View / Edit) */
.table-grid-mode .grid-util-btn {
  flex: 1 1 0% !important;
  min-width: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0.3rem 0.4rem !important;
  font-size: 0.78rem !important;
  font-weight: 500 !important;
  color: #374151 !important;
  background: #f3f4f6 !important;
  border: 1px solid #d1d5db !important;
  border-radius: 0.5rem !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  transition: background 0.15s !important;
  height: 32px !important;
}
.table-grid-mode .grid-util-btn:hover {
  background: #e5e7eb !important;
}

/* Icon buttons (Print, PDF, Attachment) auto-shrink */
.table-grid-mode .grid-action-row-1 > *:not(.grid-util-btn) {
  flex: 0 0 auto !important;
}

/* -- Row 2: workflow status + cancel -- */
.table-grid-mode .grid-action-row-2 {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  gap: 0.375rem !important;
  width: 100% !important;
}

/* Workflow slot takes all remaining space */
.table-grid-mode .grid-workflow-slot {
  flex: 1 1 0% !important;
  min-width: 0 !important;
  display: flex !important;
  align-items: center !important;
  overflow: hidden !important;
}

/* Approved + Reverse Approval side by side */
.table-grid-mode .grid-workflow-approved {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 0.375rem !important;
  width: 100% !important;
  min-width: 0 !important;
}
.table-grid-mode .grid-workflow-approved > * {
  flex: 1 1 0% !important;
  min-width: 0 !important;
}

/* Shrink helper for Forward/Reverse buttons in grid */
.table-grid-mode .grid-shrink-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0.3rem 0.5rem !important;
  font-size: 0.72rem !important;
  font-weight: 500 !important;
  border-radius: 0.5rem !important;
  border: none !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  width: 100% !important;
  height: 32px !important;
  transition: opacity 0.15s !important;
}
.table-grid-mode .grid-shrink-btn:hover { opacity: 0.85 !important; }

/* Pills in grid (Approved, Forwarded) */
.table-grid-mode .list-approval-approved-pill,
.table-grid-mode .list-approval-forwarded-pill {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  font-size: 0.72rem !important;
  padding: 0.3rem 0.4rem !important;
  border-radius: 0.5rem !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Cancel button — fixed width, never overflows */
.table-grid-mode .grid-cancel-btn {
  flex: 0 0 auto !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0.3rem 0.75rem !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
  color: #fff !important;
  background: #991b1b !important;
  border: none !important;
  border-radius: 0.5rem !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  height: 32px !important;
  transition: background 0.15s !important;
}
.table-grid-mode .grid-cancel-btn:hover { background: #7f1d1d !important; }
'''
    content = content[:start_idx] + new_css
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Done!")
else:
    print("Block not found")
