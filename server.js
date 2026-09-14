// ============================================================
//  Voicentra Research — Form Backend
//  Receives form submissions from the website and emails them.
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
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

// The address (and name) that appears as the sender. Must be a
// "Verified" sender in your Brevo account (Senders, Domains &
// Dedicated IPs -> Senders).
const FROM_EMAIL = process.env.FROM_EMAIL;
const FROM_NAME = process.env.FROM_NAME || 'Voicentra Website';

// Brevo API key (Brevo dashboard -> SMTP & API -> API Keys & MCP tab).
// NOTE: this is a different key from the SMTP key — Render's free plan
// blocks the SMTP ports (25/465/587) entirely, so we send over Brevo's
// HTTPS API instead, which isn't affected by that restriction.
const BREVO_API_KEY = process.env.BREVO_API_KEY;

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

// ---------- Mail sending (Brevo HTTP API) ----------
if (!BREVO_API_KEY) {
  console.error('❌ BREVO_API_KEY is missing from your environment variables.');
} else {
  console.log('✅ Brevo API key found — ready to send emails.');
}

async function sendEmail({ subject, html, replyTo }) {
  const payload = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: [{ email: TO_EMAIL }],
    cc: CC_EMAIL ? [{ email: CC_EMAIL }] : undefined,
    subject,
    htmlContent: html,
  };

  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Brevo API error (${res.status}): ${errText}`);
  }
}

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

    await sendEmail({
      subject: `Panel Book Request — ${name}`,
      html,
      replyTo: email, // lets you hit "Reply" and answer the requester directly
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

    await sendEmail({
      subject: `Join Us Application — ${name}`,
      html,
      replyTo: email,
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

    await sendEmail({
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
