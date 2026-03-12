import { describe, it, expect, vi } from 'vitest';
import { getDocumentInfoTool } from '../../../src/domain/tools/document/getInfo.js';
import { getDocumentTextTool } from '../../../src/domain/tools/document/getText.js';
import { getDocumentOutlineTool } from '../../../src/domain/tools/document/getOutline.js';

describe('getDocumentInfoTool', () => {
  it('should have correct name and description', () => {
    expect(getDocumentInfoTool.name).toBe('get_document_info');
    expect(getDocumentInfoTool.description).toBe('获取文档基本信息（段落数、表格数等）');
  });

  it('should have valid schema', () => {
    expect(getDocumentInfoTool.schema.type).toBe('object');
    expect(getDocumentInfoTool.schema.required).toContain('docPath');
    expect(getDocumentInfoTool.schema.properties).toHaveProperty('docPath');
  });

  it('should have execute function', () => {
    expect(typeof getDocumentInfoTool.execute).toBe('function');
  });
});

describe('getDocumentTextTool', () => {
  it('should have correct name and description', () => {
    expect(getDocumentTextTool.name).toBe('get_document_text');
    expect(getDocumentTextTool.description).toBe('获取文档全部文本内容');
  });

  it('should have valid schema', () => {
    expect(getDocumentTextTool.schema.type).toBe('object');
    expect(getDocumentTextTool.schema.required).toContain('docPath');
    expect(getDocumentTextTool.schema.properties).toHaveProperty('docPath');
  });

  it('should have execute function', () => {
    expect(typeof getDocumentTextTool.execute).toBe('function');
  });
});

describe('getDocumentOutlineTool', () => {
  it('should have correct name and description', () => {
    expect(getDocumentOutlineTool.name).toBe('get_document_outline');
    expect(getDocumentOutlineTool.description).toBe('获取文档章节大纲结构');
  });

  it('should have valid schema', () => {
    expect(getDocumentOutlineTool.schema.type).toBe('object');
    expect(getDocumentOutlineTool.schema.required).toContain('docPath');
    expect(getDocumentOutlineTool.schema.properties).toHaveProperty('docPath');
  });

  it('should have execute function', () => {
    expect(typeof getDocumentOutlineTool.execute).toBe('function');
  });
});
