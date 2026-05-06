const fs = require("fs");
const { google } = require("googleapis");

const SCOPES = ["https://mail.google.com/"];
const CREDENTIALS_PATH = "../config/client_secret_314896684691-r4om26tlvkr6t7e7cq5p5sbj8e6kvn4b.apps.googleusercontent.com.json";
const TOKEN_PATH = "token.json";

async function main() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("Authorize this app by visiting:", authUrl);

  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question("Enter the code from that page here: ", async (code) => {
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log("✅ Token stored to", TOKEN_PATH);
    readline.close();
  });
}

main().catch(console.error);
