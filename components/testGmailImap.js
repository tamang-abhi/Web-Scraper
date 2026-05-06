require("dotenv").config();
const fs = require("fs");
const { google } = require("googleapis");
const imaps = require("imap-simple");

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

  // Get fresh access token
  const { token: accessToken } = await oAuth2Client.getAccessToken();
  return accessToken;
}

(async () => {
  try {
    const accessToken = await getAccessToken();

    // Gmail XOAUTH2 requires base64 encoding
    const xoauth2 = Buffer.from(
      `user=${process.env.EMAIL_USER}\u0001auth=Bearer ${accessToken}\u0001\u0001`
    ).toString("base64");

    const config = {
      imap: {
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }, // 👈 add this
        xoauth2
      },
    };

    const connection = await imaps.connect(config);
    console.log("✅ Connected successfully to Gmail IMAP with OAuth2!");
    await connection.end();
  } catch (err) {
    console.error("❌ Connection failed:", err);
  }
})();
