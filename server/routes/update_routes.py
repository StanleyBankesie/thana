import os

base_path = r"c:\Users\stanl\OneDrive\Documents\serianamart\server\routes"

files_to_update = {
    "hr.routes.js": [
        (
            'import express from "express";',
            '/**\n * @file hr.routes.js\n * @description Express routes for HR management including employees, attendance, and leave.\n */\nimport express from "express";'
        ),
        (
            'router.get(\n  "/employees",',
            '/**\n * Retrieves all employees with optional filters.\n * @route GET /employees\n */\nrouter.get(\n  "/employees",'
        )
    ],
    "projects.routes.js": [
        (
            'import express from "express";',
            '/**\n * @file projects.routes.js\n * @description Express routes for Projects management, tasks, and timesheets.\n */\nimport express from "express";'
        ),
        (
            'router.get(\n  "/",',
            '/**\n * Retrieves all projects.\n * @route GET /projects\n */\nrouter.get(\n  "/",'
        )
    ],
    "visitors.routes.js": [
        (
            'import express from "express";',
            '/**\n * @file visitors.routes.js\n * @description Express routes for managing visitors and entry logs.\n */\nimport express from "express";'
        ),
        (
            'router.get(\n  "/",',
            '/**\n * Retrieves all visitor records.\n * @route GET /visitors\n */\nrouter.get(\n  "/",'
        )
    ],
    "workflow.routes.js": [
        (
            'import express from "express";',
            '/**\n * @file workflow.routes.js\n * @description Express routes for workflow configurations, steps, and approvals.\n */\nimport express from "express";'
        ),
        (
            'router.get(\n  "/definitions",',
            '/**\n * Retrieves workflow definitions.\n * @route GET /workflow/definitions\n */\nrouter.get(\n  "/definitions",'
        )
    ]
}

for filename, replacements in files_to_update.items():
    filepath = os.path.join(base_path, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for old, new_val in replacements:
            content = content.replace(old, new_val, 1)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filename}")
    else:
        print(f"File not found: {filename}")

print("Done updating routes.")
