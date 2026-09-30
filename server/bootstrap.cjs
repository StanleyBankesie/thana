/**
 * CommonJS wrapper for Phusion Passenger (Plesk/cPanel).
 * Passenger's node-loader uses require() which fails when loading ES Modules.
 * This wrapper uses dynamic import() to load the ESM bootstrap.js file.
 * 
 * Please change your Passenger/Plesk "Application Startup File" to point to `bootstrap.cjs`.
 */

async function startPassenger() {
    try {
        await import('./bootstrap.js');
    } catch (error) {
        console.error("[Passenger CJS Wrapper] Failed to load ES module bootstrap.js:", error);
        process.exit(1);
    }
}

startPassenger();
