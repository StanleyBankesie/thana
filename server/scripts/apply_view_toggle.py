import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"

def update_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Skip if already updated
    if "useViewMode" in content:
        return False

    # 1. Add imports
    # Find the last import statement
    import_match = list(re.finditer(r'^import .*;', content, re.MULTILINE))
    if not import_match:
        return False
    last_import = import_match[-1]
    
    import_text = '\nimport { useViewMode } from "@/hooks/useViewMode";\nimport ViewToggle from "@/components/ViewToggle";'
    content = content[:last_import.end()] + import_text + content[last_import.end():]

    # 2. Add useViewMode hook inside the component
    # Find the main component function
    # It usually starts with export default function SomethingList(...) {
    func_match = re.search(r'export default function [a-zA-Z0-9_]+\([^)]*\)\s*{', content)
    if func_match:
        hook_text = '\n  const [viewMode, setViewMode] = useViewMode();'
        content = content[:func_match.end()] + hook_text + content[func_match.end():]

    # 3. Add ViewToggle above the table
    toggle_text = '\n                <div className="flex justify-end mb-4">\n                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />\n                </div>\n                '
    content = content.replace('<div className="overflow-x-auto">', toggle_text + '<div className="overflow-x-auto">', 1)

    # 4. Update the table className
    content = content.replace('<table className="table">', '<table className={"table " + (viewMode === \'grid\' ? \'table-grid-mode\' : \'\')}>')

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    
    return True

count = 0
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith("List.jsx"):
            filepath = os.path.join(root, file)
            if update_file(filepath):
                count += 1
                print(f"Updated {file}")

print(f"Total updated: {count}")
