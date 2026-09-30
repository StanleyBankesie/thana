const fs = require('fs');

const path = 'index.js';
let content = fs.readFileSync(path, 'utf8');

const target2 = `// Timeouts to avoid long-hanging connections in managed hosting
try {
  const headersMs = Number(process.env.HEADERS_TIMEOUT_MS || 65000);
  const requestMs = process.env.REQUEST_TIMEOUT_MS
    ? Number(process.env.REQUEST_TIMEOUT_MS)
    : undefined;
  server.headersTimeout = headersMs;
  if (requestMs !== undefined && Number.isFinite(requestMs)) {
    server.requestTimeout = requestMs;
  }
} catch {}`;

const replacement2 = `// Timeouts to avoid long-hanging connections in managed hosting
try {
  const keepAliveMs = process.env.KEEP_ALIVE_TIMEOUT_MS ? Number(process.env.KEEP_ALIVE_TIMEOUT_MS) : 0;
  const headersMs = Number(process.env.HEADERS_TIMEOUT_MS || 65000);
  const requestMs = process.env.REQUEST_TIMEOUT_MS ? Number(process.env.REQUEST_TIMEOUT_MS) : undefined;
  
  // This is CRITICAL for Plesk HTTP/2 + Nginx + Passenger environments.
  // Setting this to 0 forces Node to send Connection: close,
  // preventing Nginx from passing keep-alive to HTTP/2 clients which causes ERR_HTTP2_PROTOCOL_ERROR.
  server.keepAliveTimeout = keepAliveMs;
  server.headersTimeout = headersMs;
  
  if (requestMs !== undefined && Number.isFinite(requestMs)) {
    server.requestTimeout = requestMs;
  }
} catch {}`;

const normalize = str => str.replace(/\r\n/g, '\n');

if (normalize(content).includes(normalize(target2))) {
  content = normalize(content).replace(normalize(target2), normalize(replacement2));
  fs.writeFileSync(path, content, 'utf8');
  console.log("Re-added keepAliveTimeout=0 successfully!");
} else {
  console.log("Target not found!");
}
