const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../data/db");
const { sendBookingConfirmationEmail } = require("../services/notificationService");

router.get("/", (req, res) => {
  const { driverId, ownerId } = req.query;
  const db = readDb();
  let bookings = db.bookings || [];

  if (driverId) {
    bookings = bookings.filter((b) => String(b.driverId) === String(driverId));
  }
  if (ownerId) {
    bookings = bookings.filter((b) => String(b.ownerId) === String(ownerId));
  }

  res.json(bookings);
});

router.post("/", async (req, res) => {
  const db = readDb();
  const bookings = db.bookings || [];

  const bookingDateVal = req.body.date || req.body.bookingDate;
  const todayIso = new Date().toISOString().split("T")[0];
  if (bookingDateVal && bookingDateVal < todayIso) {
    return res.status(400).json({ error: "Cannot book parking for past dates." });
  }

  const count = bookings.length + 1;
  const bookingId = "BK-" + String(count).padStart(3, "0");

  const slotIndex = (db.slots || []).findIndex((s) => s.id === req.body.slotId || s.slotId === req.body.slotId);
  if (slotIndex >= 0) {
    const currentAvailable = Number(db.slots[slotIndex].available || 0);
    const nextAvailable = Math.max(currentAvailable - 1, 0);
    db.slots[slotIndex].available = nextAvailable;
    db.slots[slotIndex].availableSlots = nextAvailable;
    db.slots[slotIndex].availabilityStatus = nextAvailable > 0 ? "available" : "unavailable";
  }

  const newBooking = {
    id: bookingId,
    bookingId,
    displayId: bookingId,
    slotId: req.body.slotId || "",
    slot: req.body.slot || "Parking Slot",
    driverId: req.body.driverId || "",
    driver: req.body.driver || "Driver",
    bookingDate: req.body.date || req.body.bookingDate || new Date().toISOString().split("T")[0],
    date: req.body.date || req.body.bookingDate || new Date().toISOString().split("T")[0],
    startTime: req.body.time || req.body.startTime || "10:00",
    time: req.body.time || req.body.startTime || "10:00",
    endTime: req.body.endTime || "12:00",
    amount: Number(req.body.amount || 0),
    status: req.body.status || "paid",
    paymentMode: req.body.paymentMode || "UPI",
    vehicleNumber: req.body.vehicleNumber || "KA 01 AB 1234",
    vehicleType: req.body.vehicleType || "Car",
    ownerId: req.body.ownerId || (slotIndex >= 0 ? db.slots[slotIndex].ownerId : "USR-002"),
    createdAt: new Date().toISOString()
  };

  bookings.unshift(newBooking);
  db.bookings = bookings;
  writeDb(db);

  // Trigger email notification asynchronously
  sendBookingConfirmationEmail(newBooking).catch((err) => {
    console.warn("[Bookings] Failed to trigger email:", err.message);
  });

  res.status(201).json(newBooking);
});

router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  const db = readDb();
  const index = (db.bookings || []).findIndex((b) => b.id === req.params.id || b.bookingId === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Booking not found" });

  const normalized = String(status || "").toLowerCase();
  const prevStatus = db.bookings[index].status;
  db.bookings[index].status = normalized;

  // If cancelling, restore slot capacity and mark payments refunded
  if (normalized === "cancelled" && prevStatus !== "cancelled") {
    const slotId = db.bookings[index].slotId;
    const slotIndex = (db.slots || []).findIndex((s) => s.id === slotId || s.slotId === slotId);
    if (slotIndex >= 0) {
      const total = Number(db.slots[slotIndex].total || 1);
      const nextAvailable = Math.min(Number(db.slots[slotIndex].available || 0) + 1, total);
      db.slots[slotIndex].available = nextAvailable;
      db.slots[slotIndex].availableSlots = nextAvailable;
      db.slots[slotIndex].availabilityStatus = "available";
    }
    const targetBookingId = db.bookings[index].id || db.bookings[index].bookingId;
    (db.payments || []).forEach((p) => {
      if (p.bookingId === targetBookingId) {
        p.status = "refunded";
        p.paymentStatus = "refunded";
      }
    });
  }

  writeDb(db);
  res.json(db.bookings[index]);
});

router.delete("/clear/cancelled", (req, res) => {
  const db = readDb();
  const cancelledIds = new Set((db.bookings || []).filter((b) => b.status === "cancelled").map((b) => b.id || b.bookingId));
  db.bookings = (db.bookings || []).filter((b) => b.status !== "cancelled");
  db.payments = (db.payments || []).filter((p) => !cancelledIds.has(p.bookingId) && p.status !== "refunded");
  writeDb(db);
  res.json({ success: true, message: "Cancelled bookings cleared" });
});

router.delete("/:id", (req, res) => {
  const db = readDb();
  const bookings = db.bookings || [];
  const index = bookings.findIndex((b) => b.id === req.params.id || b.bookingId === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Booking not found" });

  const targetBookingId = bookings[index].id || bookings[index].bookingId;
  const removed = bookings.splice(index, 1);
  db.bookings = bookings;
  db.payments = (db.payments || []).filter((p) => p.bookingId !== targetBookingId);
  writeDb(db);
  res.json({ success: true, removed: removed[0] });
});

module.exports = router;
