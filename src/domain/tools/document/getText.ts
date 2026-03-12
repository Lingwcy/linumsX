import { Tool } from '../types.js';
import { Document } from '../../document/entities/Document.js';
import { AgentError, ErrorCode } from '../../../shared/errors/AgentError.js';

export const getDocumentTextTool: Tool = {
  name: 'get_document_text',
  description: '获取文档全部文本内容',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
    },
    required: ['docPath'],
  },
  execute: async (params) => {
    const { docPath } = params as { docPath: string };

    try {
      const doc = new Document(docPath);
      await doc.load();

      return {
        success: true,
        data: {
          text: doc.getText(),
          paragraphs: doc.paragraphs,
        },
      };
    } catch (error) {
      if (error instanceof AgentError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
};
