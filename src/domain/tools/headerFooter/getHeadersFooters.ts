import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml } from '../shared/docxXml.js';

export function getGetHeadersFootersTool(): Tool {
	return {
		name: 'get_headers_footers',
		description: '获取页眉页脚信息',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
			},
			required: ['docPath'],
		},
		execute: async (params) => {
			const { docPath } = params as { docPath: string };

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);
				const zip = loaded.zip;

				// 获取 header 和 footer 文件
				const headerEntries = zip.getEntries().filter(e => e.entryName.startsWith('word/header'));
				const footerEntries = zip.getEntries().filter(e => e.entryName.startsWith('word/footer'));

				const headers = headerEntries.map(e => ({
					file: e.name,
					content: e.getData().toString('utf8').substring(0, 100)
				}));

				const footers = footerEntries.map(e => ({
					file: e.name,
					content: e.getData().toString('utf8').substring(0, 100)
				}));

				return {
					success: true,
					data: `页眉: ${headers.length} 个\n页脚: ${footers.length} 个\n` +
						(headers.length > 0 ? `页眉文件: ${headers.map(h => h.file).join(', ')}` : '') +
						(footers.length > 0 ? `\n页脚文件: ${footers.map(f => f.file).join(', ')}` : ''),
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
