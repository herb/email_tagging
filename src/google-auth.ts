import { google } from "googleapis";

const fs = require("fs");

const google_config = JSON.parse(fs.readFileSync("../config.json")).googleapi;

const scope = [
  "https://www.googleapis.com/auth/gmail.readonly"
];

function create_connection() {
  return new google.auth.OAuth2(
    google_config.client_id,
    google_config.client_secret,
    google_config.client_callback_url
  );
}

// generate oauth redirect URL
export function get_google_url() {
  const auth = create_connection();
  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scope
  });
}

export async function get_oauth_tokens_from_code(code: string) {
  const auth = create_connection();
  const data = await auth.getToken(code);

  return data.tokens;
}

export function get_gmail_client(tokens: any) {
  const auth = create_connection();
  auth.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth });

  return gmail;
}
