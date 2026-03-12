import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Document as DocxDocument, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import { Document } from '../../src/domain/document/entities/Document.js';
import { replaceBlockBetweenAnchorsTool } from '../../src/domain/tools/content/replaceBlockBetweenAnchors.js';
import { getTableDimensions, loadDocxXml, parseParagraphEntries, parseTableEntries } from '../../src/domain/tools/shared/docxXml.js';

async function createStructuredDocx(name: string): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-doc-ts-'));
	const filePath = path.join(dir, name);
	const document = new DocxDocument({
		sections: [{
			children: [
				new Paragraph({ text: 'Overview', heading: HeadingLevel.HEADING_1 }),
				new Paragraph('Start Anchor'),
				new Paragraph('Middle Content'),
				new Paragraph('End Anchor'),
				new Table({
					rows: [
						new TableRow({
							children: [
								new TableCell({ children: [new Paragraph('R1C1')] }),
								new TableCell({ children: [new Paragraph('R1C2')] }),
							],
						}),
						new TableRow({
							children: [
								new TableCell({ children: [new Paragraph('R2C1')] }),
								new TableCell({ children: [new Paragraph('R2C2')] }),
							],
						}),
					],
				}),
			],
		}],
	});

	await fs.writeFile(filePath, await Packer.toBuffer(document));
	return filePath;
}

describe('docx XML DOM helpers', () => {
	it('parses document structure through DOM helpers', async () => {
		const docPath = await createStructuredDocx('structured.docx');
		const loaded = loadDocxXml(docPath);

		const paragraphs = parseParagraphEntries(loaded);
		const tables = parseTableEntries(loaded);

		expect(paragraphs.some(paragraph => paragraph.text === 'Overview')).toBe(true);
		expect(paragraphs.some(paragraph => paragraph.text === 'R1C1')).toBe(true);
		expect(tables).toHaveLength(1);
		expect(getTableDimensions(tables[0])).toEqual({ rows: 2, columns: 2 });
	});

	it('Document.load uses the shared DOM parser for headings and tables', async () => {
		const docPath = await createStructuredDocx('document-load.docx');
		const document = new Document(docPath);

		await document.load();

		expect(document.headingOutline).toEqual([{ level: 1, text: 'Overview' }]);
		expect(document.tables).toEqual([{ rows: 2, columns: 2 }]);
		expect(document.getText()).toContain('Middle Content');
	});

	it('replaces content between anchors through DOM mutations', async () => {
		const docPath = await createStructuredDocx('replace-between-anchors.docx');

		const result = await replaceBlockBetweenAnchorsTool.execute({
			docPath,
			startAnchor: 'Start Anchor',
			endAnchor: 'End Anchor',
			newContent: ['Inserted One', 'Inserted Two'],
		});

		expect(result.success).toBe(true);
		const paragraphs = parseParagraphEntries(loadDocxXml(docPath)).map(paragraph => paragraph.text);
		expect(paragraphs).toContain('Inserted One');
		expect(paragraphs).toContain('Inserted Two');
		expect(paragraphs).not.toContain('Middle Content');
	});
});