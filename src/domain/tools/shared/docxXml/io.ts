import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Packer, Document as DocxDocument, HeadingLevel, Paragraph } from 'docx';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { AgentError, ErrorCode } from '../../../../shared/errors/AgentError.js';
import { parseXmlDocument, serializeXmlDocument } from './dom.js';
import { LoadedDocxXml } from './types.js';
import { EMU_PER_INCH, IMAGE_EXT_TO_MIME } from './structure.js';

// 魔法数字：docPr id 的随机数范围
const RANDOM_ID_MAX = 100000;

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

export function getImageMimeType(filePath: string): string | null {
	const ext = path.extname(filePath).toLowerCase();
	// Remove leading dot and look up in IMAGE_EXT_TO_MIME
	const extKey = ext.startsWith('.') ? ext.slice(1) : ext;
	return IMAGE_EXT_TO_MIME[extKey] || null;
}

export async function addImageToDocx(
	docPath: string,
	imagePath: string,
	options: {
		position?: number;
		width?: number;
		height?: number;
		description?: string;
	} = {}
): Promise<{ success: boolean; imageName?: string; error?: string }> {
	const { width = 3, height, description } = options;

	// 参数验证
	if (width !== undefined && (width <= 0 || width > 100)) {
		return { success: false, error: '宽度必须在 0-100 英寸之间' };
	}
	if (height !== undefined && (height <= 0 || height > 100)) {
		return { success: false, error: '高度必须在 0-100 英寸之间' };
	}

	// 读取图像文件
	const imageBuffer = await fs.readFile(imagePath);
	const imageName = path.basename(imagePath);
	const mimeType = getImageMimeType(imagePath);

	if (!mimeType) {
		return { success: false, error: `不支持的图像格式: ${path.extname(imagePath)}` };
	}

	// 打开 docx
	const zip = new AdmZip(docPath);

	// 检查 media 目录是否存在，不存在则创建
	const mediaDir = 'word/media';
	const mediaEntries = zip.getEntries().filter(e => e.entryName.startsWith(mediaDir));

	// 获取或创建关系文件，并找到最大的 rId
	let relsEntry = zip.getEntry('word/_rels/document.xml.rels');
	let relsXml = relsEntry ? relsEntry.getData().toString('utf8') : getDefaultRelsXml();
	const maxExistingId = getMaxRelsId(relsXml);
	const nextImageId = maxExistingId + 1;

	// 生成唯一图像名称
	const ext = path.extname(imageName);
	const baseName = path.basename(imageName, ext);
	let uniqueName = imageName;
	let counter = 1;
	while (mediaEntries.some(e => e.name === uniqueName)) {
		uniqueName = `${baseName}_${counter}${ext}`;
		counter++;
	}

	// 添加图像到 ZIP
	zip.addFile(`${mediaDir}/${uniqueName}`, imageBuffer);

	// 添加图像关系到 rels 文件
	const imageRelsId = addImageRel(relsXml, uniqueName, nextImageId);

	// 更新关系文件
	zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));

	// 添加图像到 document.xml
	const docEntry = zip.getEntry('word/document.xml');
	if (!docEntry) {
		return { success: false, error: '无法读取文档内容' };
	}
	const docXml = docEntry.getData().toString('utf8');
	const updatedDocXml = insertImageIntoDocument(docXml, uniqueName, imageRelsId, mimeType, {
		width,
		height,
		description,
	});

	zip.updateFile('word/document.xml', Buffer.from(updatedDocXml, 'utf8'));
	zip.writeZip(docPath);

	return { success: true, imageName: uniqueName };
}

function getDefaultRelsXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
}

/**
 * Parse rels XML and find the maximum rId number
 */
