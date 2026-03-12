// src/domain/tools/formatting/formatText.ts
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
  applyTextFormattingToParagraph,
  ensureEditableDocPath,
  loadDocxXml,
  parseParagraphEntries,
  saveDocxXml,
} from '../shared/docxXml.js';

interface FormatTextParams {
  docPath: string;
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  targetText?: string;
}

export const formatTextTool: Tool = {
  name: 'format_text',
  description: '按范围或关键词修改文字格式，如字体、字号、加粗、斜体、下划线、颜色',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
      fontName: { type: 'string', description: '字体名称' },
      fontSize: { type: 'number', description: '字号（磅）' },
      bold: { type: 'boolean', description: '是否加粗' },
      italic: { type: 'boolean', description: '是否斜体' },
      underline: { type: 'boolean', description: '是否下划线' },
      color: { type: 'string', description: '颜色（十六进制，如 #FF0000）' },
      targetText: { type: 'string', description: '目标文本（关键词高亮用）' },
    },
    required: ['docPath'],
  },
  execute: async (params) => {
    const formatParams = params as FormatTextParams;

    try {
      await ensureEditableDocPath(formatParams.docPath);
      const loaded = loadDocxXml(formatParams.docPath);
      const paragraphs = parseParagraphEntries(loaded);
      let modified = 0;

      for (let index = paragraphs.length - 1; index >= 0; index--) {
        const paragraph = paragraphs[index];
        const result = applyTextFormattingToParagraph(paragraph.element, {
			fontName: formatParams.fontName,
			fontSize: formatParams.fontSize,
			bold: formatParams.bold,
			italic: formatParams.italic,
			underline: formatParams.underline,
			color: formatParams.color,
		}, formatParams.targetText);

		if (!result.changed) {
			continue;
		}

		modified += 1;
	}

	if (modified > 0) {
    await saveDocxXml(formatParams.docPath, loaded);
	}

      return {
        success: true,
        data: {
          message: modified > 0 ? `Text formatting applied to ${modified} paragraph(s)` : 'No matching text found for formatting',
          modified,
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
