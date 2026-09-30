import os

base_path = r"c:\Users\stanl\OneDrive\Documents\serianamart\server\services"

files_to_update = {
    "token.service.js": [
        (
            'import jwt from "jsonwebtoken";',
            '/**\n * @file token.service.js\n * @description Manages authentication tokens, JWT signing/verifying, and cookie operations.\n */\nimport jwt from "jsonwebtoken";'
        ),
        (
            'export function getRefreshTokenCookieName() {',
            '/**\n * Gets the refresh token cookie name.\n * @returns {string} The configured refresh token cookie name.\n */\nexport function getRefreshTokenCookieName() {'
        ),
        (
            'export function verifyAccessToken(token) {',
            '/**\n * Verifies the signature of an access token.\n * @param {string} token - The JWT string to verify.\n * @returns {Object|null} The decoded token payload if valid, otherwise null.\n */\nexport function verifyAccessToken(token) {'
        ),
        (
            'export async function ensureAuthTables() {',
            '/**\n * Ensures necessary authentication tables exist in the database (schema migration).\n * @returns {Promise<void>}\n */\nexport async function ensureAuthTables() {'
        ),
        (
            'export async function createSessionTokens({ user, rememberMe = false, permissions = [] }) {',
            '/**\n * Generates and saves a new session with access and refresh tokens for a user.\n * @param {Object} params - Session parameters.\n * @param {Object} params.user - The user object.\n * @param {boolean} [params.rememberMe=false] - Whether the session is long-lived.\n * @param {Array} [params.permissions=[]] - List of permissions.\n * @returns {Promise<{accessToken: string, refreshToken: string, userPayload: Object}>}\n */\nexport async function createSessionTokens({ user, rememberMe = false, permissions = [] }) {'
        )
    ],
    "stock.service.js": [
        (
            'import { query, pool } from "../db/pool.js";',
            '/**\n * @file stock.service.js\n * @description Core inventory service handling stock balances, reservations, and ledgers.\n */\nimport { query, pool } from "../db/pool.js";'
        ),
        (
            'export async function recordMovementTx(conn, params) {',
            '/**\n * Records an inventory movement in the stock ledger and updates stock balances.\n * Executes within a provided database transaction.\n * @param {import(\'mysql2/promise\').Connection} conn - Database transaction connection.\n * @param {Object} params - Movement parameters.\n * @returns {Promise<void>}\n */\nexport async function recordMovementTx(conn, params) {'
        ),
        (
            'export async function consumeStockFIFOTx(conn, params) {',
            '/**\n * Consumes stock using FIFO (First-In, First-Out) logic, deducting from batches.\n * Executes within a provided database transaction.\n * @param {import(\'mysql2/promise\').Connection} conn - Database transaction connection.\n * @param {Object} params - Consumption parameters.\n * @returns {Promise<void>}\n */\nexport async function consumeStockFIFOTx(conn, params) {'
        )
    ],
    "seed-defaults.js": [
        (
            'import { query, pool } from "../db/pool.js";',
            '/**\n * @file seed-defaults.js\n * @description Service to seed default settings, templates, and mandatory configuration into the database.\n */\nimport { query, pool } from "../db/pool.js";'
        ),
        (
            'export async function seedDefaultTemplates() {',
            '/**\n * Seeds the default email, invoice, quotation, and system templates if they do not exist.\n * @returns {Promise<void>}\n */\nexport async function seedDefaultTemplates() {'
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

print("Done updating services.")
