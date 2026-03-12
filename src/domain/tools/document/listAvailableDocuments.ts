import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { listDocxFiles } from '../shared/docxXml.js';

interface ListAvailableDocumentsParams {
  directory?: string;
}

export const listAvailableDocumentsTool: Tool = {
  name: 'list_available_documents',
  description: '列出目录中的 Word 文档',
  schema: {
    type: 'object',
    properties: {
      directory: { type: 'string', description: '要搜索的目录路径，默认当前目录' },
    },
  },
  execute: async (params) => {
    const { directory = '.' } = (params ?? {}) as ListAvailableDocumentsParams;

    try {
      const documents = await listDocxFiles(directory);
      return {
        success: true,
        data: {
          message: documents.length === 0 ? `No .docx files found in ${directory}` : `Found ${documents.length} document(s)`,
          documents,
        },
      };
    } catch (error) {
      if (error instanceof AgentError) {
        return { success: false, error: error.message };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};