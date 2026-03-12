import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import { formatTextTool } from '../../../src/domain/tools/formatting/formatText.js';
import { formatParagraphTool } from '../../../src/domain/tools/formatting/formatParagraph.js';
import { formatTableTool } from '../../../src/domain/tools/formatting/formatTable.js';
import { loadDocxXml } from '../../../src/domain/tools/shared/docxXml.js';

async function createTempDocx(name: string, withTable = false): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-doc-ts-'));
	const filePath = path.join(dir, name);
	const children = [new Paragraph('Alpha Beta')];

	if (withTable) {
		children.push(
			new Table({
				rows: [
					new TableRow({
						children: [
							new TableCell({ children: [new Paragraph('Header A')] }),
							new TableCell({ children: [new Paragraph('Header B')] }),
						],
					}),
				],
			}),
		);
	}

	const document = new Document({
		sections: [{ children }],
	});
	const buffer = await Packer.toBuffer(document);
	await fs.writeFile(filePath, buffer);
	return filePath;
}

function wrapTextRunInHyperlink(docPath: string, targetText: string): void {
	const zip = new AdmZip(docPath);
	const entry = zip.getEntry('word/document.xml');
	if (!entry) {
		throw new Error('word/document.xml not found');
	}

	const parser = new DOMParser();
	const serializer = new XMLSerializer();
	const xml = entry.getData().toString('utf8');
	const document = parser.parseFromString(xml, 'application/xml');
	const textNodes = Array.from(document.getElementsByTagName('w:t')) as Array<any>;
	const targetNode = textNodes.find(node => (node.textContent ?? '').includes(targetText));
	if (!targetNode) {
		throw new Error(`Target text not found: ${targetText}`);
	}

	let run = targetNode.parentNode;
	while (run && run.nodeName !== 'w:r') {
		run = run.parentNode;
	}
	if (!run || !run.parentNode) {
		throw new Error('Target run not found');
	}

	const fullText = targetNode.textContent ?? '';
	const matchIndex = fullText.indexOf(targetText);
	const beforeText = fullText.slice(0, matchIndex);
	const afterText = fullText.slice(matchIndex + targetText.length);
	const parent = run.parentNode;

	const makeRun = (text: string) => {
		const clone = run.cloneNode(true);
		const cloneTextNodes = Array.from(clone.getElementsByTagName('w:t')) as Array<any>;
		cloneTextNodes[0].textContent = text;
		for (let index = cloneTextNodes.length - 1; index >= 1; index--) {
			cloneTextNodes[index].parentNode?.removeChild(cloneTextNodes[index]);
		}
		return clone;
	};

	if (beforeText) {
		parent.insertBefore(makeRun(beforeText), run);
	}

	const hyperlink = document.createElement('w:hyperlink');
	hyperlink.setAttribute('r:id', 'rId9');
	hyperlink.appendChild(makeRun(targetText));
	parent.insertBefore(hyperlink, run);

	if (afterText) {
		parent.insertBefore(makeRun(afterText), run);
	}

	parent.removeChild(run);
	const wrappedXml = serializer.serializeToString(document);

	zip.updateFile('word/document.xml', Buffer.from(wrappedXml, 'utf8'));
	zip.writeZip(docPath);
}

describe('formatting tools', () => {
	it('formatTextTool applies run formatting to matching text', async () => {
		const docPath = await createTempDocx('format-text.docx');

		const result = await formatTextTool.execute({
			docPath,
			targetText: 'Beta',
			bold: true,
			color: '#FF0000',
		});

		expect(result.success).toBe(true);
		const xml = loadDocxXml(docPath).xml;
		expect(xml).toContain('<w:b/>');
		expect(xml).toContain('<w:color w:val="FF0000"/>');
		expect(xml).toContain('Beta');
	});

	it('formatParagraphTool applies paragraph properties', async () => {
		const docPath = await createTempDocx('format-paragraph.docx');

		const result = await formatParagraphTool.execute({
			docPath,
			alignment: 'center',
			lineSpacing: 1.5,
			spaceBefore: 6,
			spaceAfter: 8,
		});

		expect(result.success).toBe(true);
		const xml = loadDocxXml(docPath).xml;
		expect(xml).toContain('<w:jc w:val="center"/>');
		expect(xml).toContain('<w:spacing w:line="360" w:lineRule="auto" w:before="120" w:after="160"/>');
	});

	it('formatTableTool applies cell and run formatting to a table', async () => {
		const docPath = await createTempDocx('format-table.docx', true);

		const result = await formatTableTool.execute({
			docPath,
			tableIndex: 0,
			bold: true,
			bgColor: '#00FF00',
			align: 'center',
		});

		expect(result.success).toBe(true);
		const xml = loadDocxXml(docPath).xml;
		expect(xml).toContain('<w:shd w:fill="00FF00"/>');
		expect(xml).toContain('<w:b/>');
		expect(xml).toContain('<w:jc w:val="center"/>');
	});

	it('formatTextTool preserves hyperlink wrappers when formatting target text in-place', async () => {
		const docPath = await createTempDocx('format-hyperlink.docx');
		wrapTextRunInHyperlink(docPath, 'Beta');

		const result = await formatTextTool.execute({
			docPath,
			targetText: 'Beta',
			underline: true,
			color: '#3366FF',
		});

		expect(result.success).toBe(true);
		const xml = loadDocxXml(docPath).xml;
		expect(xml).toContain('<w:hyperlink r:id="rId9">');
		expect(xml).toContain('<w:u w:val="single"/>');
		expect(xml).toContain('<w:color w:val="3366FF"/>');
	});
});