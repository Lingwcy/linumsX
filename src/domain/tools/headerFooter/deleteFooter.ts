import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';

export function getDeleteFooterTool(): Tool {
	return {
		name: 'delete_footer',
		description: '删除页脚',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
				footerIndex: { type: 'number', description: '要删除的页脚索引（从0开始）' },
			},
			required: ['docPath'],
		},
		execute: async (params) => {
			const { docPath, footerIndex = 0 } = params as { docPath: string; footerIndex?: number };

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);
				const zip = loaded.zip;

				// 获取所有 footer 文件
				const footerEntries = zip.getEntries().filter(e => e.entryName.startsWith('word/footer'));

				if (footerEntries.length === 0) {
					return {
						success: false,
						error: '文档中没有页脚',
					};
				}

				if (footerIndex >= footerEntries.length) {
					return {
						success: false,
						error: `页脚索引 ${footerIndex} 不存在，文档中共有 ${footerEntries.length} 个页脚`,
					};
				}

				// 删除 footer 文件
				const footerToDelete = footerEntries[footerIndex];
				zip.deleteFile(footerToDelete.entryName);

				// 从 document.xml 中移除 footerReference
				let docXml = loaded.xmlDocument.documentElement;
				const body = docXml.getElementsByTagName('w:body')[0] || docXml;
				const sectPr = body.getElementsByTagName('w:sectPr')[0];

				if (sectPr) {
					const footerRefs = sectPr.getElementsByTagName('w:footerReference');
					if (footerRefs.length > footerIndex) {
						sectPr.removeChild(footerRefs[footerIndex]);
					}
				}

				// 保存文档
				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: '页脚已删除',
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
