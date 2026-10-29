// Serve course files without exposing the repository, credentials, or lab solutions.
import { readFile, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

export async function createCourseServer(directory) {
  const root = await realpath(directory);
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("Invalid path");
      return;
    }
    // The HTTP path is untrusted; dot paths and backslashes are not course resources.
    if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").some((part) => part.startsWith("."))) {
      response.writeHead(404).end();
      return;
    }

    try {
      const target = await realpath(resolve(root, `.${pathname}${pathname.endsWith("/") ? "index.html" : ""}`));
      const localPath = relative(root, target);
      // A symlink in site/ must not make repository files reachable over HTTP.
      if (isAbsolute(localPath) || localPath === ".." || localPath.startsWith(`..${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(target);
      response.writeHead(200, {
        "Content-Type": contentTypes[extname(target)] ?? "application/octet-stream",
        "Content-Length": body.length,
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      const missing = ["ENOENT", "ENOTDIR", "EISDIR", "EACCES"].includes(error.code);
      response.writeHead(missing ? 404 : 500).end();
    }
  });
}
