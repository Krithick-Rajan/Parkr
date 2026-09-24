const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../data/db");

router.get("/", (req, res) => {
  const { location, vehicle, maxPrice, adminOnly, ownerId, ownerEmail, publicOnly } = req.query;
  const db = readDb();
  let slots = db.slots || [];

  if (adminOnly === "true" && !ownerId && !ownerEmail) {
    return res.json(slots);
  }

  if (ownerId || ownerEmail) {
    const termId = String(ownerId || "").toLowerCase().trim();
    const termEmail = String(ownerEmail || "").toLowerCase().trim();
    const matched = slots.filter((slot) => {
      const sId = String(slot.ownerId || "").toLowerCase().trim();
      const sEmail = String(slot.ownerEmail || "").toLowerCase().trim();
      const sOwner = String(slot.owner || "").toLowerCase().trim();
      const matchId = termId && (sId === termId || sId.includes(termId) || termId.includes(sId));
      const matchEmail = termEmail && sEmail === termEmail;
      return matchId || matchEmail;
    });

    if (matched.length > 0) {
      slots = matched;
    } else {
      // Fallback: If no exact user-custom slot yet, include slots belonging to default owner or unassigned
      slots = slots.filter((slot) => {
        const sId = String(slot.ownerId || "").toLowerCase().trim();
        const sEmail = String(slot.ownerEmail || "").toLowerCase().trim();
        return sId === "usr-002" || sEmail === "sri@parkr.com" || !sId || sId === "public";
      });
    }
  }

  if (adminOnly === "true") {
    return res.json(slots);
  }

  if (publicOnly === "true" || (!adminOnly && !ownerId && !ownerEmail)) {
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
    if (vType !== "any" && vType !== "any vehicle" && vType !== "all") {
      slots = slots.filter((slot) => {
        const sType = String(slot.vehicleType || slot.vehicle || "").toLowerCase();
        return sType === "any vehicle" || sType === "any" || sType === "all" || sType.includes("any") || sType.includes("both") || sType === vType;
      });
    }
  }

  if (maxPrice) {
    const limit = Number(maxPrice);
    if (!isNaN(limit) && limit < 9999) {
      slots = slots.filter((slot) => Number(slot.price || 0) <= limit);
    }
  }

  res.json(slots);
});

router.get("/:id", (req, res) => {
  const db = readDb();
  const paramId = String(req.params.id || "").toLowerCase();
  const slot = (db.slots || []).find((s) => {
    const sId = String(s.id || "").toLowerCase();
    const sSlotId = String(s.slotId || "").toLowerCase();
    const sDisplayId = String(s.displayId || "").toLowerCase();
    return sId === paramId || sSlotId === paramId || sDisplayId === paramId;
  });
  if (!slot) return res.status(404).json({ error: "Parking slot not found" });
  res.json(slot);
});

router.post("/", (req, res) => {
  const db = readDb();
  const slots = db.slots || [];
  const count = slots.length + 1;
  const slotId = req.body.id || req.body.slotId || ("SL-" + String(count).padStart(3, "0"));

  const lat = (req.body.lat !== undefined && req.body.lat !== null && !isNaN(Number(req.body.lat)))
    ? Number(req.body.lat)
    : 12.9716;
  const lng = (req.body.lng !== undefined && req.body.lng !== null && !isNaN(Number(req.body.lng)))
    ? Number(req.body.lng)
    : 77.5946;

  const newSlot = {
    id: slotId,
    slotId,
    displayId: slotId,
    name: req.body.name || "Parking Slot",
    location: req.body.location || req.body.address || "Bengaluru",
    address: req.body.address || req.body.location || "",
    lat,
    lng,
    price: Number(req.body.price) || 40,
    pricePerHour: Number(req.body.price) || 40,
    vehicle: req.body.vehicle || req.body.vehicleType || "Car",
    vehicleType: req.body.vehicleType || req.body.vehicle || "Car",
    total: Number(req.body.total) || 10,
    totalSlots: Number(req.body.total) || 10,
    available: Number(req.body.available ?? req.body.total) || 10,
    availableSlots: Number(req.body.availableSlots ?? req.body.total) || 10,
    open: req.body.open || "06:00",
    close: req.body.close || "23:00",
    ownerId: req.body.ownerId || "",
    ownerEmail: req.body.ownerEmail || "",
    owner: req.body.owner || "Parking Owner",
    imageUrl: req.body.imageUrl || "",
    status: req.body.status || "pending",
    verificationStatus: req.body.verificationStatus || "pending",
    availabilityStatus: req.body.availabilityStatus || "unavailable",
    rating: Number(req.body.rating) || 5.0,
    features: Array.isArray(req.body.features) ? req.body.features : ["CCTV", "Covered Parking"]
  };

  const existingIdx = slots.findIndex((s) => s.id === slotId || s.slotId === slotId);
  if (existingIdx >= 0) {
    slots[existingIdx] = { ...slots[existingIdx], ...newSlot };
  } else {
    slots.unshift(newSlot);
  }
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

router.get("/:id/reviews", (req, res) => {
  const db = readDb();
  const slotId = req.params.id;
  const reviews = (db.reviews || []).filter((r) => r.slotId === slotId);
  res.json(reviews);
});

router.post("/:id/reviews", (req, res) => {
  const db = readDb();
  const slotId = req.params.id;
  const slotIndex = (db.slots || []).findIndex((s) => s.id === slotId || s.slotId === slotId);
  if (slotIndex < 0) return res.status(404).json({ error: "Parking slot not found" });

  const reviews = db.reviews || [];
  const count = reviews.length + 1;
  const reviewId = "REV-" + String(count).padStart(3, "0");
  const ratingNum = Math.max(1, Math.min(5, Number(req.body.rating) || 5));

  const newReview = {
    id: reviewId,
    reviewId,
    slotId,
    slotName: db.slots[slotIndex].name || "Parking Slot",
    driverId: req.body.driverId || "",
    driverName: req.body.driverName || req.body.driver || "Driver",
    rating: ratingNum,
    comment: req.body.comment || "Great parking spot!",
    createdAt: new Date().toISOString()
  };

  reviews.unshift(newReview);
  db.reviews = reviews;

  // Dynamically calculate average rating from real reviews
  const slotReviews = reviews.filter((r) => r.slotId === slotId);
  const avg = slotReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / slotReviews.length;
  db.slots[slotIndex].rating = Number(avg.toFixed(1));
  db.slots[slotIndex].reviewsCount = slotReviews.length;

  writeDb(db);
  res.status(201).json({ review: newReview, slot: db.slots[slotIndex] });
});

module.exports = router;
