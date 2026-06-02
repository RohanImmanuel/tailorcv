import { google } from "googleapis";
import { createServer } from "http";
import { URL } from "url";
import chalk from "chalk";
import open from "open";
import { loadConfig, updateConfig, type GoogleToken } from "./config.js";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
];

const REDIRECT_URI = "http://localhost:3141/oauth/callback";

// Read lazily inside the function so dotenv has already loaded by call time.
// For distribution: replace the fallback strings with your baked-in credentials.
export function getOAuthClient() {
  const clientId     = process.env.GOOGLE_CLIENT_ID     ?? "YOUR_CLIENT_ID";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "YOUR_CLIENT_SECRET";
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

export async function getAuthenticatedClient() {
  const config = loadConfig();

  const oauth2 = getOAuthClient();

  if (config.google_token) {
    oauth2.setCredentials(config.google_token);

    // refresh if expired
    const expiry = config.google_token.expiry_date;
    if (expiry && Date.now() > expiry - 60_000) {
      const { credentials } = await oauth2.refreshAccessToken();
      updateConfig({ google_token: credentials as GoogleToken });
      oauth2.setCredentials(credentials);
    }

    return oauth2;
  }

  return null;
}

export async function runOAuthFlow(): Promise<void> {
  const oauth2 = getOAuthClient();

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log(`\n${chalk.bold("Open this URL in your browser to connect Google Drive:")}\n`);
  console.log(chalk.cyan(authUrl));
  console.log(chalk.dim("\nWaiting for authorisation...\n"));

  await open(authUrl);

  // local callback server
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, "http://localhost:3141");
      const code = url.searchParams.get("code");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html><body style="font-family:sans-serif;padding:40px;text-align:center">
            <h2>✓ Connected</h2>
            <p>You can close this tab and return to the terminal.</p>
          </body></html>
        `);
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end("Missing code");
        reject(new Error("OAuth callback missing code"));
      }
    });

    server.listen(3141, "localhost");
    server.on("error", reject);
  });

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  updateConfig({ google_token: tokens as GoogleToken });
}
