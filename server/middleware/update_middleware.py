import os

base_path = r"c:\Users\stanl\OneDrive\Documents\serianamart\server\middleware"

files_to_update = {
    "auth.js": [
        (
            'import { verifyAccessToken, getUserPermissions } from "../services/token.service.js";',
            '/**\n * @file auth.js\n * @description Express middleware for handling authentication and scope (company/branch) validation.\n */\nimport { verifyAccessToken, getUserPermissions } from "../services/token.service.js";'
        ),
        (
            'export function requireAuth(req, res, next) {',
            '/**\n * Middleware to require a valid access token.\n * Sets req.user and req.permissions if successful.\n *\n * @param {import(\'express\').Request} req - Express request.\n * @param {import(\'express\').Response} res - Express response.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport function requireAuth(req, res, next) {'
        ),
        (
            'export function requireCompanyScope(req, res, next) {',
            '/**\n * Middleware to enforce company scope based on headers.\n * Ensures the user has a selected company.\n *\n * @param {import(\'express\').Request} req - Express request.\n * @param {import(\'express\').Response} res - Express response.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport function requireCompanyScope(req, res, next) {'
        )
    ],
    "access.js": [
        (
            'import { query } from "../db/pool.js";',
            '/**\n * @file access.js\n * @description Middleware for checking module and feature access permissions.\n */\nimport { query } from "../db/pool.js";'
        ),
        (
            'export function checkModuleAccess(moduleKey) {',
            '/**\n * Middleware to verify if a user\'s role has access to a specific module.\n * \n * @param {string} moduleKey - The unique key of the module.\n * @returns {Function} Express middleware function.\n */\nexport function checkModuleAccess(moduleKey) {'
        )
    ],
    "rbac.middleware.js": [
        (
            'import { pool } from "../db/pool.js";',
            '/**\n * @file rbac.middleware.js\n * @description Role-Based Access Control (RBAC) middlewares for finer-grained permissions.\n */\nimport { pool } from "../db/pool.js";'
        ),
        (
            'export async function getUserPermissions(req, res, next) {',
            '/**\n * Middleware that fetches and attaches a user\'s full permission set to the request.\n *\n * @param {import(\'express\').Request} req - Express request.\n * @param {import(\'express\').Response} res - Express response.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport async function getUserPermissions(req, res, next) {'
        )
    ],
    "requirePermission.js": [
        (
            'import { query } from "../db/pool.js";',
            '/**\n * @file requirePermission.js\n * @description Provides middleware functions to enforce granular permission requirements on routes.\n */\nimport { query } from "../db/pool.js";'
        ),
        (
            'export function requirePermission(permissionKey) {',
            '/**\n * Middleware that checks if the authenticated user has a specific permission.\n *\n * @param {string} permissionKey - The permission code required.\n * @returns {Function} Express middleware function.\n */\nexport function requirePermission(permissionKey) {'
        )
    ],
    "errorHandler.js": [
        (
            'export function errorHandler(err, req, res, next) {',
            '/**\n * @file errorHandler.js\n * @description Global Express error handling middleware.\n */\n\n/**\n * Formats and sends error responses.\n *\n * @param {Error} err - The error object.\n * @param {import(\'express\').Request} req - Express request.\n * @param {import(\'express\').Response} res - Express response.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport function errorHandler(err, req, res, next) {'
        )
    ],
    "notFound.js": [
        (
            'export function notFound(req, res) {',
            '/**\n * @file notFound.js\n * @description Catch-all middleware for 404 Not Found routes.\n */\n\n/**\n * Returns a standard 404 JSON response.\n *\n * @param {import(\'express\').Request} req - Express request.\n * @param {import(\'express\').Response} res - Express response.\n */\nexport function notFound(req, res) {'
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

print("Done updating middleware.")
