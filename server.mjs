#!/usr/bin/env node
// Local-only pattern bench. Binds to 127.0.0.1 and is not part of the Next site.
// Patterns here are our own drawings. Do not vendor Book of Shapes source or node graphs.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const HOST = "127.0.0.1";
const PORT = Number(process.argv.find((arg, i, all) => all[i - 1] === "--port") || 4731);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.normalize(path.join(ROOT, relative));
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) return null;
  return resolved;
}

const server = createServer(async (req, res) => {
  if (!req.url || req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }
  const file = fileFor(req.url);
  if (!file) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(file);
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Pattern bench at http://${HOST}:${PORT}`);
});
