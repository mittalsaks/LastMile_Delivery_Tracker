// config/mailer.js
// Sends email via the Gmail REST API using OAuth2 — NOT SMTP.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

async function getAccessToken() {
  const { GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, GMAIL_API_REFRESH_TOKEN } = process.env;
  if (!GMAIL_API_CLIENT_ID || !GMAIL_API_CLIENT_SECRET || !GMAIL_API_REFRESH_TOKEN) {
    throw new Error(
      "GMAIL_API_CLIENT_ID / GMAIL_API_CLIENT_SECRET / GMAIL_API_REFRESH_TOKEN are not set — cannot send email"
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_API_CLIENT_ID,
      client_secret: GMAIL_API_CLIENT_SECRET,
      refresh_token: GMAIL_API_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail token refresh failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.access_token;
}

function toBase64Url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawMessage({ from, to, subject, html }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ].join("\r\n");

  return `${headers}\r\n\r\n${html}`;
}

async function sendEmail({ to, subject, html }) {
  const sender = process.env.GMAIL_API_SENDER_EMAIL;
  if (!sender) {
    throw new Error("GMAIL_API_SENDER_EMAIL is not set — cannot send email");
  }

  const accessToken = await getAccessToken();
  const raw = toBase64Url(buildRawMessage({ from: sender, to, subject, html }));

  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail API send failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

module.exports = { sendEmail };