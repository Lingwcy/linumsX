import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
	applyTableBorders,
	applyFormattingToTable,
	ensureEditableDocPath,
	loadDocxXml,
	parseTableEntries,
	saveDocxXml,
	TableBorderOptions,
	TableFormatOptions,
} from '../shared/docxXml.js';

type TableStyleName = 'three_line' | 'code' | 'simple' | 'classic' | 'header';

interface ApplyTableStyleParams {
	docPath: string;
	tableIndex?: number;
	style: TableStyleName;
}

const TABLE_STYLES: Record<TableStyleName, {
	borders: TableBorderOptions;
	cellFormat: TableFormatOptions;
}> = {
	three_line: {
		borders: {
			topBorder: 30,        // 1.5pt
			bottomBorder: 15,    // 0.75pt
			leftBorder: 0,
			rightBorder: 0,
			insideHBorder: 5,    // 0.25pt
			insideVBorder: 0,
			borderStyle: 'single',
			borderColor: '333333',
		},
		cellFormat: {
			bold: true,
			bgColor: 'E6E6E6',
		},
	},
	code: {
		borders: {
			topBorder: 10,
			bottomBorder: 10,
			leftBorder: 10,
			rightBorder: 10,
			insideHBorder: 10,
			insideVBorder: 10,
			borderStyle: 'single',
			borderColor: 'CCCCCC',
		},
		cellFormat: {
			fontName: 'Consolas',
			fontSize: 10,
			bgColor: 'F5F5F5',
			align: 'left',
		},
	},
	simple: {
		borders: {
			topBorder: 0,
			bottomBorder: 0,
			leftBorder: 0,
			rightBorder: 0,
			insideHBorder: 0,
			insideVBorder: 0,
			borderStyle: 'none',
		},
		cellFormat: {},
	},
	classic: {
		borders: {
			topBorder: 15,
			bottomBorder: 15,
			leftBorder: 15,
			rightBorder: 15,
			insideHBorder: 8,
			insideVBorder: 8,
			borderStyle: 'single',
			borderColor: '000000',
		},
		cellFormat: {},
	},
	header: {
		borders: {
			topBorder: 20,
			bottomBorder: 20,
			leftBorder: 0,
			rightBorder: 0,
			insideHBorder: 0,
			insideVBorder: 0,
			borderStyle: 'single',
			borderColor: '333333',
		},
		cellFormat: {
			bold: true,
			bgColor: 'E6E6E6',
		},
	},
};

export const applyTableStyleTool: Tool = {
	name: 'apply_table_style',
	description: '应用预设表格样式（三线表、代码块风格、简洁、经典、强调表头）',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			style: {
				type: 'string',
				enum: ['three_line', 'code', 'simple', 'classic', 'header'],
				description: '样式名称：three_line-三线表, code-代码块, simple-简洁, classic-经典, header-强调表头'
			},
		},
		required: ['docPath', 'style'],
	},
	execute: async (params) => {
		const p = params as ApplyTableStyleParams;

		try {
			const style = TABLE_STYLES[p.style];
			if (!style) {
				return { success: false, error: `Unknown style: ${p.style}` };
			}

			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);
			const tables = parseTableEntries(loaded);

			if (tables.length === 0) {
				return { success: false, error: 'No tables found in document' };
			}

			const tableIndex = p.tableIndex ?? 0;
			if (tableIndex < 0 || tableIndex >= tables.length) {
				return { success: false, error: `Table index out of range: ${tableIndex}` };
			}

			const table = tables[tableIndex];

			// Apply borders
			applyTableBorders(table.element, style.borders);

			// Apply cell formatting (only if there are format options)
			const hasCellFormat = Object.keys(style.cellFormat).length > 0;
			if (hasCellFormat) {
				applyFormattingToTable(table.element, style.cellFormat);
			}

			await saveDocxXml(p.docPath, loaded);

			return {
				success: true,
				data: {
					message: `Style "${p.style}" applied to table ${tableIndex}`,
					tableIndex,
					style: p.style,
				},
			};
		} catch (error) {
			if (error instanceof AgentError) {
				return { success: false, error: error.message };
			}
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	},
};
