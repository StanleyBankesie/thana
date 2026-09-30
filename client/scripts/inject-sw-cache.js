import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "..", "dist");
const root = resolve(__dirname, "..");
const publicSwPath = resolve(root, "public", "sw.js");

// Read the original public/sw.js to get the base pre-cache entries
const publicSw = readFileSync(publicSwPath, "utf-8");
const baseAddAllRe = /cache\.addAll\s*\(\s*\[([\s\S]*?)\]\s*\)/;
const baseMatch = publicSw.match(baseAddAllRe);
const baseEntries = [];
if (baseMatch) {
  const raw = baseMatch[1];
  const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      const v = JSON.parse(line);
      if (typeof v === "string" && !v.startsWith("/assets/")) {
        baseEntries.push(v);
      }
    } catch {}
  }
}

// Read the built index.html and extract asset URLs
const html = readFileSync(resolve(dist, "index.html"), "utf-8");

const assetUrls = [];
const scriptRe = /<script[^>]+src="([^"]+)"[^>]*>/gi;
const styleRe = /<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"[^>]*>/gi;

let m;
while ((m = scriptRe.exec(html)) !== null) {
  const url = m[1];
  if (url.startsWith("/assets/")) assetUrls.push(url);
}
while ((m = styleRe.exec(html)) !== null) {
  const url = m[1];
  if (url.startsWith("/assets/")) assetUrls.push(url);
}

if (!assetUrls.length) {
  console.log("inject-sw-cache: no asset URLs found in index.html, skipping");
  process.exit(0);
}

assetUrls.sort();

const indent = "        ";
const allEntries = [...baseEntries, ...assetUrls];
const entriesStr = allEntries
  .map((url) => `${indent}"${url}"`)
  .join(",\n");

// Read dist/sw.js and replace cache.addAll entirely
const swPath = resolve(dist, "sw.js");
let sw = readFileSync(swPath, "utf-8");

const addAllRe = /(cache\.addAll\s*\(\s*\[)[\s\S]*?(\]\s*\))/;
const match = sw.match(addAllRe);
if (!match) {
  console.log("inject-sw-cache: could not find cache.addAll([...]) in sw.js");
  process.exit(0);
}

try {
  writeFileSync(swPath, sw, "utf-8");
  console.log(`inject-sw-cache: rebuilt cache.addAll with ${allEntries.length} entries (${assetUrls.length} assets)`);
} catch (err) {
  console.warn("inject-sw-cache: could not update sw.js (file locked by active server):", err.message);
}
