import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { ensureEditableDocPath, loadDocxXml, replaceBlockBetweenAnchors as replaceBetweenAnchorsXml, saveDocxXml } from '../shared/docxXml.js';

interface ReplaceBlockBetweenAnchorsParams {
  docPath: string;
  startAnchor: string;
  endAnchor: string;
  newContent: string[];
}

export const replaceBlockBetweenAnchorsTool: Tool = {
  name: 'replace_block_between_anchors',
  description: '替换两个锚点之间的内容',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
      startAnchor: { type: 'string', description: '起始锚点文本' },
      endAnchor: { type: 'string', description: '结束锚点文本' },
      newContent: {
        type: 'array',
        items: { type: 'string' },
        description: '要插入的新段落内容列表',
      },
    },
    required: ['docPath', 'startAnchor', 'endAnchor', 'newContent'],
  },
  execute: async (params) => {
    const { docPath, startAnchor, endAnchor, newContent } = params as ReplaceBlockBetweenAnchorsParams;

    try {
      await ensureEditableDocPath(docPath);
      const loaded = loadDocxXml(docPath);
      const result = replaceBetweenAnchorsXml(loaded, startAnchor, endAnchor, newContent);
      await saveDocxXml(docPath, loaded);

      return {
        success: true,
        data: {
          message: `Replaced content between anchors at paragraph indexes ${result.startIndex} and ${result.endIndex}`,
          startIndex: result.startIndex,
          endIndex: result.endIndex,
          insertedCount: newContent.length,
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