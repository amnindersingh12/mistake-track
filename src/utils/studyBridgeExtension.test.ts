import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Logic unit tests for StudyBridge Extension Background routines.
 */
class StudyBridgeQueueManager {
  private pending = new Map<string, { payload: any; expiresAt: number }>();
  private delivered = new Map<string, number>();
  private ttlMs: number;
  private maxPayloadBytes: number;

  constructor(ttlMs = 120_000, maxPayloadBytes = 500_000) {
    this.ttlMs = ttlMs;
    this.maxPayloadBytes = maxPayloadBytes;
  }

  isAllowedUrl(url: string): boolean {
    if (!url) return false;
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      return (
        host === 'testbook.com' ||
        host.endsWith('.testbook.com') ||
        host === 'localhost' ||
        host === '127.0.0.1'
      );
    } catch {
      return false;
    }
  }

  validateSelection(text: string, url: string, title: string) {
    if (!this.isAllowedUrl(url)) {
      throw new Error('Unsupported website. StudyBridge only captures from Testbook.');
    }
    const trimmed = (text || '').trim();
    if (!trimmed) {
      throw new Error('Empty selection rejected. Please select text on Testbook.');
    }
    if (trimmed.length > this.maxPayloadBytes) {
      throw new Error(`Payload too large (${trimmed.length} bytes, limit is ${this.maxPayloadBytes} bytes).`);
    }

    return {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
      source: {
        platform: 'Testbook',
        url,
        title: title || 'Testbook Analysis'
      },
      capturedAt: new Date().toISOString()
    };
  }

  enqueue(payload: any, now = Date.now()) {
    if (this.delivered.has(payload.id)) {
      return { success: true, duplicate: true };
    }
    this.pending.set(payload.id, {
      payload,
      expiresAt: now + this.ttlMs
    });
    return { success: true, queued: true };
  }

  flushForReadyTab(now = Date.now()): any | null {
    this.cleanup(now);
    if (this.pending.size === 0) return null;
    const [id, entry] = Array.from(this.pending.entries())[0];
    this.pending.delete(id);
    this.delivered.set(id, now);
    return entry.payload;
  }

  ack(id: string, now = Date.now()) {
    this.pending.delete(id);
    this.delivered.set(id, now);
  }

  cleanup(now = Date.now()) {
    for (const [id, entry] of this.pending.entries()) {
      if (entry.expiresAt <= now) {
        this.pending.delete(id);
      }
    }
    for (const [id, deliveredAt] of this.delivered.entries()) {
      if (now - deliveredAt > 600_000) {
        this.delivered.delete(id);
      }
    }
  }

  getPendingCount() {
    return this.pending.size;
  }

  isDelivered(id: string) {
    return this.delivered.has(id);
  }
}

describe('StudyBridge Extension Background Logic', () => {
  let manager: StudyBridgeQueueManager;

  beforeEach(() => {
    manager = new StudyBridgeQueueManager(120_000, 500_000);
  });

  describe('Website URL & Selection Validation', () => {
    it('accepts valid Testbook domains and localhost', () => {
      expect(manager.isAllowedUrl('https://testbook.com/test-series/mock/1/analysis')).toBe(true);
      expect(manager.isAllowedUrl('https://sub.testbook.com/solution')).toBe(true);
      expect(manager.isAllowedUrl('http://127.0.0.1:5173/test')).toBe(true);
    });

    it('rejects unsupported external websites', () => {
      expect(manager.isAllowedUrl('https://random-site.com/test')).toBe(false);
      expect(manager.isAllowedUrl('https://google.com')).toBe(false);
      expect(manager.isAllowedUrl('')).toBe(false);
    });

    it('rejects empty selection with a clear error', () => {
      expect(() =>
        manager.validateSelection('   ', 'https://testbook.com/analysis', 'Mock 1')
      ).toThrow('Empty selection rejected');
    });

    it('rejects unsupported website during capture', () => {
      expect(() =>
        manager.validateSelection('Score: 50', 'https://unsupported.com', 'Fake')
      ).toThrow('Unsupported website');
    });

    it('records source metadata correctly', () => {
      const payload = manager.validateSelection(
        'Score 75',
        'https://testbook.com/test-series/1',
        'SBI PO Mock 01'
      );
      expect(payload.source.platform).toBe('Testbook');
      expect(payload.source.url).toBe('https://testbook.com/test-series/1');
      expect(payload.source.title).toBe('SBI PO Mock 01');
      expect(payload.text).toBe('Score 75');
      expect(payload.id).toMatch(/^sb-\d+/);
    });

    it('rejects payload exceeding size limit (500 KB)', () => {
      const giantText = 'X'.repeat(500_001);
      expect(() =>
        manager.validateSelection(giantText, 'https://testbook.com/analysis', 'Large')
      ).toThrow('Payload too large');
    });
  });

  describe('Queue, TTL Expiration, and Deduplication', () => {
    it('queues a pending message when study app is not yet ready', () => {
      const payload = manager.validateSelection('Quant: 25/30', 'https://testbook.com/test', 'Mock 1');
      const res = manager.enqueue(payload);
      expect(res.queued).toBe(true);
      expect(manager.getPendingCount()).toBe(1);
    });

    it('delivers pending message when app reports ready', () => {
      const payload = manager.validateSelection('Quant: 25/30', 'https://testbook.com/test', 'Mock 1');
      manager.enqueue(payload);

      const delivered = manager.flushForReadyTab();
      expect(delivered).not.toBeNull();
      expect(delivered.id).toBe(payload.id);
      expect(manager.getPendingCount()).toBe(0);
      expect(manager.isDelivered(payload.id)).toBe(true);
    });

    it('cleans up expired pending messages after 120s TTL', () => {
      const startTime = 100000;
      const payload = manager.validateSelection('Quant: 25/30', 'https://testbook.com/test', 'Mock 1');
      manager.enqueue(payload, startTime);
      expect(manager.getPendingCount()).toBe(1);

      // Clean at 60s: not expired yet
      manager.cleanup(startTime + 60_000);
      expect(manager.getPendingCount()).toBe(1);

      // Clean at 121s: expired!
      manager.cleanup(startTime + 121_000);
      expect(manager.getPendingCount()).toBe(0);
    });

    it('prevents duplicate delivery of previously delivered transfers', () => {
      const payload = manager.validateSelection('Quant: 25/30', 'https://testbook.com/test', 'Mock 1');
      manager.enqueue(payload);
      manager.flushForReadyTab();

      // Repeated enqueue with same ID
      const secondAttempt = manager.enqueue(payload);
      expect(secondAttempt.duplicate).toBe(true);
      expect(manager.getPendingCount()).toBe(0);
    });

    it('acknowledges delivery and clears from pending queue', () => {
      const payload = manager.validateSelection('Quant: 25/30', 'https://testbook.com/test', 'Mock 1');
      manager.enqueue(payload);
      manager.ack(payload.id);
      expect(manager.getPendingCount()).toBe(0);
      expect(manager.isDelivered(payload.id)).toBe(true);
    });
  });
});

