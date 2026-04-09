import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";

let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new HttpError(503, "google_auth_not_configured");
  }

  if (!oauthClient) {
    oauthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }

  return oauthClient;
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new HttpError(503, "google_auth_not_configured");
  }

  try {
    const client = getOAuthClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new HttpError(401, "invalid_google_token");
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    throw new HttpError(401, "invalid_google_token");
  }
}
