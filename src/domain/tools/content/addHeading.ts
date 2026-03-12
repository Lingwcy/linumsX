import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { appendParagraphs, ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';

interface AddHeadingParams {
  docPath: string;
  text: string;
  level?: number;
}

export const addHeadingTool: Tool = {
  name: 'add_heading',
  description: '添加标题',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
      text: { type: 'string', description: '标题内容' },
      level: { type: 'number', description: '标题级别（1-6）' },
    },
    required: ['docPath', 'text'],
  },
  execute: async (params) => {
    const { docPath, text, level = 1 } = params as AddHeadingParams;

    try {
      await ensureEditableDocPath(docPath);
      const loaded = loadDocxXml(docPath);
      const clampedLevel = Math.min(Math.max(level, 1), 6);
      appendParagraphs(loaded, [{ text, style: `Heading${clampedLevel}` }]);
      await saveDocxXml(docPath, loaded);

      return {
        success: true,
        data: {
          message: `Added heading level ${clampedLevel}: ${text}`,
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