import os

base_path = r"c:\Users\stanl\OneDrive\Documents\serianamart\server\utils"

files_to_update = {
    "httpError.js": [
        (
            'export function httpError(status, code, message) {',
            '/**\n * @file httpError.js\n * @description Utility for creating standardized HTTP error objects.\n */\n\n/**\n * Creates an error object with HTTP status and application-specific error code.\n *\n * @param {number} status - HTTP status code (e.g., 400, 404, 500).\n * @param {string} code - Application-specific error code (e.g., "NOT_FOUND").\n * @param {string} message - Human-readable error message.\n * @returns {Error} The constructed Error object with status and code properties.\n */\nexport function httpError(status, code, message) {'
        )
    ],
    "mailer.js": [
        (
            'import nodemailer from "nodemailer";',
            '/**\n * @file mailer.js\n * @description Utility for sending emails using Nodemailer with support for queues and attachments.\n */\nimport nodemailer from "nodemailer";'
        ),
        (
            'export async function sendMail({ to, subject, text, html, cc, attachments, meta }) {',
            '/**\n * Sends an email or queues it depending on the mailer configuration.\n *\n * @param {Object} params - Email parameters.\n * @param {string} params.to - Recipient email address(es).\n * @param {string} params.subject - Email subject.\n * @param {string} [params.text] - Plain text email content.\n * @param {string} [params.html] - HTML email content.\n * @param {string} [params.cc] - CC email address(es).\n * @param {Array} [params.attachments] - Email attachments.\n * @param {Object} [params.meta] - Additional metadata for the email.\n * @returns {Promise<any>} The result of the mail sending operation.\n */\nexport async function sendMail({ to, subject, text, html, cc, attachments, meta }) {'
        )
    ],
    "loadServerEnv.js": [
        (
            'import path from "path";',
            '/**\n * @file loadServerEnv.js\n * @description Utility for discovering and loading the .env file recursively from the server directory.\n */\nimport path from "path";'
        ),
        (
            'export function loadServerEnv(metaUrl = import.meta.url) {',
            '/**\n * Loads environment variables from a .env file located at or above the given module path.\n *\n * @param {string} [metaUrl=import.meta.url] - The meta URL of the caller module to start the search from.\n * @returns {void}\n */\nexport function loadServerEnv(metaUrl = import.meta.url) {'
        )
    ],
    "socket.js": [
        (
            'import { Server } from "socket.io";',
            '/**\n * @file socket.js\n * @description Configures and manages Socket.IO for real-time bidirectional event-based communication.\n */\nimport { Server } from "socket.io";'
        ),
        (
            'export const initializeSocket = (server) => {',
            '/**\n * Initializes the Socket.IO server and binds it to the provided HTTP server.\n *\n * @param {import(\'http\').Server} server - The Node.js HTTP server instance.\n * @returns {import(\'socket.io\').Server} The initialized Socket.IO server.\n */\nexport const initializeSocket = (server) => {'
        ),
        (
            'export const getIO = () => {',
            '/**\n * Retrieves the active Socket.IO server instance.\n * Throws an error if socket.io has not been initialized.\n *\n * @returns {import(\'socket.io\').Server}\n */\nexport const getIO = () => {'
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

print("Done updating utils.")
