import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Packer, Document as DocxDocument, HeadingLevel, Paragraph } from 'docx';
import { AgentError, ErrorCode } from '../../../../shared/errors/AgentError.js';
import { parseXmlDocument, serializeXmlDocument } from './dom.js';
import { LoadedDocxXml } from './types.js';

export async function ensureEditableDocPath(docPath: string, allowExisting = true): Promise<void> {
	if (!docPath || typeof docPath !== 'string') {
		throw new AgentError('Document path must be a non-empty string', ErrorCode.INVALID_CONFIG, { docPath });
	}

	const resolvedPath = path.resolve(docPath);
	if (path.basename(resolvedPath).startsWith('~$')) {
		throw new AgentError('Temporary Word lock files cannot be edited', ErrorCode.INVALID_CONFIG, { docPath: resolvedPath });
	}

	if (path.extname(resolvedPath).toLowerCase() !== '.docx') {
		throw new AgentError('Only .docx documents are supported', ErrorCode.INVALID_CONFIG, { docPath: resolvedPath });
	}

	if (allowExisting) {
		try {
			await fs.access(resolvedPath);
		} catch {
			throw new AgentError('Document not found', ErrorCode.DOCUMENT_NOT_FOUND, { docPath: resolvedPath });
		}
	}
}

export function loadDocxXml(docPath: string): LoadedDocxXml {
	const zip = new AdmZip(docPath);
	const entry = zip.getEntry('word/document.xml');

	if (!entry) {
		throw new AgentError('Invalid docx file: word/document.xml not found', ErrorCode.DOCUMENT_NOT_FOUND, { docPath });
	}

	const xml = entry.getData().toString('utf8');
	return {
		zip,
		xml,
		xmlDocument: parseXmlDocument(xml),
	};
}

export async function saveDocxXml(docPath: string, loaded: LoadedDocxXml): Promise<void> {
	const xml = serializeXmlDocument(loaded.xmlDocument);
	loaded.xml = xml;
	loaded.zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
	loaded.zip.writeZip(docPath);
}

export async function createEmptyDocument(docPath: string, title?: string): Promise<void> {
	const paragraphs = title
		? [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 })]
		: [new Paragraph({ text: '' })];

	const document = new DocxDocument({
		sections: [{ children: paragraphs }],
	});

	const buffer = await Packer.toBuffer(document);
	await fs.mkdir(path.dirname(docPath), { recursive: true });
	await fs.writeFile(docPath, buffer);
}

export async function listDocxFiles(directory: string): Promise<Array<{ path: string; locked: boolean }>> {
	const results: Array<{ path: string; locked: boolean }> = [];
	const root = path.resolve(directory);

	async function visit(currentPath: string): Promise<void> {
		const entries = await fs.readdir(currentPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			if (entry.isDirectory()) {
				await visit(fullPath);
				continue;
			}

			if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.docx' || entry.name.startsWith('~$')) {
				continue;
			}

			const lockPath = path.join(path.dirname(fullPath), `~$${path.basename(fullPath)}`);
			let locked = false;
			try {
				await fs.access(lockPath);
				locked = true;
			} catch {
				locked = false;
			}

			results.push({ path: fullPath, locked });
		}
	}

	await visit(root);
	return results.sort((left, right) => left.path.localeCompare(right.path));
}