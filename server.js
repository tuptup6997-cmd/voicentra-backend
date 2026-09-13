// ============================================================
//  Voicentra Research — Form Backend
//  Receives form submissions from the website and emails them.
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();

// ---------- Config (from .env) ----------
const PORT = process.env.PORT || 3000;

// Comma-separated list of domains allowed to call this API.
// Example: "https://voicentraresearch.com,https://www.voicentraresearch.com"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Where every submission should land, no matter which page it came from.
const TO_EMAIL = process.env.TO_EMAIL || 'info@voicentraresearch.com';
const CC_EMAIL = process.env.CC_EMAIL || 'voicentraresearch@gmail.com';

// The address that appears as the sender in the actual email.
// With some providers (like Brevo) the SMTP login isn't a real inbox,
// so this is kept separate. Falls back to SMTP_USER if not set,
// which keeps this working the same as before for Gmail setups.
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;

// ---------- Middleware ----------
app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow tools like curl/Postman (no origin header) and any origin
      // when ALLOWED_ORIGINS is "*".
      if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);

// Basic abuse protection: max 10 submissions per 15 minutes per IP.
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions. Please try again later.' },
});

// ---------- Mail transport ----------
// Works with Gmail (App Password), or any SMTP provider
// (Zoho, Brevo, Resend, SendGrid, your hosting's SMTP, etc.)
// Just change the values in .env — this code doesn't need to change.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,           // e.g. smtp.gmail.com
  port: Number(process.env.SMTP_PORT),   // 465 (SSL) or 587 (TLS)
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,         // the mailbox that SENDS the email
    pass: process.env.SMTP_PASS,         // app password / SMTP password
  },
});

// Verify SMTP connection on startup so misconfiguration fails loudly.
transporter.verify((err) => {
  if (err) {
    console.error('❌ SMTP connection failed:', err.message);
    console.error('   Check SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS in .env');
  } else {
    console.log('✅ SMTP connection is ready to send emails.');
  }
});

// ---------- Helpers ----------
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(title, fields) {
  const rows = fields
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#211A33;background:#F6F3FB;border:1px solid #E7E1F2;white-space:nowrap;">${escapeHtml(
            label
          )}</td>
          <td style="padding:10px 14px;color:#211A33;border:1px solid #E7E1F2;">${escapeHtml(
            value || '—'
          )}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#211A33;margin-bottom:6px;">${escapeHtml(title)}</h2>
      <p style="color:#665D7D;margin-top:0;">Submitted from the Voicentra Research website.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:16px;">
        ${rows}
      </table>
    </div>
  `;
}

// ---------- Routes ----------

// Health check — useful for confirming the server is alive after deploying.
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Voicentra backend is running.' });
});

// Panel Book request form (panel-book.html)
app.post('/api/panel-book', formLimiter, async (req, res) => {
  try {
    const { name, email, phone, country, referral } = req.body || {};

    if (!name || !email || !phone) {
      return res.status(400).json({ ok: false, error: 'Name, email, and phone are required.' });
    }

    const html = buildEmailHtml('New Panel Book Request', [
      ['Full Name', name],
      ['Email Address', email],
      ['Phone No.', phone],
      ['Country', country],
      ['Referred Via', referral],
    ]);

    await transporter.sendMail({
      from: `"Voicentra Website" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      cc: CC_EMAIL,
      replyTo: email, // lets you hit "Reply" and answer the requester directly
      subject: `Panel Book Request — ${name}`,
      html,
    });

    return res.json({ ok: true, message: 'Request sent successfully.' });
  } catch (err) {
    console.error('Error sending panel book email:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong sending your request.' });
  }
});

// Join Us application form (join-us.html) — bonus endpoint, same pattern.
app.post('/api/join-us', formLimiter, async (req, res) => {
  try {
    const { name, email, phone, position, experience, department, message } = req.body || {};

    if (!name || !email || !phone || !position || !message) {
      return res.status(400).json({ ok: false, error: 'Please fill in all required fields.' });
    }

    const html = buildEmailHtml('New Join Us Application', [
      ['Full Name', name],
      ['Email Address', email],
      ['Contact Number', phone],
      ['Position Applying For', position],
      ['Experience Level', experience],
      ['Department / Interest', department],
      ['Message', message],
    ]);

    await transporter.sendMail({
      from: `"Voicentra Website" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      cc: CC_EMAIL,
      replyTo: email,
      subject: `Join Us Application — ${name}`,
      html,
    });

    return res.json({ ok: true, message: 'Application sent successfully.' });
  } catch (err) {
    console.error('Error sending join-us email:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong sending your application.' });
  }
});

// Book a Career Chat button (join-us.html) — no form fields, just a click.
app.post('/api/career-chat', formLimiter, async (req, res) => {
  try {
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const html = buildEmailHtml('New Career Chat Request', [
      ['Summary', 'Someone visited your website and clicked "Book a Free 30-Minute Career Chat" on the Join Us page.'],
      ['Page', 'Join Us — voicentraresearch.com/join-us.html'],
      ['Date & Time', `${timestamp} IST`],
      ['Contact Details', 'Not collected — this button does not currently ask for a name or email. Reply to this email if you would like that added.'],
    ]);

    await transporter.sendMail({
      from: `"Voicentra Website" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      cc: CC_EMAIL,
      subject: 'New Career Chat Request — Voicentra Website',
      html,
    });

    return res.json({ ok: true, message: 'Notification sent.' });
  } catch (err) {
    console.error('Error sending career-chat email:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong sending the notification.' });
  }
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`🚀 Voicentra backend listening on port ${PORT}`);
});
