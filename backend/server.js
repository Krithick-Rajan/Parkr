const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Load .env
const rootDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });

const app = express();
const PORT = Number(process.env.PORT || 5500);

// Middleware
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// 1. Dynamic Firebase configuration endpoint
app.get("/firebase/firebase-config.js", (req, res) => {
  const config = {
    apiKey: process.env.PARKR_FIREBASE_API_KEY || "",
    authDomain: process.env.PARKR_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.PARKR_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.PARKR_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.PARKR_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.PARKR_FIREBASE_APP_ID || ""
  };

  const script = `export const firebaseConfig = ${JSON.stringify(config, null, 2)};\n\nexport const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => {\n  const text = String(value || "");\n  return text && !text.includes("PASTE_") && !text.includes("YOUR_");\n});\n`;

  res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(script);
});

// 2. Mount API Routes
app.use("/api/slots", require("./routes/slots"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/auth", require("./routes/auth"));

// 3. Health & Status
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Parkr Backend API",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 4. Serve Static Frontend Files with Fast Caching
app.use(express.static(rootDir, {
  extensions: ["html"],
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
    } else if (/\.(png|jpg|jpeg|svg|webp|woff2|woff|ttf)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  }
}));

// Fallback index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

// Start Server
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`========================================`);
    console.log(`  Parkr Express Server Running!        `);
    console.log(`  Local URL:  http://127.0.0.1:${PORT}/ `);
    console.log(`  API Routes: http://127.0.0.1:${PORT}/api/`);
    console.log(`========================================`);
  });
}

module.exports = app;
