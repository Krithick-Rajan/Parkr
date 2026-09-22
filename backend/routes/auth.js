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
  const { name, email, phone, role, vehicle, business, password } = req.body;
  const db = readDb();
  const users = db.users || [];

  const existingIndex = users.findIndex((u) => u.email && u.email.toLowerCase() === (email || "").toLowerCase());
  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      name: name || users[existingIndex].name,
      phone: phone || users[existingIndex].phone,
      role: role || users[existingIndex].role,
      password: password || users[existingIndex].password || ""
    };
    writeDb(db);
    return res.status(200).json(users[existingIndex]);
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
    password: password || "",
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
  const { email, password, role } = req.body;
  const db = readDb();
  const users = db.users || [];

  const user = users.find((u) => u.email && u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "No account found with this email. Please register first." });
  }

  if (user.password && password && user.password !== password) {
    return res.status(401).json({ error: "Incorrect password. Please try again." });
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
