import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Document, Packer, Paragraph } from 'docx';
import { addContentTool } from '../../../src/domain/tools/content/addContent.js';
import { loadDocxXml, parseParagraphEntries } from '../../../src/domain/tools/shared/docxXml.js';

async function createTempDocx(name: string): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-doc-ts-add-content-'));
	const filePath = path.join(dir, name);
	const document = new Document({
		sections: [{ children: [new Paragraph('seed')] }],
	});
	const buffer = await Packer.toBuffer(document);
	await fs.writeFile(filePath, buffer);
	return filePath;
}

describe('addContentTool', () => {
	it('adds heading content using headingLevel when type is heading', async () => {
		const docPath = await createTempDocx('add-content-heading.docx');

		const result = await addContentTool.execute({
			docPath,
			content: 'Section Heading',
			type: 'heading',
			headingLevel: 3,
		});

		expect(result.success).toBe(true);
		const paragraphs = parseParagraphEntries(loadDocxXml(docPath));
		expect(paragraphs.at(-1)).toMatchObject({
			text: 'Section Heading',
			style: 'Heading3',
		});
	});
});