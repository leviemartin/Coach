import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  saveTokens,
  loadTokens,
  getAuthStatus,
  type OAuth1Token,
  type OAuth2Token,
} from '@/lib/garmin-tokens';

const FIXTURES = {
  oauth1: {
    oauth_token: 'test-token',
    oauth_token_secret: 'test-secret',
    mfa_token: null,
    mfa_expiration_timestamp: null,
    domain: 'garmin.com',
  } satisfies OAuth1Token,
  oauth2: {
    scope: 'connect_read connect_write',
    jti: 'test-jti',
    token_type: 'Bearer',
    access_token: 'test-access',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token_expires_in: 7776000,
    refresh_token_expires_at: Math.floor(Date.now() / 1000) + 7776000,
  } satisfies OAuth2Token,
  oauth2Expired: {
    scope: 'connect_read connect_write',
    jti: 'test-jti',
    token_type: 'Bearer',
    access_token: 'test-access',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 100,
    refresh_token_expires_in: 7776000,
    refresh_token_expires_at: Math.floor(Date.now() / 1000) - 100,
  } satisfies OAuth2Token,
};

describe('garmin-tokens', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garmin-tokens-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('saveTokens + loadTokens', () => {
    it('round-trips tokens to disk', () => {
      saveTokens(tmpDir, FIXTURES.oauth1, FIXTURES.oauth2);
      const loaded = loadTokens(tmpDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.oauth1.oauth_token).toBe('test-token');
      expect(loaded!.oauth2.access_token).toBe('test-access');
    });

    it('creates directory if it does not exist', () => {
      const nested = path.join(tmpDir, 'sub', 'dir');
      saveTokens(nested, FIXTURES.oauth1, FIXTURES.oauth2);
      expect(fs.existsSync(path.join(nested, 'oauth1_token.json'))).toBe(true);
    });
  });

  describe('loadTokens', () => {
    it('returns null if directory does not exist', () => {
      expect(loadTokens('/tmp/nonexistent-garmin-dir')).toBeNull();
    });

    it('returns null if files are missing', () => {
      expect(loadTokens(tmpDir)).toBeNull();
    });
  });

  describe('getAuthStatus', () => {
    it('returns no_tokens when no tokens exist', () => {
      expect(getAuthStatus(tmpDir)).toBe('no_tokens');
    });

    it('returns authenticated when tokens are valid', () => {
      saveTokens(tmpDir, FIXTURES.oauth1, FIXTURES.oauth2);
      expect(getAuthStatus(tmpDir)).toBe('authenticated');
    });

    it('returns expired when oauth2 refresh token is expired', () => {
      saveTokens(tmpDir, FIXTURES.oauth1, FIXTURES.oauth2Expired);
      expect(getAuthStatus(tmpDir)).toBe('expired');
    });
  });
});
