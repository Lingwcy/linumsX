import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/infrastructure/config/ConfigManager';

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load default config', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MODEL_PROVIDER;
    delete process.env.MODEL_ID;
    delete process.env.MAX_TOKENS;
    delete process.env.TEMPERATURE;

    const config = ConfigManager.getDefault();

    expect(config.model.provider).toBe('anthropic');
    expect(config.model.model).toBe('claude-3-5-sonnet-20241022');
    expect(config.agent.maxTokens).toBe(4096);
    expect(config.agent.temperature).toBe(0.7);
  });

  it('should merge environment variables', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.MODEL_ID = 'claude-3-5-sonnet-20241022';

    const config = ConfigManager.fromEnv();

    expect(config.model.apiKey).toBe('test-key');
  });

  it('should reject invalid provider', () => {
    process.env.MODEL_PROVIDER = 'invalid';

    expect(() => ConfigManager.fromEnv()).toThrow('Invalid MODEL_PROVIDER');
  });

  it('should reject invalid maxTokens', () => {
    process.env.MAX_TOKENS = 'abc';

    expect(() => ConfigManager.fromEnv()).toThrow('Invalid MAX_TOKENS');
  });

  it('should reject invalid temperature', () => {
    process.env.TEMPERATURE = 'not-a-number';

    expect(() => ConfigManager.fromEnv()).toThrow('Invalid TEMPERATURE');
  });
});
