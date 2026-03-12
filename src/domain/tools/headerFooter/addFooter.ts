import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { createWordElement } from '../shared/docxXml/dom.js';

export function getAddFooterTool(): Tool {
	return {
		name: 'add_footer',
		description: '添加页脚内容',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
				content: { type: 'string', description: '页脚内容文本' },
				position: { type: 'number', description: '节位置（默认第1节）' },
				options: {
					type: 'object',
					properties: {
						type: { type: 'string', enum: ['primary', 'first', 'even'], description: '页脚类型' }
					},
					description: '页脚选项'
				}
			},
			required: ['docPath', 'content'],
		},
		execute: async (params) => {
			const { docPath, content, position = 0, options = {} } = params as {
				docPath: string;
				content: string;
				position?: number;
				options?: { type?: 'primary' | 'first' | 'even' };
			};

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);

				// 创建 footer XML
				const footerXml = createFooterXml(content);
				const footerFileName = `word/footer${Date.now()}.xml`;
				loaded.zip.addFile(footerFileName, Buffer.from(footerXml, 'utf8'));

				// 更新 document.xml 添加 footer 引用
				let docXml = loaded.xmlDocument.documentElement;
				const body = docXml.getElementsByTagName('w:body')[0] || docXml;

				// 找到或创建 sectPr
				let sectPr = body.getElementsByTagName('w:sectPr')[0];
				if (!sectPr) {
					sectPr = createWordElement(loaded.xmlDocument, 'sectPr');
					body.appendChild(sectPr);
				}

				// 确定 footerReference 类型
				const footerType = options.type === 'even' ? 'even' : 'default';

				// 生成唯一的 r:id
				const newRid = generateRid(loaded);

				// 添加 footerReference
				const footerRef = createWordElement(loaded.xmlDocument, 'footerReference');
				footerRef.setAttribute('w:type', footerType);
				footerRef.setAttribute('r:id', newRid);
				sectPr.appendChild(footerRef);

				// 更新关系文件
				const relsEntry = loaded.zip.getEntry('word/_rels/document.xml.rels');
				if (relsEntry) {
					let relsXml = relsEntry.getData().toString('utf8');
					relsXml = addRelsEntry(relsXml, footerFileName, 'footer', newRid);
					loaded.zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
				}

				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: `页脚已添加: ${content.substring(0, 20)}...`,
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

function generateRid(loaded: ReturnType<typeof loadDocxXml>): string {
	const relsEntry = loaded.zip.getEntry('word/_rels/document.xml.rels');
	if (!relsEntry) {
		return 'rId1';
	}

	const relsXml = relsEntry.getData().toString('utf8');
	const parser = new DOMParser();
	const doc = parser.parseFromString(relsXml, 'text/xml');
	const relationships = doc.getElementsByTagName('Relationship');

	let maxId = 0;
	for (let i = 0; i < relationships.length; i++) {
		const rel = relationships[i];
		const id = rel.getAttribute('Id');
		if (id && id.startsWith('rId')) {
			const num = parseInt(id.substring(3), 10);
			if (!isNaN(num) && num > maxId) {
				maxId = num;
			}
		}
	}

	return `rId${maxId + 1}`;
}

function createFooterXml(content: string): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:ftr>',
		'text/xml'
	);

	const ftr = doc.documentElement;

	// 创建段落
	const p = createWordElement(doc, 'p');

	// 段落属性 - 居中对齐
	const pPr = createWordElement(doc, 'pPr');
	const jc = createWordElement(doc, 'jc');
	jc.setAttribute('w:val', 'center');
	pPr.appendChild(jc);
	p.appendChild(pPr);

	// 文本内容
	const r = createWordElement(doc, 'r');
	const t = createWordElement(doc, 't');
	t.setAttribute('xml:space', 'preserve');
	t.textContent = content;
	r.appendChild(t);
	p.appendChild(r);
	ftr.appendChild(p);

	return new XMLSerializer().serializeToString(doc);
}

function addRelsEntry(relsXml: string, targetFile: string, type: 'header' | 'footer', rid: string): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(relsXml, 'text/xml');
	const relationships = doc.documentElement;

	const relType = type === 'header'
		? 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header'
		: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer';

	const newRel = doc.createElement('Relationship');
	newRel.setAttribute('Id', rid);
	newRel.setAttribute('Type', relType);
	newRel.setAttribute('Target', targetFile.replace('word/', ''));

	relationships.appendChild(newRel);

	return new XMLSerializer().serializeToString(doc);
}
