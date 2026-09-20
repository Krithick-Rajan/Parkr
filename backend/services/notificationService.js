const nodemailer = require("nodemailer");

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    return cachedTransporter;
  }

  // Fallback: Free zero-setup Ethereal test mail service
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log("[NotificationService] Using free Ethereal test email account:", testAccount.user);
    return cachedTransporter;
  } catch (error) {
    console.warn("[NotificationService] Ethereal fallback failed, using dummy logger transporter:", error.message);
    return null;
  }
}

async function sendBookingConfirmationEmail(booking) {
  const recipient = booking.email || booking.driverEmail || "driver@parkr.test";
  const driverName = booking.driver || booking.driverName || "Driver";
  const slotName = booking.slot || booking.slotName || "Parking Slot";
  const amount = booking.amount || 0;
  const bookingId = booking.bookingId || booking.id || "BK-001";
  const date = booking.date || booking.bookingDate || new Date().toLocaleDateString();
  const paymentMode = booking.paymentMode || "UPI";

  try {
    const transporter = await getTransporter();
    if (!transporter) {
      console.log(`[NotificationService] Simulated Email sent to ${recipient} for Booking #${bookingId}`);
      return { success: true, simulated: true };
    }

    const info = await transporter.sendMail({
      from: '"Parkr Bookings" <no-reply@parkr.com>',
      to: recipient,
      subject: `Booking Confirmed: ${slotName} (ID: ${bookingId})`,
      text: `Hello ${driverName},\n\nYour parking booking #${bookingId} for ${slotName} on ${date} is confirmed.\nAmount Paid: Rs. ${amount} via ${paymentMode}.\n\nThank you for choosing Parkr!`,
      html: `
        <div style="font-family: Arial, sans-serif; background:#0f172a; color:#f8fafc; padding:24px; border-radius:12px;">
          <h2 style="color:#f97316; margin-top:0;">Parking Booking Confirmed!</h2>
          <p>Hello <strong>${driverName}</strong>,</p>
          <p>Your parking reservation has been confirmed and marked paid.</p>
          <div style="background:#1e293b; padding:16px; border-radius:8px; margin:16px 0;">
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Parking Slot:</strong> ${slotName}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Amount Paid:</strong> Rs. ${amount} (${paymentMode})</p>
            <p><strong>Status:</strong> Confirmed / Paid</p>
          </div>
          <p style="color:#94a3b8; font-size:13px;">Please arrive on time. Show your Booking ID to the parking owner if requested.</p>
        </div>
      `
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("[NotificationService] Email preview URL (free test inbox):", previewUrl);
    }
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.warn("[NotificationService] Failed to send email:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendBookingConfirmationEmail
};
