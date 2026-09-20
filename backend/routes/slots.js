const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../data/db");

router.get("/", (req, res) => {
  const { location, vehicle, maxPrice, adminOnly, ownerId, publicOnly } = req.query;
  const db = readDb();
  let slots = db.slots || [];

  if (ownerId) {
    slots = slots.filter((slot) => String(slot.ownerId) === String(ownerId));
  }

  if (adminOnly === "true") {
    return res.json(slots);
  }

  if (publicOnly === "true" || (!adminOnly && !ownerId)) {
    slots = slots.filter((slot) => {
      const verification = String(slot.verificationStatus || slot.status).toLowerCase();
      const availability = String(slot.availabilityStatus || slot.status).toLowerCase();
      const available = Number(slot.available ?? slot.availableSlots ?? 0);
      return verification === "approved" && availability !== "unavailable" && available > 0;
    });
  }

  if (location) {
    const term = location.toLowerCase().trim();
    slots = slots.filter((slot) => {
      const haystack = (slot.name + " " + slot.location + " " + slot.address).toLowerCase();
      return haystack.includes(term);
    });
  }

  if (vehicle) {
    const vType = vehicle.toLowerCase().trim();
    slots = slots.filter((slot) => String(slot.vehicleType || slot.vehicle).toLowerCase() === vType);
  }

  if (maxPrice) {
    const limit = Number(maxPrice);
    if (!isNaN(limit)) {
      slots = slots.filter((slot) => Number(slot.price || 0) <= limit);
    }
  }

  res.json(slots);
});

router.get("/:id", (req, res) => {
  const db = readDb();
  const slot = (db.slots || []).find((s) => s.id === req.params.id || s.slotId === req.params.id);
  if (!slot) return res.status(404).json({ error: "Parking slot not found" });
  res.json(slot);
});

router.post("/", (req, res) => {
  const db = readDb();
  const slots = db.slots || [];
  const count = slots.length + 1;
  const slotId = "SL-" + String(count).padStart(3, "0");

  const newSlot = {
    id: slotId,
    slotId,
    displayId: slotId,
    name: req.body.name || "Parking Slot",
    location: req.body.location || req.body.address || "Bengaluru",
    address: req.body.address || req.body.location || "",
    lat: Number(req.body.lat) || 12.9716 + (Math.random() - 0.5) * 0.05,
    lng: Number(req.body.lng) || 77.5946 + (Math.random() - 0.5) * 0.05,
    price: Number(req.body.price) || 40,
    pricePerHour: Number(req.body.price) || 40,
    vehicle: req.body.vehicle || req.body.vehicleType || "Car",
    vehicleType: req.body.vehicleType || req.body.vehicle || "Car",
    total: Number(req.body.total) || 10,
    totalSlots: Number(req.body.total) || 10,
    available: Number(req.body.total) || 10,
    availableSlots: Number(req.body.total) || 10,
    open: req.body.open || "06:00",
    close: req.body.close || "23:00",
    ownerId: req.body.ownerId || "USR-002",
    owner: req.body.owner || "Parking Owner",
    imageUrl: req.body.imageUrl || "",
    status: "pending",
    verificationStatus: "pending",
    availabilityStatus: "unavailable",
    rating: 5.0,
    features: ["CCTV", "Covered Parking"]
  };

  slots.unshift(newSlot);
  db.slots = slots;
  writeDb(db);

  res.status(201).json(newSlot);
});

router.put("/:id", (req, res) => {
  const db = readDb();
  const index = (db.slots || []).findIndex((s) => s.id === req.params.id || s.slotId === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Parking slot not found" });

  const existing = db.slots[index];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,
    slotId: existing.slotId
  };

  db.slots[index] = updated;
  writeDb(db);
  res.json(updated);
});

router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  const db = readDb();
  const index = (db.slots || []).findIndex((s) => s.id === req.params.id || s.slotId === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Parking slot not found" });

  const normalized = String(status || "").toLowerCase();
  db.slots[index].status = normalized;
  db.slots[index].verificationStatus = normalized;
  db.slots[index].availabilityStatus = normalized === "approved" ? "available" : "unavailable";

  writeDb(db);
  res.json(db.slots[index]);
});

router.delete("/:id", (req, res) => {
  const db = readDb();
  const initialCount = (db.slots || []).length;
  db.slots = (db.slots || []).filter((s) => s.id !== req.params.id && s.slotId !== req.params.id);

  if (db.slots.length === initialCount) {
    return res.status(404).json({ error: "Parking slot not found" });
  }

  writeDb(db);
  res.json({ success: true, message: "Slot deleted" });
});

module.exports = router;
