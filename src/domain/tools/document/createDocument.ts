import fs from 'node:fs/promises';
import path from 'node:path';
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { createEmptyDocument, ensureEditableDocPath } from '../shared/docxXml.js';

interface CreateDocumentParams {
  path: string;
  title?: string;
}

export const createDocumentTool: Tool = {
  name: 'create_document',
  description: '创建新的 Word 文档，仅用于新文件路径',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '新文档输出路径' },
      title: { type: 'string', description: '可选文档标题' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const { path: docPath, title } = params as CreateDocumentParams;

    try {
      await ensureEditableDocPath(docPath, false);
    } catch (error) {
      if (error instanceof AgentError && error.message === 'Document not found') {
        // Expected for a new file path.
      } else if (error instanceof AgentError) {
        return { success: false, error: error.message };
      } else {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    try {
      const resolvedPath = path.resolve(docPath);
      try {
        await fs.access(resolvedPath);
        return {
          success: false,
          error: `Target document already exists: ${resolvedPath}. Use an existing-document tool instead of create_document.`,
        };
      } catch {
        // Expected when creating a new file.
      }

      await createEmptyDocument(resolvedPath, title);
      return {
        success: true,
        data: {
          message: `Created document: ${resolvedPath}`,
          path: resolvedPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};