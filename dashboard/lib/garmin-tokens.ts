import fs from 'fs';
import path from 'path';

export interface OAuth1Token {
  oauth_token: string;
  oauth_token_secret: string;
  mfa_token: string | null;
  mfa_expiration_timestamp: string | null;
  domain: string | null;
}

export interface OAuth2Token {
  scope: string;
  jti: string;
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  refresh_token_expires_in: number;
  refresh_token_expires_at: number;
}

export function isOAuth2Expired(token: OAuth2Token): boolean {
  return token.expires_at < Math.floor(Date.now() / 1000);
}

export function isOAuth2RefreshExpired(token: OAuth2Token): boolean {
  return token.refresh_token_expires_at < Math.floor(Date.now() / 1000);
}

export function saveTokens(
  dir: string,
  oauth1: OAuth1Token,
  oauth2: OAuth2Token,
): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'oauth1_token.json'),
    JSON.stringify(oauth1, null, 2),
  );
  fs.writeFileSync(
    path.join(dir, 'oauth2_token.json'),
    JSON.stringify(oauth2, null, 2),
  );
}

export function loadTokens(
  dir: string,
): { oauth1: OAuth1Token; oauth2: OAuth2Token } | null {
  try {
    const oauth1 = JSON.parse(
      fs.readFileSync(path.join(dir, 'oauth1_token.json'), 'utf-8'),
    ) as OAuth1Token;
    const oauth2 = JSON.parse(
      fs.readFileSync(path.join(dir, 'oauth2_token.json'), 'utf-8'),
    ) as OAuth2Token;
    return { oauth1, oauth2 };
  } catch {
    return null;
  }
}

export type AuthStatus = 'authenticated' | 'expired' | 'no_tokens';

export function getAuthStatus(dir: string): AuthStatus {
  const tokens = loadTokens(dir);
  if (!tokens) return 'no_tokens';
  if (isOAuth2RefreshExpired(tokens.oauth2)) return 'expired';
  return 'authenticated';
}
