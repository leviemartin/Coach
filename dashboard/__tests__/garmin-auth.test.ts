import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCsrfToken,
  getTitle,
  parseTicket,
  setExpirations,
} from '@/lib/garmin-auth';

describe('garmin-auth helpers', () => {
  describe('getCsrfToken', () => {
    it('extracts CSRF token from HTML', () => {
      const html = '<input name="_csrf" value="abc123def">';
      expect(getCsrfToken(html)).toBe('abc123def');
    });

    it('throws if no CSRF token found', () => {
      expect(() => getCsrfToken('<html></html>')).toThrow('CSRF');
    });
  });

  describe('getTitle', () => {
    it('extracts title from HTML', () => {
      const html = '<html><head><title>Success</title></head></html>';
      expect(getTitle(html)).toBe('Success');
    });

    it('throws if no title found', () => {
      expect(() => getTitle('<html></html>')).toThrow('title');
    });
  });

  describe('parseTicket', () => {
    it('extracts ticket from success HTML', () => {
      const html = 'embed?ticket=ST-123456-abc"';
      expect(parseTicket(html)).toBe('ST-123456-abc');
    });

    it('throws if no ticket found', () => {
      expect(() => parseTicket('<html>no ticket</html>')).toThrow('ticket');
    });
  });

  describe('setExpirations', () => {
    it('adds expires_at and refresh_token_expires_at', () => {
      const token = { expires_in: 3600, refresh_token_expires_in: 7776000 };
      const result = setExpirations(token);
      expect(result.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(result.refresh_token_expires_at).toBeGreaterThan(
        Math.floor(Date.now() / 1000),
      );
    });
  });
});
