// src/domain/document/entities/Document.ts
import fs from 'node:fs/promises';
import { AgentError, ErrorCode } from '../../../shared/errors/AgentError.js';
import { getTableDimensions, loadDocxXml, parseParagraphEntries, parseTableEntries } from '../../tools/shared/docxXml.js';

export interface ParagraphData {
  text: string;
  style?: string;
}

export interface TableData {
  rows: number;
  columns: number;
}

export interface HeadingOutline {
  level: number;
  text: string;
}

export class Document {
  public paragraphs: ParagraphData[] = [];
  public tables: TableData[] = [];
  public headingOutline: HeadingOutline[] = [];

  constructor(public readonly path: string) {
    if (!path || typeof path !== 'string') {
      throw new AgentError(
        'Document path must be a non-empty string',
        ErrorCode.INVALID_CONFIG,
        { path }
      );
    }
  }

  async load(): Promise<void> {
    try {
      const loaded = loadDocxXml(this.path);
      this.parseLoadedDocument(loaded);

    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }

      const normalizedMessage = error instanceof Error ? error.message : 'Unknown error';
      if (normalizedMessage.includes('ADM-ZIP: Invalid or unsupported zip format')) {
        let detail = 'The file is not a valid .docx zip package.';
        try {
          const stat = await fs.stat(this.path);
          if (stat.size === 0) {
            detail = 'The file is empty (0 bytes), so it is not a valid .docx document.';
          }
        } catch {
          // Ignore stat failures and fall back to generic invalid-docx guidance.
        }

        throw new AgentError(
          `Failed to load document: ${detail}`,
          ErrorCode.DOCUMENT_NOT_FOUND,
          { path: this.path },
          error instanceof Error ? error : undefined
        );
      }

      throw new AgentError(
        `Failed to load document: ${normalizedMessage}`,
        ErrorCode.DOCUMENT_NOT_FOUND,
        { path: this.path },
        error instanceof Error ? error : undefined
      );
    }
  }

  private parseLoadedDocument(loaded: ReturnType<typeof loadDocxXml>): void {
    this.paragraphs = [];
    this.tables = [];
    this.headingOutline = [];

    for (const paragraph of parseParagraphEntries(loaded)) {
      const { text, style } = paragraph;
      const headingMatch = /^Heading(\d+)$/.exec(style || '');
      if (text.trim()) {
        this.paragraphs.push({ text, style });

        if (headingMatch) {
          const level = parseInt(headingMatch[1], 10);
          this.headingOutline.push({ level, text });
        }
      }
    }

    for (const table of parseTableEntries(loaded)) {
      this.tables.push(getTableDimensions(table));
    }
  }

  async save(): Promise<void> {
    throw new AgentError(
      'Document.save() is not implemented for DOM-backed documents. Use tool-based mutations instead.',
      ErrorCode.INVALID_CONFIG,
      { path: this.path }
    );
  }

  getText(): string {
    return this.paragraphs.map(p => p.text).join('\n');
  }
}
