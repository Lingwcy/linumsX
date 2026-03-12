// src/domain/tools/content/searchReplace.ts
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { ensureEditableDocPath, loadDocxXml, parseParagraphEntries, replaceParagraphAt, saveDocxXml } from '../shared/docxXml.js';

interface SearchReplaceParams {
  docPath: string;
  search: string;
  replace: string;
  replaceAll?: boolean;
}

export const searchReplaceTool: Tool = {
  name: 'search_and_replace',
  description: '在文档中搜索并替换文本',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
      search: { type: 'string', description: '搜索文本' },
      replace: { type: 'string', description: '替换文本' },
      replaceAll: { type: 'boolean', description: '是否替换所有' },
    },
    required: ['docPath', 'search', 'replace'],
  },
  execute: async (params) => {
    const { docPath, search, replace, replaceAll = false } = params as SearchReplaceParams;

    try {
      await ensureEditableDocPath(docPath);
      const loaded = loadDocxXml(docPath);
      const paragraphs = parseParagraphEntries(loaded);
      let replacements = 0;

      for (let index = paragraphs.length - 1; index >= 0; index--) {
        const paragraph = paragraphs[index];
        if (!paragraph.text.includes(search)) {
          continue;
        }

        const occurrences = paragraph.text.split(search).length - 1;
        const newText = replaceAll
          ? paragraph.text.split(search).join(replace)
          : paragraph.text.replace(search, replace);

        replacements += replaceAll ? occurrences : 1;
        replaceParagraphAt(loaded, paragraph, newText, paragraph.style);

        if (!replaceAll) {
          break;
        }
      }

      if (replacements === 0) {
        return {
          success: true,
          data: {
            message: `Text not found: ${search}`,
            count: 0,
          },
        };
      }

      await saveDocxXml(docPath, loaded);

      return {
        success: true,
        data: {
          message: `Replaced ${replacements} occurrence(s)`,
          count: replacements,
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
