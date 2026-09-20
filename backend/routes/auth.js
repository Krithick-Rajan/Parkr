const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../data/db");

router.get("/users", (req, res) => {
  const db = readDb();
  res.json(db.users || []);
});

// Dynamic role lookup endpoint for any user
router.get("/lookup", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email parameter is required" });
  const db = readDb();
  const users = db.users || [];
  const user = users.find((u) => u.email && u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (user) {
    return res.json({ found: true, role: user.role, name: user.name });
  }
  return res.json({ found: false });
});

router.post("/register", (req, res) => {
  const { name, email, phone, role, vehicle, business } = req.body;
  const db = readDb();
  const users = db.users || [];

  const existing = users.find((u) => u.email && u.email.toLowerCase() === (email || "").toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const count = users.length + 1;
  const userId = "USR-" + String(count).padStart(3, "0");

  const newUser = {
    id: userId,
    userId,
    displayId: userId,
    name: name || "Parkr User",
    email: (email || "").toLowerCase(),
    phone: phone || "",
    role: role || "driver",
    status: "approved",
    vehicle: vehicle || "",
    business: business || "",
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  db.users = users;
  writeDb(db);

  res.status(201).json(newUser);
});

router.post("/login", (req, res) => {
  const { email, role } = req.body;
  const db = readDb();
  const users = db.users || [];

  const user = users.find((u) => u.email && u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) {
    // If not found in mock db, create a session user for seamless testing
    const fallbackUser = {
      id: "USR-" + String(users.length + 1).padStart(3, "0"),
      userId: "USR-" + String(users.length + 1).padStart(3, "0"),
      displayId: "USR-" + String(users.length + 1).padStart(3, "0"),
      name: (email || "").split("@")[0] || "User",
      email: (email || "").toLowerCase(),
      role: role || "driver",
      status: "approved"
    };
    users.push(fallbackUser);
    db.users = users;
    writeDb(db);
    return res.json(fallbackUser);
  }

  res.json(user);
});

router.patch("/users/:id/status", (req, res) => {
  const { status } = req.body;
  const db = readDb();
  const index = (db.users || []).findIndex((u) => u.id === req.params.id || u.userId === req.params.id);
  if (index < 0) return res.status(404).json({ error: "User not found" });

  db.users[index].status = String(status || "approved").toLowerCase();
  writeDb(db);
  res.json(db.users[index]);
});

router.delete("/users/:id", (req, res) => {
  const db = readDb();
  const initialCount = (db.users || []).length;
  db.users = (db.users || []).filter((u) => u.id !== req.params.id && u.userId !== req.params.id);

  if (db.users.length === initialCount) {
    return res.status(404).json({ error: "User not found" });
  }

  writeDb(db);
  res.json({ success: true, message: "User deleted" });
});

module.exports = router;
