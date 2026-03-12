import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';

export function getRemoveNumberingTool(): Tool {
	return {
		name: 'remove_numbering',
		description: '移除编号',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
				target: {
					type: 'string',
					enum: ['all', 'headings', 'paragraphs'],
					description: '移除范围'
				},
			},
			required: ['docPath'],
		},
		execute: async (params) => {
			const { docPath, target = 'all' } = params as {
				docPath: string;
				target?: 'all' | 'headings' | 'paragraphs';
			};

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);

				const docXml = loaded.xmlDocument.documentElement;
				const paragraphs = docXml.getElementsByTagName('w:p');
				let removedCount = 0;

				for (let i = 0; i < paragraphs.length; i++) {
					const p = paragraphs[i];
					const pPr = p.getElementsByTagName('w:pPr')[0];
					if (!pPr) continue;

					const numPr = pPr.getElementsByTagName('w:numPr')[0];
					if (!numPr) continue;

					// 判断是否应该移除
					let shouldRemove = target === 'all';
					if (!shouldRemove && target === 'headings') {
						const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
						const styleVal = pStyle?.getAttribute('w:val');
						shouldRemove = styleVal?.startsWith('Heading') || false;
					}

					if (shouldRemove) {
						pPr.removeChild(numPr);
						removedCount++;
					}
				}

				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: `已移除 ${removedCount} 个编号`,
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
