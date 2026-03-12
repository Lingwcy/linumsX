import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { createWordElement } from '../shared/docxXml/dom.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export function getDeleteHeaderTool(): Tool {
	return {
		name: 'delete_header',
		description: '删除页眉',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
				headerIndex: { type: 'number', description: '要删除的页眉索引（从0开始）' },
			},
			required: ['docPath'],
		},
		execute: async (params) => {
			const { docPath, headerIndex = 0 } = params as { docPath: string; headerIndex?: number };

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);
				const zip = loaded.zip;

				// 获取所有 header 文件
				const headerEntries = zip.getEntries().filter(e => e.entryName.startsWith('word/header'));

				if (headerEntries.length === 0) {
					return {
						success: false,
						error: '文档中没有页眉',
					};
				}

				if (headerIndex >= headerEntries.length) {
					return {
						success: false,
						error: `页眉索引 ${headerIndex} 不存在，文档中共有 ${headerEntries.length} 个页眉`,
					};
				}

				// 删除 header 文件
				const headerToDelete = headerEntries[headerIndex];
				zip.deleteFile(headerToDelete.entryName);

				// 从 document.xml 中移除 headerReference
				let docXml = loaded.xmlDocument.documentElement;
				const body = docXml.getElementsByTagName('w:body')[0] || docXml;
				const sectPr = body.getElementsByTagName('w:sectPr')[0];

				if (sectPr) {
					const headerRefs = sectPr.getElementsByTagName('w:headerReference');
					if (headerRefs.length > headerIndex) {
						sectPr.removeChild(headerRefs[headerIndex]);
					}
				}

				// 保存文档
				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: '页眉已删除',
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
