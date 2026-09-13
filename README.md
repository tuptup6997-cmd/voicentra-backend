# Voicentra Website Backend — Setup Guide

This is a small backend server that receives your website's form
submissions (Panel Book request, Join Us application) and emails them
straight to your inbox automatically — no email client popup, no
manual "hit send" step.

It's built with **Node.js + Express + Nodemailer**.

---

## 1. What you need before starting

- **Node.js** installed on your computer (or hosting server).
  Download it from https://nodejs.org (get the "LTS" version).
- An email account to send FROM. Easiest option: a Gmail account
  with an **App Password** (instructions below). You can still
  receive the emails at `info@voicentraresearch.com` and
  `voicentraresearch@gmail.com` — the Gmail account is just the
  "postman" that sends them.

---

## 2. Get a Gmail App Password (5 minutes, one-time)

Gmail won't let regular scripts log in with your normal password —
you need an "App Password" instead.

1. Go to https://myaccount.google.com/security
2. Turn on **2-Step Verification** if it isn't already on (required
   for App Passwords to work).
3. Go to https://myaccount.google.com/apppasswords
4. Create a new App Password — name it something like "Voicentra Website".
5. Google will show you a 16-character password like `abcd efgh ijkl mnop`.
   Copy it — you'll paste it into `.env` in the next step.

> You can use `voicentraresearch@gmail.com` itself as the sending
> account, or any other Gmail address you control. If you'd rather
> use a different email provider (Zoho, Outlook, your web host's
> email, etc.) that also works — see the "Other email providers"
> section near the bottom.

---

## 3. Set up the project

1. Download/copy this whole `backend` folder onto your computer or server.
2. Open a terminal inside the `backend` folder.
3. Install the dependencies:

   ```bash
   npm install
   ```

4. Create your real config file by copying the example:

   ```bash
   cp .env.example .env
   ```

5. Open `.env` in a text editor and fill in:

   ```
   PORT=3000
   ALLOWED_ORIGINS=*
   TO_EMAIL=info@voicentraresearch.com
   CC_EMAIL=voicentraresearch@gmail.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your-sending-address@gmail.com
   SMTP_PASS=abcdefghijklmnop   <-- the App Password from step 2, no spaces
   ```

---

## 4. Run it locally to test

```bash
npm start
```

You should see:

```
✅ SMTP connection is ready to send emails.
🚀 Voicentra backend listening on port 3000
```

If you instead see `❌ SMTP connection failed`, double-check
`SMTP_USER` and `SMTP_PASS` in `.env`.

Test it with curl (or Postman):

```bash
curl -X POST http://localhost:3000/api/panel-book \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"9999999999","country":"India","referral":"Search Engine"}'
```

Check the inbox at `info@voicentraresearch.com` (and the CC at
`voicentraresearch@gmail.com`) — you should receive a nicely
formatted email within a few seconds.

---

## 5. Put it online (so your real website can reach it)

Your live website (on its own hosting) needs to call this backend
over the internet, so it needs to be deployed somewhere with a public
URL. The easiest free option is **Render**:

1. Push this `backend` folder to a GitHub repository.
2. Go to https://render.com and sign up (free).
3. Click **New +** → **Web Service** → connect your GitHub repo.
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment**, add each value from your `.env` file as an
   environment variable (PORT, ALLOWED_ORIGINS, TO_EMAIL, CC_EMAIL,
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
6. Click **Deploy**. Render will give you a live URL like:

   ```
   https://voicentra-backend.onrender.com
   ```

7. Once it's live, set `ALLOWED_ORIGINS` to your real website domain
   (e.g. `https://voicentraresearch.com`) instead of `*`, so random
   sites can't use your backend.

(Railway, Fly.io, or your own VPS with `pm2` work the same way if
you'd rather use one of those instead of Render.)

---

## 6. Point the website form at your live backend

In `panel-book.html`, find this line near the top of the submit
handler script and replace the placeholder URL with your real
deployed URL from step 5:

```js
const BACKEND_URL = 'https://voicentra-backend.onrender.com/api/panel-book';
```

That's it — once both the backend is deployed and this URL is
updated, clicking **"Get It Now"** will send the request straight to
your inbox with no popup and no manual step.

---

## Other email providers (instead of Gmail)

Just change the SMTP values in `.env` — nothing else in the code
needs to change.

| Provider | SMTP_HOST | SMTP_PORT |
|---|---|---|
| Gmail | smtp.gmail.com | 465 |
| Outlook / Microsoft 365 | smtp.office365.com | 587 |
| Zoho Mail | smtp.zoho.com | 465 |
| Brevo (Sendinblue) | smtp-relay.brevo.com | 587 |
| Your web hosting's email | (ask your host) | usually 465 or 587 |

---

## Notes

- The backend includes basic rate-limiting (max 10 submissions per
  15 minutes per visitor) to reduce spam/abuse.
- A `/api/join-us` endpoint is also included, built the same way, so
  you can wire up the Join Us application form the same manner later.
- Never commit your real `.env` file (with real passwords) to a
  public GitHub repository — only commit `.env.example`.
