import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
	addTableRow,
	deleteTableRow,
	addTableColumn,
	deleteTableColumn,
	ensureEditableDocPath,
	loadDocxXml,
	parseTableEntries,
	saveDocxXml,
} from '../shared/docxXml.js';

const addTableRowTool: Tool = {
	name: 'add_table_row',
	description: '在表格中添加新行',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			rowIndex: { type: 'number', description: '插入位置（默认末尾）' },
			content: { type: 'array', items: { type: 'string' }, description: '新行内容' },
			isHeader: { type: 'boolean', description: '是否设为表头行样式' },
		},
		required: ['docPath'],
	},
	execute: async (params) => {
		const p = params as { docPath: string; tableIndex?: number; rowIndex?: number; content?: string[]; isHeader?: boolean };
		try {
			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);
			const tables = parseTableEntries(loaded);
			if (tables.length === 0) return { success: false, error: 'No tables found' };
			const idx = p.tableIndex ?? 0;
			if (idx < 0 || idx >= tables.length) return { success: false, error: `Table index ${idx} out of range` };

			const rowIndex = addTableRow(tables[idx].element, p.rowIndex, p.content, p.isHeader);
			await saveDocxXml(p.docPath, loaded);
			return { success: true, data: { message: `Row added at index ${rowIndex}`, rowIndex } };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	},
};

const deleteTableRowTool: Tool = {
	name: 'delete_table_row',
	description: '删除表格中的指定行',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			rowIndex: { type: 'number', description: '要删除的行索引（默认最后一行）' },
		},
		required: ['docPath'],
	},
	execute: async (params) => {
		const p = params as { docPath: string; tableIndex?: number; rowIndex?: number };
		try {
			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);
			const tables = parseTableEntries(loaded);
			if (tables.length === 0) return { success: false, error: 'No tables found' };
			const idx = p.tableIndex ?? 0;
			if (idx < 0 || idx >= tables.length) return { success: false, error: `Table index ${idx} out of range` };

			const deleted = deleteTableRow(tables[idx].element, p.rowIndex);
			if (!deleted) return { success: false, error: 'Failed to delete row' };
			await saveDocxXml(p.docPath, loaded);
			return { success: true, data: { message: 'Row deleted' } };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	},
};

const addTableColumnTool: Tool = {
	name: 'add_table_column',
	description: '在表格中添加新列',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			columnIndex: { type: 'number', description: '插入位置（默认末尾）' },
		},
		required: ['docPath'],
	},
	execute: async (params) => {
		const p = params as { docPath: string; tableIndex?: number; columnIndex?: number };
		try {
			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);
			const tables = parseTableEntries(loaded);
			if (tables.length === 0) return { success: false, error: 'No tables found' };
			const idx = p.tableIndex ?? 0;
			if (idx < 0 || idx >= tables.length) return { success: false, error: `Table index ${idx} out of range` };

			const colIndex = addTableColumn(tables[idx].element, p.columnIndex);
			await saveDocxXml(p.docPath, loaded);
			return { success: true, data: { message: `Column added at index ${colIndex}`, columnIndex: colIndex } };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	},
};

const deleteTableColumnTool: Tool = {
	name: 'delete_table_column',
	description: '删除表格中的指定列',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			columnIndex: { type: 'number', description: '要删除的列索引（默认最后一列）' },
		},
		required: ['docPath'],
	},
	execute: async (params) => {
		const p = params as { docPath: string; tableIndex?: number; columnIndex?: number };
		try {
			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);
			const tables = parseTableEntries(loaded);
			if (tables.length === 0) return { success: false, error: 'No tables found' };
			const idx = p.tableIndex ?? 0;
			if (idx < 0 || idx >= tables.length) return { success: false, error: `Table index ${idx} out of range` };

			const deleted = deleteTableColumn(tables[idx].element, p.columnIndex);
			if (!deleted) return { success: false, error: 'Failed to delete column' };
			await saveDocxXml(p.docPath, loaded);
			return { success: true, data: { message: 'Column deleted' } };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	},
};

export const tableRowColTools = [
	addTableRowTool,
	deleteTableRowTool,
	addTableColumnTool,
	deleteTableColumnTool,
];
