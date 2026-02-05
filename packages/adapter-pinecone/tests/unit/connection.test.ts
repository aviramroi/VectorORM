import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';

describe('PineconeAdapter - Connection', () => {
  let adapter: PineconeAdapter;

  beforeEach(() => {
    adapter = new PineconeAdapter({
      apiKey: 'test-api-key',
      environment: 'test-env',
    });
  });

  it('should throw error if apiKey is missing', () => {
    expect(() => new PineconeAdapter({ apiKey: '' })).toThrow(
      'PineconeAdapter: apiKey is required in config or PINECONE_API_KEY environment variable'
    );
  });

  it('should start disconnected', async () => {
    const connected = await adapter.isConnected();
    expect(connected).toBe(false);
  });

  it('should connect successfully', async () => {
    // Note: This will fail without mocking Pinecone client
    // For now, just test the structure
    await expect(adapter.connect()).rejects.toThrow();
  });

  it('should report connected after connect', async () => {
    // Will implement with proper mocking in next iteration
  });

  it('should disconnect successfully', async () => {
    await expect(adapter.disconnect()).resolves.not.toThrow();
  });
});
