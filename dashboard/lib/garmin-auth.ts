import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import { CookieJar } from 'tough-cookie';
import type { OAuth1Token, OAuth2Token } from './garmin-tokens';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const OAUTH_CONSUMER_URL =
  'https://thegarth.s3.amazonaws.com/oauth_consumer.json';
export const USER_AGENT = 'com.garmin.android.apps.connectmobile';
export const API_USER_AGENT = 'GCM-iOS-5.7.2.1';

const DEFAULT_DOMAIN = 'garmin.com';

// ---------------------------------------------------------------------------
// Cached OAuth consumer credentials
// ---------------------------------------------------------------------------

let cachedConsumer: { consumer_key: string; consumer_secret: string } | null =
  null;

export async function getConsumerCredentials(): Promise<{
  consumer_key: string;
  consumer_secret: string;
}> {
  if (cachedConsumer) return cachedConsumer;
  const resp = await fetch(OAUTH_CONSUMER_URL);
  if (!resp.ok)
    throw new Error(`Failed to fetch OAuth consumer: ${resp.status}`);
  cachedConsumer = (await resp.json()) as {
    consumer_key: string;
    consumer_secret: string;
  };
  return cachedConsumer!;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export function getCsrfToken(html: string): string {
  const m = html.match(/name="_csrf"\s+value="(.+?)"/);
  if (!m) throw new Error('Could not find CSRF token');
  return m[1];
}

export function getTitle(html: string): string {
  const m = html.match(/<title>(.+?)<\/title>/);
  if (!m) throw new Error('Could not find title');
  return m[1];
}

export function parseTicket(html: string): string {
  const m = html.match(/embed\?ticket=([^"]+)"/);
  if (!m) throw new Error('Could not find ticket');
  return m[1];
}

export function setExpirations<
  T extends { expires_in: number; refresh_token_expires_in: number },
>(token: T): T & { expires_at: number; refresh_token_expires_at: number } {
  const now = Math.floor(Date.now() / 1000);
  return {
    ...token,
    expires_at: now + token.expires_in,
    refresh_token_expires_at: now + token.refresh_token_expires_in,
  };
}

// ---------------------------------------------------------------------------
// In-flight SSO session store (for MFA flow)
// ---------------------------------------------------------------------------

interface SsoSession {
  cookies: string; // serialized cookie jar (JSON)
  csrf: string;
  signinParams: Record<string, string>;
  domain: string;
  createdAt: number;
}

const SSO_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ssoSessions = new Map<string, SsoSession>();

function cleanupSsoSessions(): void {
  const now = Date.now();
  for (const [id, session] of ssoSessions) {
    if (now - session.createdAt > SSO_SESSION_TTL_MS) {
      ssoSessions.delete(id);
    }
  }
}

function getSsoSession(sessionId: string): SsoSession {
  cleanupSsoSessions();
  const session = ssoSessions.get(sessionId);
  if (!session) throw new Error('SSO session not found or expired');
  if (Date.now() - session.createdAt > SSO_SESSION_TTL_MS) {
    ssoSessions.delete(sessionId);
    throw new Error('SSO session expired');
  }
  return session;
}

// ---------------------------------------------------------------------------
// Cookie-aware fetch helper
// ---------------------------------------------------------------------------

async function cookieFetch(
  url: string,
  jar: CookieJar,
  init: RequestInit = {},
): Promise<Response> {
  let currentUrl = url;
  let redirectCount = 0;
  const MAX_REDIRECTS = 10;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cookieString = await jar.getCookieString(currentUrl);
    const headers = new Headers(init.headers);
    if (cookieString) headers.set('Cookie', cookieString);
    if (!headers.has('User-Agent')) headers.set('User-Agent', USER_AGENT);

    const resp = await fetch(currentUrl, {
      ...init,
      headers,
      redirect: 'manual',
    });

    // Store cookies from response
    const setCookies = resp.headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      try {
        await jar.setCookie(sc, currentUrl);
      } catch {
        // ignore malformed cookies
      }
    }

    // Follow redirects manually to preserve cookies across hops
    if (
      resp.status >= 300 &&
      resp.status < 400 &&
      resp.headers.has('location')
    ) {
      redirectCount++;
      if (redirectCount > MAX_REDIRECTS) {
        throw new Error('Too many redirects');
      }
      const location = resp.headers.get('location')!;
      currentUrl = new URL(location, currentUrl).href;
      // Redirects always become GET requests
      init = { ...init, method: 'GET', body: undefined };
      continue;
    }

    return resp;
  }
}

// ---------------------------------------------------------------------------
// OAuth1 signing helper
// ---------------------------------------------------------------------------

function createOAuth1(consumer: {
  consumer_key: string;
  consumer_secret: string;
}): OAuth {
  return new OAuth({
    consumer: { key: consumer.consumer_key, secret: consumer.consumer_secret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString: string, key: string) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

// ---------------------------------------------------------------------------
// Retry helper for rate-limited requests
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  fn: () => Promise<Response>,
  maxRetries: number = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fn();
    if (resp.status === 429 && attempt < maxRetries) {
      const retryAfter = resp.headers.get('retry-after');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(2000 * Math.pow(2, attempt), 15000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    return resp;
  }
  throw new Error('Unreachable');
}

// ---------------------------------------------------------------------------
// Internal: get OAuth1 token from ticket
// ---------------------------------------------------------------------------

async function getOAuth1Token(
  ticket: string,
  domain: string,
  cookieJar: CookieJar,
): Promise<OAuth1Token> {
  const consumer = await getConsumerCredentials();
  const oauth = createOAuth1(consumer);

  const url =
    `https://connectapi.${domain}/oauth-service/oauth/preauthorized` +
    `?ticket=${encodeURIComponent(ticket)}` +
    `&login-url=https://sso.${domain}/sso/embed` +
    `&accepts-mfa-tokens=true`;

  const requestData = { url, method: 'GET' };
  const authHeader = oauth.toHeader(oauth.authorize(requestData));

  const resp = await fetchWithRetry(() =>
    cookieFetch(url, cookieJar, {
      method: 'GET',
      headers: {
        ...authHeader,
        'User-Agent': USER_AGENT,
      },
    }),
  );

  if (!resp.ok) throw new Error(`OAuth1 token request failed: ${resp.status}`);

  const text = await resp.text();
  const params = new URLSearchParams(text);

  return {
    oauth_token: params.get('oauth_token') ?? '',
    oauth_token_secret: params.get('oauth_token_secret') ?? '',
    mfa_token: params.get('mfa_token') || null,
    mfa_expiration_timestamp: params.get('mfa_expiration_timestamp') || null,
    domain,
  };
}

// ---------------------------------------------------------------------------
// Exchange OAuth1 for OAuth2
// ---------------------------------------------------------------------------

export async function exchangeOAuth1ForOAuth2(
  oauth1: OAuth1Token,
  domain?: string,
): Promise<OAuth2Token> {
  const effectiveDomain = domain ?? oauth1.domain ?? DEFAULT_DOMAIN;
  const consumer = await getConsumerCredentials();
  const oauth = createOAuth1(consumer);

  const url = `https://connectapi.${effectiveDomain}/oauth-service/oauth/exchange/user/2.0`;

  const body = oauth1.mfa_token
    ? `mfa_token=${encodeURIComponent(oauth1.mfa_token)}`
    : '';

  const requestData = {
    url,
    method: 'POST',
    data: oauth1.mfa_token ? { mfa_token: oauth1.mfa_token } : {},
  };
  const token = {
    key: oauth1.oauth_token,
    secret: oauth1.oauth_token_secret,
  };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  const resp = await fetchWithRetry(() =>
    fetch(url, {
      method: 'POST',
      headers: {
        ...authHeader,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }),
  );

  if (!resp.ok) throw new Error(`OAuth2 exchange failed: ${resp.status}`);

  const json = await resp.json();
  return setExpirations(json) as OAuth2Token;
}

// ---------------------------------------------------------------------------
// Login with credentials
// ---------------------------------------------------------------------------

export type LoginResult =
  | { status: 'mfa_required'; sessionId: string }
  | { status: 'success'; oauth1: OAuth1Token; oauth2: OAuth2Token };

export async function loginWithCredentials(
  email: string,
  password: string,
  domain: string = DEFAULT_DOMAIN,
): Promise<LoginResult> {
  const jar = new CookieJar();

  const SSO_URL = `https://sso.${domain}/sso`;
  const SSO_EMBED_URL = `${SSO_URL}/embed`;

  const embedParams: Record<string, string> = {
    id: 'gauth-widget',
    embedWidget: 'true',
    gauthHost: SSO_URL,
  };

  const signinParams: Record<string, string> = {
    ...embedParams,
    gauthHost: SSO_EMBED_URL,
    service: SSO_EMBED_URL,
    source: SSO_EMBED_URL,
    redirectAfterAccountLoginUrl: SSO_EMBED_URL,
    redirectAfterAccountCreationUrl: SSO_EMBED_URL,
  };

  // Step 1: Set cookies via embed endpoint
  const embedQs = new URLSearchParams(embedParams).toString();
  await cookieFetch(`${SSO_EMBED_URL}?${embedQs}`, jar);

  // Step 2: GET signin page to extract CSRF token
  const signinQs = new URLSearchParams(signinParams).toString();
  const signinResp = await cookieFetch(
    `${SSO_URL}/signin?${signinQs}`,
    jar,
    {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: SSO_EMBED_URL,
      },
    },
  );
  const signinHtml = await signinResp.text();
  const csrf = getCsrfToken(signinHtml);

  // Step 3: POST signin with credentials
  const loginBody = new URLSearchParams({
    username: email,
    password,
    embed: 'true',
    _csrf: csrf,
  }).toString();

  const loginResp = await cookieFetch(
    `${SSO_URL}/signin?${signinQs}`,
    jar,
    {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: SSO_EMBED_URL,
      },
      body: loginBody,
    },
  );
  const loginHtml = await loginResp.text();
  const title = getTitle(loginHtml);

  // Step 4: Handle MFA
  if (title.includes('MFA')) {
    const sessionId = crypto.randomUUID();
    const mfaCsrf = getCsrfToken(loginHtml);
    ssoSessions.set(sessionId, {
      cookies: JSON.stringify(await jar.serialize()),
      csrf: mfaCsrf,
      signinParams,
      domain,
      createdAt: Date.now(),
    });
    return { status: 'mfa_required', sessionId };
  }

  // Step 5: Success — parse ticket and exchange tokens
  if (title !== 'Success') {
    throw new Error(`Unexpected login page title: ${title}`);
  }

  const ticket = parseTicket(loginHtml);
  const oauth1 = await getOAuth1Token(ticket, domain, jar);
  const oauth2 = await exchangeOAuth1ForOAuth2(oauth1, domain);

  return { status: 'success', oauth1, oauth2 };
}

// ---------------------------------------------------------------------------
// Submit MFA code
// ---------------------------------------------------------------------------

export async function submitMfaCode(
  sessionId: string,
  code: string,
): Promise<{ status: 'success'; oauth1: OAuth1Token; oauth2: OAuth2Token }> {
  const session = getSsoSession(sessionId);

  // Reconstruct cookie jar
  const jar = await CookieJar.deserialize(JSON.parse(session.cookies));

  const { domain, csrf, signinParams } = session;
  const SSO_URL = `https://sso.${domain}/sso`;
  const SSO_EMBED_URL = `${SSO_URL}/embed`;

  const qs = new URLSearchParams(signinParams).toString();

  const mfaBody = new URLSearchParams({
    'mfa-code': code,
    embed: 'true',
    _csrf: csrf,
    fromPage: 'setupEnterMfaCode',
  }).toString();

  const mfaResp = await cookieFetch(
    `${SSO_URL}/verifyMFA/loginEnterMfaCode?${qs}`,
    jar,
    {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: SSO_EMBED_URL,
      },
      body: mfaBody,
    },
  );

  const html = await mfaResp.text();
  const title = getTitle(html);

  if (title !== 'Success') {
    throw new Error(`MFA verification failed, got title: ${title}`);
  }

  const ticket = parseTicket(html);
  const oauth1 = await getOAuth1Token(ticket, domain, jar);
  const oauth2 = await exchangeOAuth1ForOAuth2(oauth1, domain);

  // Clean up session
  ssoSessions.delete(sessionId);

  return { status: 'success', oauth1, oauth2 };
}
