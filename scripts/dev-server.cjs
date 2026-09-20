const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5500);
const host = "127.0.0.1";
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function readEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const rows = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  rows.forEach((row) => {
    const trimmed = row.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator < 0) return;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function firebaseConfigScript() {
  const config = {
    apiKey: process.env.PARKR_FIREBASE_API_KEY || "",
    authDomain: process.env.PARKR_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.PARKR_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.PARKR_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.PARKR_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.PARKR_FIREBASE_APP_ID || ""
  };
  return `export const firebaseConfig = ${JSON.stringify(config, null, 2)};\n\nexport const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => {\n  const text = String(value || "");\n  return text && !text.includes("PASTE_") && !text.includes("YOUR_");\n});\n`;
}

function resolveFilePath(targetPath) {
  let resolved = targetPath;
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      const candidates = ["index.html", "dashboard.html"];
      for (const candidate of candidates) {
        const check = path.join(resolved, candidate);
        if (fs.existsSync(check)) {
          return check;
        }
      }
    }
  } catch (error) {
    // Ignore and fallback
  }
  return resolved;
}

readEnvFile();

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  if (pathname === "/firebase/firebase-config.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    response.end(firebaseConfigScript());
    return;
  }

  let filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  filePath = resolveFilePath(filePath);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    response.end(content);
  });
}).listen(port, host, () => {
  console.log(`Parkr dev server running at http://${host}:${port}/`);
});
