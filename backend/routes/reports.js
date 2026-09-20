const express = require("express");
const router = express.Router();
const { readDb } = require("../data/db");

router.get("/", (req, res) => {
  const db = readDb();
  const users = db.users || [];
  const slots = db.slots || [];
  const bookings = db.bookings || [];
  const payments = db.payments || [];

  const paidBookings = bookings.filter((b) => String(b.status).toLowerCase() === "paid");
  const paidPayments = payments.filter((p) => String(p.paymentStatus || p.status).toLowerCase() === "paid");

  const revenue = paidPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
    || paidBookings.reduce((acc, b) => acc + Number(b.amount || 0), 0);

  const pendingSlots = slots.filter((s) => String(s.verificationStatus || s.status).toLowerCase() === "pending").length;
  const approvedSlots = slots.filter((s) => String(s.verificationStatus || s.status).toLowerCase() === "approved").length;

  res.json({
    users: users.length,
    slots: slots.length,
    bookings: bookings.length,
    revenue,
    pendingSlots,
    approvedSlots,
    paidBookings: paidBookings.length
  });
});

module.exports = router;
