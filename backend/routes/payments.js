const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { readDb, writeDb } = require("../data/db");

// 1. Create a free test payment order (Zero cost, no trial period, immediate)
router.post("/create-order", (req, res) => {
  const { amount, bookingId, currency } = req.body;
  const orderId = "order_free_" + crypto.randomBytes(6).toString("hex");

  res.json({
    success: true,
    orderId,
    amount: Number(amount || 0),
    currency: currency || "INR",
    mode: "free_test_gateway",
    upiQrData: `upi://pay?pa=parkr.test@upi&pn=Parkr%20Parking&am=${amount}&tr=${orderId}&cu=INR`,
    testCards: [
      { number: "4111 1111 1111 1111", expiry: "12/28", cvv: "123", brand: "Visa Test" }
    ]
  });
});

// 2. Verify payment (UML Conformance: paymentId, amount, paymentStatus: "paid", paymentDate)
router.post("/verify", (req, res) => {
  const { bookingId, amount, paymentMode, paidBy, paidByName, payerRole } = req.body;
  const db = readDb();
  const payments = db.payments || [];
  const count = payments.length + 1;
  const paymentId = "PAY-" + String(count).padStart(3, "0");
  const now = new Date().toISOString();

  const paymentRecord = {
    id: paymentId,
    paymentId,
    displayId: paymentId,
    bookingId: bookingId || "BK-001",
    amount: Number(amount || 0),
    paymentStatus: "paid",
    status: "paid",
    paymentDate: now,
    paymentMode: paymentMode || "UPI",
    paidBy: paidBy || "driver",
    paidByName: paidByName || "Driver",
    payerRole: payerRole || "driver",
    paidAt: now
  };

  payments.unshift(paymentRecord);
  db.payments = payments;

  // Also update matching booking status to paid if bookingId matches
  if (bookingId) {
    const bookingIndex = (db.bookings || []).findIndex((b) => b.id === bookingId || b.bookingId === bookingId);
    if (bookingIndex >= 0) {
      db.bookings[bookingIndex].status = "paid";
      db.bookings[bookingIndex].paymentId = paymentId;
      db.bookings[bookingIndex].paymentMode = paymentMode || "UPI";
      db.bookings[bookingIndex].paidAt = now;
    }
  }

  writeDb(db);

  res.json({
    success: true,
    status: "paid",
    message: "Payment processed and verified successfully",
    payment: paymentRecord
  });
});

// 3. List all payments for Admin / Reporting
router.get("/", (req, res) => {
  const db = readDb();
  res.json(db.payments || []);
});

module.exports = router;
