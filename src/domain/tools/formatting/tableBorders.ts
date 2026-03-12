import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
	applyTableBorders,
	ensureEditableDocPath,
	loadDocxXml,
	parseTableEntries,
	saveDocxXml,
} from '../shared/docxXml.js';

interface FormatTableBordersParams {
	docPath: string;
	tableIndex?: number;
	topBorder?: number;
	bottomBorder?: number;
	leftBorder?: number;
	rightBorder?: number;
	insideHBorder?: number;
	insideVBorder?: number;
	borderStyle?: 'single' | 'double' | 'none';
	borderColor?: string;
}

export const formatTableBordersTool: Tool = {
	name: 'format_table_borders',
	description: '设置表格边框样式（粗细、颜色、线型）',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			tableIndex: { type: 'number', description: '表格索引（从0开始）' },
			topBorder: { type: 'number', description: '顶部边框粗细 (twips)' },
			bottomBorder: { type: 'number', description: '底部边框粗细 (twips)' },
			leftBorder: { type: 'number', description: '左边框粗细 (twips)' },
			rightBorder: { type: 'number', description: '右边框粗细 (twips)' },
			insideHBorder: { type: 'number', description: '内部水平线粗细 (twips)' },
			insideVBorder: { type: 'number', description: '内部垂直线粗细 (twips)' },
			borderStyle: { type: 'string', enum: ['single', 'double', 'none'], description: '边框样式' },
			borderColor: { type: 'string', description: '边框颜色（十六进制）' },
		},
		required: ['docPath'],
	},
	execute: async (params) => {
		const formatParams = params as FormatTableBordersParams;

		try {
			await ensureEditableDocPath(formatParams.docPath);
			const loaded = loadDocxXml(formatParams.docPath);
			const tables = parseTableEntries(loaded);

			if (tables.length === 0) {
				return { success: false, error: 'No tables found in document' };
			}

			const tableIndex = formatParams.tableIndex ?? 0;
			if (tableIndex < 0 || tableIndex >= tables.length) {
				return { success: false, error: `Table index out of range: ${tableIndex}` };
			}

			const table = tables[tableIndex];
			const result = applyTableBorders(table.element, {
				topBorder: formatParams.topBorder,
				bottomBorder: formatParams.bottomBorder,
				leftBorder: formatParams.leftBorder,
				rightBorder: formatParams.rightBorder,
				insideHBorder: formatParams.insideHBorder,
				insideVBorder: formatParams.insideVBorder,
				borderStyle: formatParams.borderStyle,
				borderColor: formatParams.borderColor,
			});

			await saveDocxXml(formatParams.docPath, loaded);

			return {
				success: true,
				data: {
					message: `Table borders applied to table ${tableIndex}`,
					tableIndex,
					bordersModified: result.changed,
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
