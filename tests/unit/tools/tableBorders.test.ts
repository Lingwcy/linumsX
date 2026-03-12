import { describe, it, expect } from 'vitest';

describe('applyTableBorders', () => {
  it('should export applyTableBorders function', async () => {
    const { applyTableBorders } = await import('../../../src/domain/tools/shared/docxXml/formatting.js');
    expect(typeof applyTableBorders).toBe('function');
  });
});
