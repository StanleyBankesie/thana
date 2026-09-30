import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find <ViewToggle ... />
    view_toggle_idx = content.find("<ViewToggle")
    if view_toggle_idx == -1:
        return False

    # Find the next <table className=" after ViewToggle
    # Note: If it already has viewMode === 'grid', we might want to skip or just fix the ones that don't.
    # So let's look for <table className=" within the next 200 characters.
    table_pattern = re.compile(r'<table\s+className="([^"]+)"')
    match = table_pattern.search(content, view_toggle_idx)
    
    if match and match.start() - view_toggle_idx < 300:
        old_class = match.group(1)
        # Check if it already has the dynamic class
        if "viewMode" in old_class:
            return False
            
        # Replace the static class with dynamic
        new_class_attr = f'<table className={{ "{old_class} " + (viewMode === \\\'grid\\\' ? \\\'table-grid-mode\\\' : \\\'\\\') }}'
        # Be careful with escape characters in f-strings!
        # Actually better to use string formatting or replace
        new_class_attr = '<table className={{ "{old_class} " + (viewMode === \'grid\' ? \'table-grid-mode\' : \'\') }}'.format(old_class=old_class)
        
        # We replace ONLY this specific occurrence
        new_content = content[:match.start()] + new_class_attr + content[match.end():]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

count = 0
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith("List.jsx"):
            if fix_file(os.path.join(root, file)):
                count += 1
                print(f"Fixed table class in {file}")

print(f"Total fixed: {count}")
