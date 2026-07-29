// mailer.js - sends email notifications (new submissions, status updates).
// If SMTP isn't configured in .env, this silently logs instead of throwing,
// so the rest of the app (saving data, showing progress) keeps working
// even before email is set up.

const nodemailer = require("nodemailer");

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP not configured - skipped email to ${to}: ${subject}`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] failed to send email:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendMail, isConfigured };
