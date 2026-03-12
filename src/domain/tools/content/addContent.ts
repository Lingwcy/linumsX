// src/domain/tools/content/addContent.ts
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { appendParagraphs, ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';

interface AddContentParams {
  docPath: string;
  content: string;
  type?: 'paragraph' | 'heading';
  headingLevel?: number;
  style?: string;
}

export const addContentTool: Tool = {
  name: 'add_content',
  description: '添加新内容段落',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
      content: { type: 'string', description: '内容文本' },
      type: { type: 'string', enum: ['paragraph', 'heading'], description: '内容类型' },
      headingLevel: { type: 'number', description: '标题级别（1-6）' },
      style: { type: 'string', description: '段落样式名' },
    },
    required: ['docPath', 'content'],
  },
  execute: async (params) => {
    const { docPath, content, type = 'paragraph', headingLevel, style } = params as AddContentParams;

    try {
      await ensureEditableDocPath(docPath);
      const loaded = loadDocxXml(docPath);
      const resolvedStyle = type === 'heading'
        ? `Heading${Math.min(Math.max(headingLevel ?? 1, 1), 6)}`
        : style;
      appendParagraphs(loaded, [{ text: content, style: resolvedStyle }]);
      await saveDocxXml(docPath, loaded);

      return {
        success: true,
        data: {
          message: `${type === 'heading' ? 'Added heading' : 'Added paragraph'}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`,
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
