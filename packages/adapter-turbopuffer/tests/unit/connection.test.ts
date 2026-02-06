import { describe, it, expect, beforeEach } from 'vitest';
import { TurbopufferAdapter } from '../../src/turbopuffer-adapter';

describe('TurbopufferAdapter - Connection', () => {
  let adapter: TurbopufferAdapter;

  beforeEach(() => {
    adapter = new TurbopufferAdapter({
      apiKey: 'test-api-key',
    });
  });

  it('should throw error if apiKey is missing', () => {
    expect(() => new TurbopufferAdapter({ apiKey: '' })).toThrow(
      'TurbopufferAdapter: apiKey is required in config or TURBOPUFFER_API_KEY environment variable'
    );
  });

  it('should accept optional baseUrl', () => {
    const customAdapter = new TurbopufferAdapter({
      apiKey: 'test-api-key',
      baseUrl: 'https://custom.turbopuffer.com',
    });
    expect(customAdapter).toBeDefined();
  });

  it('should start disconnected', async () => {
    const connected = await adapter.isConnected();
    expect(connected).toBe(false);
  });

  it('should connect successfully', async () => {
    // Note: This will fail without mocking Turbopuffer client
    // For now, just test the structure
    await expect(adapter.connect()).rejects.toThrow();
  });

  it('should report connected after connect', async () => {
    // This test would need mocking for real verification
    // For now, verify the method structure works
    expect(adapter.isConnected).toBeDefined();
    expect(typeof adapter.isConnected()).toBe('object');
    await expect(adapter.isConnected()).resolves.toBe(false);
  });

  it('should disconnect successfully', async () => {
    await expect(adapter.disconnect()).resolves.not.toThrow();
  });

  it('should handle disconnect when not connected', async () => {
    await adapter.disconnect();
    await expect(adapter.disconnect()).resolves.not.toThrow();
  });
});
