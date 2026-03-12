import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Document } from '../../src/domain/document/entities/Document';
import { ErrorCode } from '../../src/shared/errors/AgentError';

describe('Document', () => {
  describe('constructor', () => {
    it('should create document with path', () => {
      const doc = new Document('/test/sample.docx');
      expect(doc.path).toBe('/test/sample.docx');
      expect(doc.paragraphs).toEqual([]);
      expect(doc.tables).toEqual([]);
      expect(doc.headingOutline).toEqual([]);
    });

    it('should reject empty path', () => {
      expect(() => new Document('')).toThrow();
    });

    it('should reject null path', () => {
      expect(() => new Document(null as any)).toThrow();
    });

    it('should reject undefined path', () => {
      expect(() => new Document(undefined as any)).toThrow();
    });
  });

  describe('load', () => {
    it('should throw error for non-existent file', async () => {
      const doc = new Document('/non/existent/file.docx');
      await expect(doc.load()).rejects.toThrow();
    });
  });

  describe('getText', () => {
    it('should return empty string for empty document', () => {
      const doc = new Document('/test.docx');
      expect(doc.getText()).toBe('');
    });
  });

  describe('save', () => {
    it('should throw error if document not loaded', async () => {
      const doc = new Document('/test.docx');
      await expect(doc.save()).rejects.toThrow();
    });
  });
});
