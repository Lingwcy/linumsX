import { describe, it, expect } from 'vitest';

describe('Cell Merge Operations', () => {
  it('should export mergeCells function', async () => {
    const { mergeCells } = await import('../../../src/domain/tools/shared/docxXml/structure.js');
    expect(typeof mergeCells).toBe('function');
  });

  it('should export unmergeCells function', async () => {
    const { unmergeCells } = await import('../../../src/domain/tools/shared/docxXml/structure.js');
    expect(typeof unmergeCells).toBe('function');
  });
});