function getMaxRelsId(relsXml: string): number {
	const parser = new DOMParser();
	const doc = parser.parseFromString(relsXml, 'text/xml');
	const relationships = doc.getElementsByTagName('Relationship');
	let maxId = 0;

	for (let i = 0; i < relationships.length; i++) {
		const id = relationships[i].getAttribute('Id');
		if (id && id.startsWith('rId')) {
			const num = parseInt(id.slice(3), 10);
			if (!isNaN(num) && num > maxId) {
				maxId = num;
			}
		}
	}

	return maxId;
}

function addImageRel(relsXml: string, imageName: string, id: number): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(relsXml, 'text/xml');
	const relationships = doc.documentElement;

	const newRel = doc.createElement('Relationship');
	newRel.setAttribute('Id', `rId${id}`);
	newRel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
	newRel.setAttribute('Target', `media/${imageName}`);

	relationships.appendChild(newRel);

	const serializer = new XMLSerializer();
	relsXml = serializer.serializeToString(doc);
	return `rId${id}`;
}

function insertImageIntoDocument(
	docXml: string,
	imageName: string,
	relId: string,
	mimeType: string,
	options: { width: number; height?: number; description?: string }
): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(docXml, 'text/xml');
	const body = doc.documentElement;

	// 创建图像元素
	const widthEmus = Math.round(options.width * EMU_PER_INCH);
	const heightEmus = options.height ? Math.round(options.height * EMU_PER_INCH) : widthEmus;

	// 构建 w:drawing 元素
	const drawing = doc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:drawing');

	// wp:inline
	const inline = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:inline');

	// wp:extent
	const extent = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:extent');
	extent.setAttribute('cx', String(widthEmus));
	extent.setAttribute('cy', String(heightEmus));
	inline.appendChild(extent);

	// wp:docPr
	const docPr = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:docPr');
	docPr.setAttribute('id', String(Math.floor(Math.random() * RANDOM_ID_MAX)));
	docPr.setAttribute('name', imageName);
	if (options.description) {
		docPr.setAttribute('descr', options.description);
	}
	inline.appendChild(docPr);

	// a:graphic
	const graphic = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:graphic');

	// a:graphicData
	const graphicData = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:graphicData');
	graphicData.setAttribute('uri', 'http://schemas.openxmlformats.org/drawingml/2006/main');

	// pic:pic
	const pic = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:pic');

	// pic:nvPicPr
	const nvPicPr = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:nvPicPr');
	const picLocks = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:cNvPicPr');
	picLocks.setAttribute('noChangeAspect', '1');
	picLocks.setAttribute('name', imageName);
	nvPicPr.appendChild(picLocks);

	const nvPicPrChild = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:nvPr');
	nvPicPr.appendChild(nvPicPrChild);
	pic.appendChild(nvPicPr);

	// pic:blipFill
	const blipFill = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:blipFill');
	const blip = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:blip');
	blip.setAttribute('r:embed', relId);
	blipFill.appendChild(blip);

	const stretch = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:stretch');
	const fillRect = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:fillRect');
	stretch.appendChild(fillRect);
	blipFill.appendChild(stretch);
	pic.appendChild(blipFill);

	// pic:spPr
	const spPr = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:spPr');
	const xfrm = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:xfrm');
	const off = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:off');
	off.setAttribute('x', '0');
	off.setAttribute('y', '0');
	xfrm.appendChild(off);
	const ext = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:ext');
	ext.setAttribute('cx', String(widthEmus));
	ext.setAttribute('cy', String(heightEmus));
	xfrm.appendChild(ext);
	spPr.appendChild(xfrm);
	pic.appendChild(spPr);

	graphicData.appendChild(pic);
	graphic.appendChild(graphicData);
	inline.appendChild(graphic);
	drawing.appendChild(inline);

	// 找到 body 的最后一个子元素
	const lastChild = body.lastChild;
	if (lastChild) {
		body.insertBefore(drawing, lastChild.nextSibling);
	} else {
		body.appendChild(drawing);
	}

	return new XMLSerializer().serializeToString(doc);
}