import os

filepath = r"c:\Users\stanl\OneDrive\Documents\serianamart\server\controllers\hr.controller.js"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        'import { query, pool } from "../db/pool.js";',
        '/**\n * @file hr.controller.js\n * @description Manages Human Resources operations including employee profiles,\n * KPI tracking, policies, training programs, performance reviews, and exits.\n */\nimport { query, pool } from "../db/pool.js";'
    ),
    (
        '/**\n * List all employees with filters\n */\nexport async function listEmployees(req, res, next) {',
        '/**\n * Retrieves a list of all employees matching the given filters (department, status, search query).\n *\n * @param {import(\'express\').Request} req - Express request object.\n * @param {import(\'express\').Response} res - Express response object.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport async function listEmployees(req, res, next) {'
    ),
    (
        'export async function listPolicies(req, res, next) {',
        '/**\n * Retrieves all active HR policies for the company.\n *\n * @param {import(\'express\').Request} req - Express request object.\n * @param {import(\'express\').Response} res - Express response object.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport async function listPolicies(req, res, next) {'
    ),
    (
        'export async function savePolicy(req, res, next) {',
        '/**\n * Creates or updates an HR policy document.\n *\n * @param {import(\'express\').Request} req - Express request object.\n * @param {import(\'express\').Response} res - Express response object.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport async function savePolicy(req, res, next) {'
    ),
    (
        '/**\n * Get employee detail by ID\n */\nexport async function getEmployeeById(req, res, next) {',
        '/**\n * Retrieves full details of a specific employee, including their documents and manager info.\n *\n * @param {import(\'express\').Request} req - Express request object.\n * @param {import(\'express\').Response} res - Express response object.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport async function getEmployeeById(req, res, next) {'
    ),
    (
        '/**\n * Create/Update employee\n */\nexport async function saveEmployee(req, res, next) {',
        '/**\n * Inserts or updates an employee\'s profile and manages their tax/allowance mappings.\n * Uses a database transaction to ensure data integrity.\n *\n * @param {import(\'express\').Request} req - Express request object.\n * @param {import(\'express\').Response} res - Express response object.\n * @param {import(\'express\').NextFunction} next - Express next middleware function.\n */\nexport async function saveEmployee(req, res, next) {'
    )
]

for old, new_val in replacements:
    content = content.replace(old, new_val, 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done updating hr.controller.js")
