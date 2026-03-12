import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml } from '../shared/docxXml.js';
import { parseNumberingEntries, parseAbstractNumbering } from '../shared/docxXml/structure.js';

export function getGetNumberingTool(): Tool {
	return {
		name: 'get_numbering',
		description: '获取文档中的编号信息',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
				showDetails: { type: 'boolean', description: '显示详细信息' },
			},
			required: ['docPath'],
		},
		execute: async (params) => {
			const { docPath, showDetails = false } = params as {
				docPath: string;
				showDetails?: boolean;
			};

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);

				// 检查 numbering.xml 是否存在
				const numberingEntry = loaded.zip.getEntry('word/numbering.xml');
				if (!numberingEntry) {
					return {
						success: true,
						data: '文档中没有编号样式',
					};
				}

				// 解析编号信息
				const numEntries = parseNumberingEntries(loaded);
				const abstracts = parseAbstractNumbering(loaded);

				let result = `编号统计:\n`;
				result += `- 编号样式数量: ${numEntries.length}\n`;
				result += `- 抽象编号定义: ${abstracts.size}\n`;

				if (showDetails) {
					result += '\n编号详情:\n';
					for (const entry of numEntries) {
						result += `\n编号 ID: ${entry.numId}, 抽象ID: ${entry.abstractNumId}\n`;
						const levels = abstracts.get(entry.abstractNumId);
						if (levels && levels.length > 0) {
							for (const lvl of levels) {
								result += `  级别 ${lvl.level}: ${lvl.numFmt} - "${lvl.lvlText}"`;
								if (lvl.pStyle) result += ` (样式: ${lvl.pStyle})`;
								result += '\n';
							}
						}
					}
				}

				return {
					success: true,
					data: result,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	};
}
