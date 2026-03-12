// src/domain/tools/formatting/formatTable.ts
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
  applyFormattingToTable,
  ensureEditableDocPath,
  getTableDimensions,
  loadDocxXml,
  parseTableEntries,
  saveDocxXml,
} from '../shared/docxXml.js';

interface FormatTableParams {
  docPath: string;
  tableIndex?: number;
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
}

export const formatTableTool: Tool = {
  name: 'format_table_cells',
  description: '按表格、表头、指定行列修改表格内文字格式和单元格背景色',
  schema: {
    type: 'object',
    properties: {
      docPath: { type: 'string', description: '文档路径' },
      tableIndex: { type: 'number', description: '表格索引（从0开始）' },
      fontName: { type: 'string', description: '字体名称' },
      fontSize: { type: 'number', description: '字号' },
      bold: { type: 'boolean', description: '是否加粗' },
      bgColor: { type: 'string', description: '背景色（十六进制）' },
      align: { type: 'string', enum: ['left', 'center', 'right'], description: '对齐方式' },
    },
    required: ['docPath'],
  },
  execute: async (params) => {
    const formatParams = params as FormatTableParams;

    try {
      await ensureEditableDocPath(formatParams.docPath);
      const loaded = loadDocxXml(formatParams.docPath);
      const tables = parseTableEntries(loaded);

    if (tables.length === 0) {
      return {
        success: false,
        error: 'No tables found in document',
      };
    }

    const tableIndex = formatParams.tableIndex ?? 0;
    if (tableIndex < 0 || tableIndex >= tables.length) {
      return {
        success: false,
        error: `Table index out of range: ${tableIndex}`,
      };
    }

    const table = tables[tableIndex];
    const dimensions = getTableDimensions(table);
    const result = applyFormattingToTable(table.element, {
      fontName: formatParams.fontName,
      fontSize: formatParams.fontSize,
      bold: formatParams.bold,
      bgColor: formatParams.bgColor,
      align: formatParams.align,
    });
    await saveDocxXml(formatParams.docPath, loaded);

      return {
        success: true,
        data: {
          message: `Table formatting applied to table ${tableIndex}`,
          tableIndex,
          cellsModified: result.cellsChanged || dimensions.rows * dimensions.columns,
          paragraphsModified: result.paragraphsChanged,
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
