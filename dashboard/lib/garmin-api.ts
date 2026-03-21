import { exchangeOAuth1ForOAuth2 } from './garmin-auth';
import {
  type OAuth1Token,
  type OAuth2Token,
  isOAuth2Expired,
  saveTokens,
} from './garmin-tokens';

const API_USER_AGENT = 'GCM-iOS-5.7.2.1';

export function buildAuthHeader(oauth2: OAuth2Token): string {
  return `${oauth2.token_type.charAt(0).toUpperCase() + oauth2.token_type.slice(1)} ${oauth2.access_token}`;
}

export function connectApiUrl(
  path: string,
  domain: string = 'garmin.com',
): string {
  return `https://connectapi.${domain}${path}`;
}

export async function connectApi(
  path: string,
  oauth1: OAuth1Token,
  oauth2: OAuth2Token,
  tokenDir?: string,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any; oauth2: OAuth2Token }> {
  let currentOAuth2 = oauth2;

  if (isOAuth2Expired(currentOAuth2)) {
    const domain = oauth1.domain || 'garmin.com';
    currentOAuth2 = await exchangeOAuth1ForOAuth2(oauth1, domain);
    if (tokenDir) {
      saveTokens(tokenDir, oauth1, currentOAuth2);
    }
  }

  const domain = oauth1.domain || 'garmin.com';
  const url = connectApiUrl(path, domain);
  const resp = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(currentOAuth2),
      'User-Agent': API_USER_AGENT,
    },
  });

  if (!resp.ok) {
    throw new Error(`Garmin API ${path} failed: ${resp.status} ${resp.statusText}`);
  }

  if (resp.status === 204) {
    return { data: null, oauth2: currentOAuth2 };
  }

  const data = await resp.json();
  return { data, oauth2: currentOAuth2 };
}
