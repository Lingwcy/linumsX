import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';

export function getDeletePageNumberTool(): Tool {
	return {
		name: 'delete_page_number',
		description: '删除页码',
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

				// 查找所有 footer 文件
				const footerEntries = zip.getEntries().filter(e => e.entryName.startsWith('word/footer'));

				// 查找包含页码字段的 footer
				let pageNumberFooter: any = null;
				for (const entry of footerEntries) {
					const content = entry.getData().toString('utf8');
					if (content.includes('PAGE')) {
						pageNumberFooter = entry;
						break;
					}
				}

				if (!pageNumberFooter) {
					return {
						success: false,
						error: '文档中没有找到页码',
					};
				}

				// 删除 footer 文件
				zip.deleteFile(pageNumberFooter.entryName);

				// 从 document.xml 中移除 footerReference
				let docXml = loaded.xmlDocument.documentElement;
				const body = docXml.getElementsByTagName('w:body')[0] || docXml;
				const sectPr = body.getElementsByTagName('w:sectPr')[0];

				if (sectPr) {
					const footerRefs = sectPr.getElementsByTagName('w:footerReference');
					if (footerRefs.length > 0) {
						// 移除最后一个 footerReference（通常是页码）
						sectPr.removeChild(footerRefs[footerRefs.length - 1]);
					}
				}

				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: '页码已删除',
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
