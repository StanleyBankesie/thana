import os

css_path = r"C:\Users\stanl\baseline\client\src\styles.css"
with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("/* Table Grid Mode Engine */")
if start_idx != -1:
    new_css = '''
/* Shrink the Approved button/pills specifically to ~80% of their natural size */
.table-grid-mode .grid-actions-cell .list-approval-badge-success,
.table-grid-mode .grid-actions-cell .list-approval-forwarded-pill,
.table-grid-mode .grid-actions-cell .list-approval-badge-warning,
.table-grid-mode .grid-actions-cell .list-approval-badge-danger {
  font-size: 0.56rem !important; /* 80% of 0.70rem */
  padding: 0.20rem 0.40rem !important; /* 80% of 0.25rem 0.5rem */
}
'''
    
    # Check if the fix is already appended
    if "/* Shrink the Approved button/pills specifically" not in content:
        content = content + new_css
        with open(css_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated styles.css with 80% scaling successfully!")
    else:
        print("Already updated.")
else:
    print("Could not find Table Grid Mode Engine block.")
