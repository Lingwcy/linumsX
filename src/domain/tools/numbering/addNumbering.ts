import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { NUMBERING_PRESETS } from '../shared/docxXml/structure.js';
import { createWordElement } from '../shared/docxXml/dom.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const AVAILABLE_PRESETS = Object.keys(NUMBERING_PRESETS);

export function getAddNumberingTool(): Tool {
	return {
		name: 'add_numbering',
		description: '添加多级列表编号',
		schema: {
			type: 'object',
			properties: {
				docPath: { type: 'string', description: '文档路径' },
				preset: {
					type: 'string',
					enum: AVAILABLE_PRESETS,
					description: '预设样式: heading-outline, legal, bullet, decimal-paren, roman-lower'
				},
				target: {
					type: 'string',
					enum: ['headings', 'paragraphs', 'all'],
					description: '应用范围'
				},
				startLevel: {
					type: 'number',
					description: '起始级别 (1-9)'
				}
			},
			required: ['docPath', 'preset'],
		},
		execute: async (params) => {
			const { docPath, preset, target = 'all', startLevel = 1 } = params as {
				docPath: string;
				preset: string;
				target?: 'headings' | 'paragraphs' | 'all';
				startLevel?: number;
			};

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);

				// 获取或创建 numbering.xml
				let numberingEntry = loaded.zip.getEntry('word/numbering.xml');
				let numberingXml = numberingEntry
					? numberingEntry.getData().toString('utf8')
					: getEmptyNumberingXml();

				// 生成唯一的 numId 和 abstractNumId
				const numId = generateNumId(numberingXml);
				const abstractNumId = generateAbstractNumId(numberingXml);

				// 添加抽象编号定义
				numberingXml = addAbstractNumbering(numberingXml, abstractNumId, preset);

				// 添加具体编号引用
				numberingXml = addNumberingReference(numberingXml, numId, abstractNumId);

				// 更新 numbering.xml
				if (numberingEntry) {
					loaded.zip.updateFile('word/numbering.xml', Buffer.from(numberingXml, 'utf8'));
				} else {
					loaded.zip.addFile('word/numbering.xml', Buffer.from(numberingXml, 'utf8'));
				}

				// 更新 document.xml 中的段落引用
				const docXml = loaded.xmlDocument.documentElement;
				const paragraphs = docXml.getElementsByTagName('w:p');

				for (let i = 0; i < paragraphs.length; i++) {
					const p = paragraphs[i];
					const pPr = p.getElementsByTagName('w:pPr')[0];

					// 判断是否应该添加编号
					let shouldAdd = target === 'all';
					if (!shouldAdd && target === 'headings') {
						const pStyle = pPr?.getElementsByTagName('w:pStyle')[0];
						const styleVal = pStyle?.getAttribute('w:val');
						shouldAdd = styleVal?.startsWith('Heading') || false;
					}

					if (shouldAdd) {
						addNumPrToParagraph(p, numId, startLevel);
					}
				}

				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: `编号已添加，预设: ${preset}, 范围: ${target}`,
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

function getEmptyNumberingXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
</w:numbering>`;
}

function generateNumId(xml: string): string {
	const nums = xml.match(/w:num[^>]*w:numId="(\d+)"/g) || [];
	let maxId = 0;
	for (const match of nums) {
		const id = match.match(/w:numId="(\d+)"/)?.[1];
		if (id && parseInt(id) > maxId) maxId = parseInt(id);
	}
	return String(maxId + 1);
}

function generateAbstractNumId(xml: string): string {
	const abstracts = xml.match(/w:abstractNum[^>]*w:abstractNumId="(\d+)"/g) || [];
	let maxId = 0;
	for (const match of abstracts) {
		const id = match.match(/w:abstractNumId="(\d+)"/)?.[1];
		if (id && parseInt(id) > maxId) maxId = parseInt(id);
	}
	return String(maxId + 1);
}

function addAbstractNumbering(xml: string, abstractNumId: string, preset: string): string {
	const presetDef = NUMBERING_PRESETS[preset as keyof typeof NUMBERING_PRESETS];
	if (!presetDef) return xml;

	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'text/xml');
	const numbering = doc.documentElement;

	const abstractNum = doc.createElement('w:abstractNum');
	abstractNum.setAttribute('w:abstractNumId', abstractNumId);

	for (const level of presetDef.levels) {
		const lvl = doc.createElement('w:lvl');
		lvl.setAttribute('w:ilvl', String(level.level));

		const numFmt = doc.createElement('w:numFmt');
		numFmt.setAttribute('w:val', level.numFmt || 'decimal');
		lvl.appendChild(numFmt);

		const lvlText = doc.createElement('w:lvlText');
		lvlText.setAttribute('w:val', level.lvlText || '%1.');
		lvl.appendChild(lvlText);

		const start = doc.createElement('w:start');
		start.setAttribute('w:val', String(level.startNumber || 1));
		lvl.appendChild(start);

		if ((level as any).pStyle) {
			const pStyle = doc.createElement('w:pStyle');
			pStyle.setAttribute('w:val', (level as any).pStyle);
			lvl.appendChild(pStyle);
		}

		abstractNum.appendChild(lvl);
	}

	numbering.appendChild(abstractNum);

	return new XMLSerializer().serializeToString(doc);
}

function addNumberingReference(xml: string, numId: string, abstractNumId: string): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'text/xml');
	const numbering = doc.documentElement;

	const num = doc.createElement('w:num');
	num.setAttribute('w:numId', numId);

	const abstractNumIdEl = doc.createElement('w:abstractNumId');
	abstractNumIdEl.setAttribute('w:val', abstractNumId);
	num.appendChild(abstractNumIdEl);

	numbering.appendChild(num);

	return new XMLSerializer().serializeToString(doc);
}

function addNumPrToParagraph(p: Element, numId: string, startLevel: number): void {
	let pPr = p.getElementsByTagName('w:pPr')[0];
	if (!pPr) {
		pPr = p.ownerDocument.createElement('w:pPr');
		p.insertBefore(pPr, p.firstChild);
	}

	let numPr = pPr.getElementsByTagName('w:numPr')[0];
	if (!numPr) {
		numPr = p.ownerDocument.createElement('w:numPr');
		pPr.appendChild(numPr);
	}

	// 清除旧的 numPr 内容，添加新的
	while (numPr.firstChild) {
		numPr.removeChild(numPr.firstChild);
	}

	const numIdEl = p.ownerDocument.createElement('w:numId');
	numIdEl.setAttribute('w:val', numId);
	numPr.appendChild(numIdEl);

	const ilvl = p.ownerDocument.createElement('w:ilvl');
	ilvl.setAttribute('w:val', String(startLevel - 1));
	numPr.appendChild(ilvl);
}
