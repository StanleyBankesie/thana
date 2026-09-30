const fs = require('fs');

const path = 'index.js';
let content = fs.readFileSync(path, 'utf8');

const target1 = `/* ---------------- HTTP/2 COMPAT ---------------- */
// Monkey-patch ServerResponse to strip HTTP/2-forbidden headers
// that nginx may forward from HTTP/1.1 upstream to HTTP/2 clients.
const ORIG_WRITE_HEAD = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function () {
  // Strip from both this._headers and the internal outHeaders symbol
  const strip = (obj) => {
    if (!obj) return;
    const keys = Object.getOwnPropertyNames(obj);
    for (const k of keys) {
      if (k.toLowerCase() === "connection" || k.toLowerCase() === "transfer-encoding") {
        delete obj[k];
      }
    }
  };
  strip(this._headers);
  const sym = Object.getOwnPropertySymbols(this).find(
    (s) => s.toString().includes("Headers") || s.toString().includes("headers"),
  );
  if (sym) strip(this[sym]);
  return ORIG_WRITE_HEAD.apply(this, arguments);
};

app.use((req, res, next) => {
  res.removeHeader("Connection");
  res.removeHeader("connection");
  res.removeHeader("Transfer-Encoding");
  res.removeHeader("transfer-encoding");
  next();
});`;

const replacement1 = `/* ---------------- HTTP/2 COMPAT ---------------- */
// Removed monkey-patch: stripping Transfer-Encoding and Connection headers
// severely breaks HTTP/1.1 chunked encoding behind Apache/Nginx proxies,
// leading to 30-second delays and worker pool exhaustion (ERR_CONNECTION_TIMED_OUT).`;

const target2 = `// Timeouts to avoid long-hanging connections in managed hosting
// keepAliveTimeout=0 disables keep-alive, forcing "Connection: close"
// instead of "Connection: keep-alive" (avoids ERR_HTTP2_PROTOCOL_ERROR
// when nginx proxies HTTP/1.1 to HTTP/2 clients).
try {
  const keepAliveMs = process.env.KEEP_ALIVE_TIMEOUT_MS
    ? Number(process.env.KEEP_ALIVE_TIMEOUT_MS)
    : 0;
  const headersMs = Number(process.env.HEADERS_TIMEOUT_MS || 65000);
  const requestMs = process.env.REQUEST_TIMEOUT_MS
    ? Number(process.env.REQUEST_TIMEOUT_MS)
    : undefined;
  server.keepAliveTimeout = keepAliveMs;
  server.headersTimeout = headersMs;
  if (requestMs !== undefined && Number.isFinite(requestMs)) {
    server.requestTimeout = requestMs;
  }
} catch {}`;

const replacement2 = `// Timeouts to avoid long-hanging connections in managed hosting
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

const normalize = str => str.replace(/\r\n/g, '\n');

if (normalize(content).includes(normalize(target1))) {
  content = normalize(content).replace(normalize(target1), normalize(replacement1));
  console.log("Target 1 replaced successfully");
} else {
  console.log("Target 1 NOT FOUND");
}

if (normalize(content).includes(normalize(target2))) {
  content = normalize(content).replace(normalize(target2), normalize(replacement2));
  console.log("Target 2 replaced successfully");
} else {
  console.log("Target 2 NOT FOUND");
}

fs.writeFileSync(path, content, 'utf8');
console.log("File saved");
