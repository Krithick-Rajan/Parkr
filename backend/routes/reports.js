const express = require("express");
const router = express.Router();
const { readDb } = require("../data/db");

router.get("/", (req, res) => {
  const db = readDb();
  const users = db.users || [];
  const slots = db.slots || [];
  const bookings = db.bookings || [];
  const payments = db.payments || [];

  const paidBookings = bookings.filter((b) => {
    const s = String(b.status || "").toLowerCase();
    return s === "paid" || s === "completed" || s === "confirmed";
  });

  const revenue = paidBookings.reduce((acc, b) => acc + Number(b.amount || 0), 0);

  const pendingSlots = slots.filter((s) => String(s.verificationStatus || s.status).toLowerCase() === "pending").length;
  const approvedSlots = slots.filter((s) => String(s.verificationStatus || s.status).toLowerCase() === "approved").length;

  res.json({
    users: users.length,
    slots: slots.length,
    bookings: paidBookings.length,
    totalBookings: bookings.length,
    revenue,
    pendingSlots,
    approvedSlots,
    paidBookings: paidBookings.length
  });
});

module.exports = router;
