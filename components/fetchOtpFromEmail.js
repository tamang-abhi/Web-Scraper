require("dotenv").config();
const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const { google } = require("googleapis");
const fs = require("fs");

async function getAccessToken() {
  const credentials = JSON.parse(fs.readFileSync("../config/client_secret_314896684691-r4om26tlvkr6t7e7cq5p5sbj8e6kvn4b.apps.googleusercontent.com.json"));
  const token = JSON.parse(fs.readFileSync("../config/token.json"));

  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  oAuth2Client.setCredentials(token);

  // refresh if expired
    const { token: accessToken } = await oAuth2Client.getAccessToken();
 // const accessToken = (await oAuth2Client.getAccessToken()).token;
  return accessToken;
}

async function fetchOtpFromEmail() {
  try {
    const accessToken = await getAccessToken();

    const xoauth2 = Buffer.from(
    `user=${process.env.EMAIL_USER}\u0001auth=Bearer ${accessToken}\u0001\u0001`
    ).toString("base64");

    const config = {
      imap: {
        user: process.env.EMAIL_USER, // your Gmail
        //xoauth2: `user=${process.env.EMAIL_USER}\u0001auth=Bearer ${accessToken}\u0001\u0001`,
        xoauth2,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false },
      },
    };

    const connection = await imaps.connect(config);
    await connection.openBox("INBOX");

    const delay = 5 * 60 * 1000;
    const since = new Date(Date.now() - delay);
    const searchCriteria = [["UNSEEN"], ["SINCE", since.toISOString()]];
    const fetchOptions = { bodies: [""], markSeen: true };

    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const item of messages) {
      const all = item.parts.find((part) => part.which === "");
      const parsed = await simpleParser(all.body);

      if (
        parsed.from?.text.includes("no-reply@dealertrack.com") ||
        parsed.subject.includes("One Time Passcode")
      ) {
        const match = parsed.text.match(/\b(\d{6})\b/);
        if (match) {
          await connection.end();
          return match[1];
        }
      }
    }

    await connection.end();
    return null;
  } catch (err) {
    console.error("Error fetching OTP:", err);
    return null;
  }
}

module.exports = fetchOtpFromEmail;

if (require.main === module) {
  fetchOtpFromEmail().then((otp) => {
    if (otp) console.log("✅ OTP found:", otp);
    else console.log("❌ No OTP found");
  });
}