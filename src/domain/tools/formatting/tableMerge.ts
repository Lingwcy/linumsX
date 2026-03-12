import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
	mergeCells,
	unmergeCells,
	ensureEditableDocPath,
	loadDocxXml,
	parseTableEntries,
	saveDocxXml,
	getTableDimensions,
} from '../shared/docxXml.js';

const mergeCellsTool: Tool = {
	name: 'merge_cells',
	description: '合并表格中的单元格区域',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			startRow: { type: 'number', description: '起始行（0开始）' },
			startCol: { type: 'number', description: '起始列（0开始）' },
			endRow: { type: 'number', description: '结束行' },
			endCol: { type: 'number', description: '结束列' },
		},
		required: ['docPath', 'startRow', 'startCol', 'endRow', 'endCol'],
	},
	execute: async (params) => {
		const p = params as { docPath: string; tableIndex?: number; startRow: number; startCol: number; endRow: number; endCol: number };
		try {
			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);
			const tables = parseTableEntries(loaded);
			if (tables.length === 0) return { success: false, error: 'No tables found' };
			const idx = p.tableIndex ?? 0;
			if (idx < 0 || idx >= tables.length) return { success: false, error: `Table index ${idx} out of range` };

			const dims = getTableDimensions(tables[idx].element);
			if (p.startRow < 0 || p.endRow >= dims.rows || p.startCol < 0 || p.endCol >= dims.columns) {
				return { success: false, error: 'Merge range exceeds table bounds' };
			}

			const result = mergeCells(tables[idx].element, {
				startRow: p.startRow,
				startCol: p.startCol,
				endRow: p.endRow,
				endCol: p.endCol,
			});

			if (!result.success) return result;
			await saveDocxXml(p.docPath, loaded);
			return { success: true, data: { message: `Cells merged from (${p.startRow},${p.startCol}) to (${p.endRow},${p.endCol})` } };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	},
};

const unmergeCellsTool: Tool = {
	name: 'unmerge_cells',
	description: '取消表格中已合并的单元格',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			rowIndex: { type: 'number', description: '单元格所在行' },
			colIndex: { type: 'number', description: '单元格所在列' },
		},
		required: ['docPath', 'rowIndex', 'colIndex'],
	},
	execute: async (params) => {
		const p = params as { docPath: string; tableIndex?: number; rowIndex: number; colIndex: number };
		try {
			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);
			const tables = parseTableEntries(loaded);
			if (tables.length === 0) return { success: false, error: 'No tables found' };
			const idx = p.tableIndex ?? 0;
			if (idx < 0 || idx >= tables.length) return { success: false, error: `Table index ${idx} out of range` };

			const result = unmergeCells(tables[idx].element, p.rowIndex, p.colIndex);
			if (!result.success) return result;
			await saveDocxXml(p.docPath, loaded);
			return { success: true, data: { message: `Cell at (${p.rowIndex},${p.colIndex}) unmerged` } };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	},
};

export const tableMergeTools = [mergeCellsTool, unmergeCellsTool];
