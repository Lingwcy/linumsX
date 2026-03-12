// src/domain/tools/formatting/formatParagraph.ts
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
  applyParagraphFormattingToParagraph,
  ensureEditableDocPath,
  loadDocxXml,
  parseParagraphEntries,
  saveDocxXml,
} from '../shared/docxXml.js';

interface FormatParagraphParams {
  docPath: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineSpacing?: number;
  firstLineIndent?: number;
  spaceBefore?: number;
  spaceAfter?: number;
}

export const formatParagraphTool: Tool = {
  name: 'format_paragraphs',
  description: '按范围修改段落格式，如对齐、行距、首行缩进、悬挂缩进、段前段后距',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
      alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: '对齐方式' },
      lineSpacing: { type: 'number', description: '行间距（倍数）' },
      firstLineIndent: { type: 'number', description: '首行缩进（字符数）' },
      spaceBefore: { type: 'number', description: '段前间距（磅）' },
      spaceAfter: { type: 'number', description: '段后间距（磅）' },
    },
    required: ['docPath'],
  },
  execute: async (params) => {
    const formatParams = params as FormatParagraphParams;

    try {
      await ensureEditableDocPath(formatParams.docPath);
      const loaded = loadDocxXml(formatParams.docPath);
      const paragraphs = parseParagraphEntries(loaded);
      let modified = 0;

		for (let index = paragraphs.length - 1; index >= 0; index--) {
			const paragraph = paragraphs[index];
			const result = applyParagraphFormattingToParagraph(paragraph.element, {
				alignment: formatParams.alignment,
				lineSpacing: formatParams.lineSpacing,
				firstLineIndent: formatParams.firstLineIndent,
				spaceBefore: formatParams.spaceBefore,
				spaceAfter: formatParams.spaceAfter,
			});

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
          message: modified > 0 ? `Paragraph formatting applied to ${modified} paragraph(s)` : 'No paragraph formatting changes were requested',
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
