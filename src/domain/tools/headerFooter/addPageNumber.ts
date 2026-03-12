import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { createWordElement } from '../shared/docxXml/dom.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export function getAddPageNumberTool(): Tool {
	return {
		name: 'add_page_number',
		description: '添加页码',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
				format: { type: 'string', enum: ['1,2,3', 'I,II,III', 'A,B,C'], description: '页码格式' },
				position: { type: 'string', enum: ['footer', 'header'], description: '位置' },
			},
			required: ['docPath'],
		},
		execute: async (params) => {
			const { docPath, format = '1,2,3', position = 'footer' } = params as {
				docPath: string;
				format?: '1,2,3' | 'I,II,III' | 'A,B,C';
				position?: 'footer' | 'header';
			};

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);

				// 创建包含页码的 footer/header
				const pageNumXml = createPageNumberXml(loaded.xmlDocument, position, format);
				const fileName = position === 'footer'
					? `word/footer${Date.now()}.xml`
					: `word/header${Date.now()}.xml`;

				loaded.zip.addFile(fileName, Buffer.from(pageNumXml, 'utf8'));

				// 生成唯一的 r:id
				const newRid = generateRid(loaded);

				// 添加引用到 document.xml
				let docXml = loaded.xmlDocument.documentElement;
				const body = docXml.getElementsByTagName('w:body')[0] || docXml;

				let sectPr = body.getElementsByTagName('w:sectPr')[0];
				if (!sectPr) {
					sectPr = createWordElement(loaded.xmlDocument, 'sectPr');
					body.appendChild(sectPr);
				}

				// 添加 footerReference 或 headerReference
				const refName = position === 'footer' ? 'footerReference' : 'headerReference';
				const ref = createWordElement(loaded.xmlDocument, refName);
				ref.setAttribute('w:type', 'default');
				ref.setAttribute('r:id', newRid);
				sectPr.appendChild(ref);

				// 更新关系文件
				const relsEntry = loaded.zip.getEntry('word/_rels/document.xml.rels');
				if (relsEntry) {
					let relsXml = relsEntry.getData().toString('utf8');
					relsXml = addRelsEntry(relsXml, fileName, position, newRid);
					loaded.zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
				}

				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: `页码已添加，格式: ${format}，位置: ${position}`,
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

function createPageNumberXml(xmlDocument: any, position: string, format: string): string {
	// 映射格式到 Word 的 numFmt 值
	const numFmtMap: Record<string, string> = {
		'1,2,3': 'decimal',
		'I,II,III': 'upperRoman',
		'A,B,C': 'upperLetter'
	};
	const numFmt = numFmtMap[format] || 'decimal';

	const isFooter = position === 'footer';
	const containerTag = isFooter ? 'w:ftr' : 'w:hdr';

	const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<${containerTag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:fldChar w:fldCharType="begin" w:separate=""/>
    </w:r>
    <w:r>
      <w:instrText>PAGE \\* ${numFmt}</w:instrText>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="separate"/>
    </w:r>
    <w:r>
      <w:t>1</w:t>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>
</${containerTag}>`;

	return xml;
}

function addRelsEntry(relsXml: string, targetFile: string, position: string, rid: string): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(relsXml, 'text/xml');
	const relationships = doc.documentElement;

	const relType = position === 'footer'
		? 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer'
		: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header';

	const newRel = doc.createElement('Relationship');
	newRel.setAttribute('Id', rid);
	newRel.setAttribute('Type', relType);
	newRel.setAttribute('Target', targetFile.replace('word/', ''));

	relationships.appendChild(newRel);

	return new XMLSerializer().serializeToString(doc);
}
