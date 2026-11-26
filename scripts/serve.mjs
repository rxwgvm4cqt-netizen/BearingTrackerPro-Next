import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const port = Number(process.env.PORT ?? 4174);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".webmanifest": "application/manifest+json",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const path = resolve(
      root,
      "." + pathname + (pathname.endsWith("/") ? "index.html" : ""),
    );
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!(await stat(path)).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.on("error", (error) => {
  console.error(
    `Server konnte nicht starten: ${error.message}\nPort ${port}. Alternativ BearingTrackerPro.html direkt öffnen.`,
  );
  process.exitCode = 1;
});
server.listen(port, "0.0.0.0", () => {
  const url = `http://localhost:${port}`;
  console.log(
    `BearingTrackerPro Next: ${url}\nStrg+C beendet den Server. Kamera auf anderen Geräten benötigt HTTPS.`,
  );
  if (process.platform === "darwin" && !process.env.BTP_NO_OPEN)
    spawn("open", [url], { stdio: "ignore" }).on("error", () => {});
});
