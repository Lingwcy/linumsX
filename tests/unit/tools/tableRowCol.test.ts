import { describe, it, expect } from 'vitest';

describe('Table Row/Col Operations', () => {
  it('should export addTableRow function', async () => {
    const { addTableRow } = await import('../../../src/domain/tools/shared/docxXml/structure.js');
    expect(typeof addTableRow).toBe('function');
  });

  it('should export deleteTableRow function', async () => {
    const { deleteTableRow } = await import('../../../src/domain/tools/shared/docxXml/structure.js');
    expect(typeof deleteTableRow).toBe('function');
  });

  it('should export addTableColumn function', async () => {
    const { addTableColumn } = await import('../../../src/domain/tools/shared/docxXml/structure.js');
    expect(typeof addTableColumn).toBe('function');
  });

  it('should export deleteTableColumn function', async () => {
    const { deleteTableColumn } = await import('../../../src/domain/tools/shared/docxXml/structure.js');
    expect(typeof deleteTableColumn).toBe('function');
  });
});
