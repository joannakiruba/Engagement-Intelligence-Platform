import {
  extractClientIp,
  getNetworkFingerprint,
  verifyNetworkMatch,
  generateDeviceTokenValue,
  hashDeviceToken,
  getDeviceCookieName,
  getDeviceCookieMaxAge,
  type NetworkInfo,
} from '../services/network-verification.service';
import { Request } from 'express';

describe('Network Verification Service', () => {
  describe('extractClientIp', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
        ip: '10.0.0.1',
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;
      expect(extractClientIp(req)).toBe('203.0.113.10');
    });

    it('extracts single IP from x-forwarded-for', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.50' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;
      expect(extractClientIp(req)).toBe('203.0.113.50');
    });

    it('falls back to req.ip when no x-forwarded-for', () => {
      const req = {
        headers: {},
        ip: '192.168.1.100',
        socket: { remoteAddress: '192.168.1.100' },
      } as unknown as Request;
      expect(extractClientIp(req)).toBe('192.168.1.100');
    });

    it('falls back to socket.remoteAddress when req.ip is empty', () => {
      const req = {
        headers: {},
        ip: '',
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as Request;
      expect(extractClientIp(req)).toBe('10.0.0.5');
    });

    it('returns unknown when all sources are empty', () => {
      const req = {
        headers: {},
        ip: '',
        socket: { remoteAddress: '' },
      } as unknown as Request;
      expect(extractClientIp(req)).toBe('unknown');
    });
  });

  describe('getNetworkFingerprint', () => {
    it('returns IP in browser mode (default)', () => {
      const info: NetworkInfo = { ip: '203.0.113.10' };
      expect(getNetworkFingerprint(info)).toBe('203.0.113.10');
    });

    it('returns IP even when bssid is provided in browser mode', () => {
      const info: NetworkInfo = { ip: '203.0.113.10', bssid: 'AA:BB:CC:DD:EE:FF' };
      // In browser mode, BSSID is ignored
      expect(getNetworkFingerprint(info)).toBe('203.0.113.10');
    });
  });

  describe('verifyNetworkMatch', () => {
    it('returns true when fingerprints match', () => {
      expect(verifyNetworkMatch('203.0.113.10', '203.0.113.10')).toBe(true);
    });

    it('returns false when fingerprints differ', () => {
      expect(verifyNetworkMatch('203.0.113.10', '198.51.100.5')).toBe(false);
    });

    it('returns true when trainer fingerprint is null (no reference)', () => {
      expect(verifyNetworkMatch(null, '203.0.113.10')).toBe(true);
    });

    it('returns false for empty string vs real IP', () => {
      expect(verifyNetworkMatch('203.0.113.10', '')).toBe(false);
    });
  });

  describe('generateDeviceTokenValue', () => {
    it('generates a 64-character hex string', () => {
      const token = generateDeviceTokenValue();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique values on successive calls', () => {
      const t1 = generateDeviceTokenValue();
      const t2 = generateDeviceTokenValue();
      expect(t1).not.toBe(t2);
    });
  });

  describe('hashDeviceToken', () => {
    it('returns a 64-character hex SHA-256 hash', () => {
      const hash = hashDeviceToken('test-token');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces same hash for same input', () => {
      const h1 = hashDeviceToken('same-input');
      const h2 = hashDeviceToken('same-input');
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different inputs', () => {
      const h1 = hashDeviceToken('input-a');
      const h2 = hashDeviceToken('input-b');
      expect(h1).not.toBe(h2);
    });
  });

  describe('getDeviceCookieName', () => {
    it('returns the expected cookie name', () => {
      expect(getDeviceCookieName()).toBe('eip_device_token');
    });
  });

  describe('getDeviceCookieMaxAge', () => {
    it('returns a positive value (roughly 1 year in ms)', () => {
      const maxAge = getDeviceCookieMaxAge();
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBe(365 * 24 * 60 * 60 * 1000);
    });
  });
});
