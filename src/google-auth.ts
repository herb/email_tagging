import { google } from "googleapis";

const fs = require("fs");
const slogger = require("node-slogger");

const google_config = JSON.parse(fs.readFileSync("../config.json")).googleapi;

// where tokens and profile information is persisted
const AUTH_INFO_JSON_PATH = "../auth_info.json";

const scope = ["https://www.googleapis.com/auth/gmail.readonly"];

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

export interface Tokens {
  [key: string]: string;
}

export interface Profile {
  emailAddress: string;
}

export interface PersistedAuthInfo {
  [email: string]: [Tokens, Profile];
}

export function persist_tokens_and_profile(
  req_session: any,
  tokens: any,
  profile: { emailAddress: string }
) {
  let existing_info: PersistedAuthInfo = {};
  if (fs.existsSync(AUTH_INFO_JSON_PATH)) {
    try {
      existing_info = JSON.parse(fs.readFileSync(AUTH_INFO_JSON_PATH));
    } catch (e) {
      slogger.err("unable to read or parse auth info", e);
    }
  }
  let email: string = profile.emailAddress;
  existing_info[email] = [tokens, profile];

  fs.writeFileSync(AUTH_INFO_JSON_PATH, JSON.stringify(existing_info));

  req_session.tokens = JSON.stringify(tokens);
  req_session.profile = JSON.stringify(profile);
}

export function load_persisted_tokens_and_profiles() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_INFO_JSON_PATH));
  } catch (e) {
    slogger.err("unable to read or parse persisted auth info", e);
  }
}
