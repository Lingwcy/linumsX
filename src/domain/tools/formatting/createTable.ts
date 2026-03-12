import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import {
	ensureEditableDocPath,
	loadDocxXml,
	saveDocxXml,
} from '../shared/docxXml.js';
import {
	createWordElement,
	getBody,
	getDirectChild,
} from '../shared/docxXml/dom.js';

interface CreateTableParams {
	docPath: string;
	rows: number;
	columns: number;
	data?: string[][];
}

export const createTableTool: Tool = {
	name: 'create_table',
	description: '在文档中创建一个新表格',
	schema: {
		type: 'object',
		properties: {
			docPath: { type: 'string', description: '文档路径' },
			rows: { type: 'number', description: '行数' },
			columns: { type: 'number', description: '列数' },
			data: {
				type: 'array',
				items: { type: 'array', items: { type: 'string' } },
				description: '表格数据（可选，按行填充）'
			},
		},
		required: ['docPath', 'rows', 'columns'],
	},
	execute: async (params) => {
		const p = params as CreateTableParams;

		try {
			await ensureEditableDocPath(p.docPath);
			const loaded = loadDocxXml(p.docPath);

			const table = createWordElement(loaded.xmlDocument, 'w:tbl');

			// 创建表格属性
			const tblPr = createWordElement(loaded.xmlDocument, 'w:tblPr');
			const tblStyle = createWordElement(loaded.xmlDocument, 'w:tblStyle');
			tblStyle.setAttribute('w:val', 'TableGrid');
			tblPr.appendChild(tblStyle);

			// 表格网格
			const tblGrid = createWordElement(loaded.xmlDocument, 'w:tblGrid');
			for (let c = 0; c < p.columns; c++) {
				const gridCol = createWordElement(loaded.xmlDocument, 'w:gridCol');
				gridCol.setAttribute('w:w', String(Math.round(4000 / p.columns)));
				tblGrid.appendChild(gridCol);
			}
			table.appendChild(tblGrid);
			table.appendChild(tblPr);

			// 创建行和单元格
			const numRows = p.rows;
			const numCols = p.columns;

			for (let r = 0; r < numRows; r++) {
				const row = createWordElement(loaded.xmlDocument, 'w:tr');

				for (let c = 0; c < numCols; c++) {
					const cell = createWordElement(loaded.xmlDocument, 'w:tc');

					// 单元格属性
					const tcPr = createWordElement(loaded.xmlDocument, 'w:tcPr');
					const tcWidth = createWordElement(loaded.xmlDocument, 'w:tcW');
					tcWidth.setAttribute('w:w', String(Math.round(4000 / p.columns)));
					tcWidth.setAttribute('w:type', 'dxa');
					tcPr.appendChild(tcWidth);
					cell.appendChild(tcPr);

					// 单元格内容
					const para = createWordElement(loaded.xmlDocument, 'w:p');
					const run = createWordElement(loaded.xmlDocument, 'w:r');
					const text = createWordElement(loaded.xmlDocument, 'w:t');

					// 填充数据
					const cellText = p.data?.[r]?.[c] ?? '';
					text.textContent = cellText;

					run.appendChild(text);
					para.appendChild(run);
					cell.appendChild(para);

					row.appendChild(cell);
				}

				table.appendChild(row);
			}

			// 插入表格到文档正文
			const body = getBody(loaded.xmlDocument);
			const section = getDirectChild(body, 'sectPr');
			body.insertBefore(table, section ?? null);

			await saveDocxXml(p.docPath, loaded);

			return {
				success: true,
				data: {
					message: `Created table with ${numRows} rows and ${numCols} columns`,
					rows: numRows,
					columns: numCols,
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
