import { AgentError, ErrorCode } from '../../../../shared/errors/AgentError.js';
import {
	buildRunElement,
	createWordElement,
	getBody,
	getDirectChild,
	getDirectWordChildren,
	getLocalName,
	getParagraphStyle,
	getParagraphText,
	getWordElements,
	parseXmlDocument,
	serializeXmlDocument,
} from './dom.js';
import { ImageEntry, LoadedDocxXml, ParagraphEntry, TableEntry, XmlDocument, XmlElement } from './types.js';

export function parseParagraphEntries(source: LoadedDocxXml | XmlDocument | XmlElement): ParagraphEntry[] {
	const root = 'xmlDocument' in (source as LoadedDocxXml) ? (source as LoadedDocxXml).xmlDocument : source;
	return getWordElements(root, 'p').map((element: XmlElement) => ({
		text: getParagraphText(element),
		style: getParagraphStyle(element),
		element,
	}));
}

export function buildParagraphXml(text: string, style?: string): string {
	const xmlDocument = parseXmlDocument('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>');
	return serializeXmlDocument(buildParagraphElement(xmlDocument, text, style));
}

export function appendParagraphs(loaded: LoadedDocxXml, paragraphs: Array<{ text: string; style?: string }>): void {
	const body = getBody(loaded.xmlDocument);
	const section = getDirectChild(body, 'sectPr');

	for (const paragraph of paragraphs) {
		const element = buildParagraphElement(loaded.xmlDocument, paragraph.text, paragraph.style);
		body.insertBefore(element, section ?? null);
	}
}

export function replaceParagraphAt(loaded: LoadedDocxXml, paragraph: ParagraphEntry, text: string, style?: string): void {
	const replacement = buildParagraphElement(loaded.xmlDocument, text, style ?? paragraph.style);
	paragraph.element.parentNode?.replaceChild(replacement, paragraph.element);
}

export function parseTableEntries(source: LoadedDocxXml | XmlDocument | XmlElement): TableEntry[] {
	const root = 'xmlDocument' in (source as LoadedDocxXml) ? (source as LoadedDocxXml).xmlDocument : source;
	return getWordElements(root, 'tbl').map((element: XmlElement) => ({ element }));
}

export const EMU_PER_INCH = 914400;

export const IMAGE_EXT_TO_MIME: Record<string, string> = {
	png: 'image/png',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	gif: 'image/gif',
	bmp: 'image/bmp',
	tiff: 'image/tiff',
	svg: 'image/svg+xml',
};

/**
 * Infer MIME type from image filename/extension
 */
function inferMimeType(name: string): string {
	const ext = name.split('.').pop()?.toLowerCase() ?? '';
	return IMAGE_EXT_TO_MIME[ext] ?? 'image/png';
}

/**
 * Get element by namespace prefix (e.g., wp:inline, a:graphic)
 */
function getElementsByTagNameNs(element: XmlElement, nsUri: string, localName: string): XmlElement[] {
	const elements: XmlElement[] = [];
	const tags = element.getElementsByTagNameNS(nsUri, localName);
	for (let i = 0; i < tags.length; i++) {
		elements.push(tags.item(i) as XmlElement);
	}
	// Fallback: try with prefix
	if (elements.length === 0) {
		const prefixed = element.getElementsByTagName(`${localName}`);
		for (let i = 0; i < prefixed.length; i++) {
			const el = prefixed.item(i) as XmlElement;
			if (getLocalName(el) === localName) {
				elements.push(el);
			}
		}
	}
	return elements;
}


export function parseImageEntries(source: LoadedDocxXml | XmlDocument | XmlElement): ImageEntry[] {
	const root = 'xmlDocument' in (source as LoadedDocxXml) ? (source as LoadedDocxXml).xmlDocument : source;

	// Find all w:drawing elements
	const drawings = getWordElements(root, 'drawing');
	const images: ImageEntry[] = [];

	for (const drawing of drawings) {
		// Check for wp:inline or wp:anchor
		const inline = getDirectWordChildren(drawing, 'inline')[0];
		const anchor = getDirectWordChildren(drawing, 'anchor')[0];
		const graphicContainer = inline ?? anchor;

		if (!graphicContainer) continue;

		// Get wp:graphic
		const graphics = getDirectWordChildren(graphicContainer, 'graphic');
		for (const graphic of graphics) {
			// Get wp:graphicData
			const graphicDataList = getDirectWordChildren(graphic, 'graphicData');
			for (const graphicData of graphicDataList) {
				// Check for pic element (picture)
				const picList = getDirectWordChildren(graphicData, 'pic');
				for (const pic of picList) {
					// Extract name from nvPicPr/picLocks/@name
					const nvPicPr = getDirectWordChildren(pic, 'nvPicPr')[0];
					const picLocks = nvPicPr ? getDirectWordChildren(nvPicPr, 'picLocks')[0] : null;
					const name = picLocks?.getAttribute('name') ?? `image_${images.length + 1}`;

					// Extract id from blipFill/blip/@r:embed
					const blipFill = getDirectWordChildren(pic, 'blipFill')[0];
					const blip = blipFill ? getDirectWordChildren(blipFill, 'blip')[0] : null;
					const id = blip?.getAttribute('r:embed') ?? '';

					// Extract width/height from spPr/xfrm/ext/@cx/@cy
					const spPr = getDirectWordChildren(pic, 'spPr')[0];
					const xfrm = spPr ? getDirectWordChildren(spPr, 'xfrm')[0] : null;
					const ext = xfrm ? getDirectWordChildren(xfrm, 'ext')[0] : null;

					let width: number | undefined;
					let height: number | undefined;

					if (ext) {
						const cx = ext.getAttribute('cx');
						const cy = ext.getAttribute('cy');
						if (cx) width = parseInt(cx, 10) / EMU_PER_INCH;
						if (cy) height = parseInt(cy, 10) / EMU_PER_INCH;
					}

					const type = inferMimeType(name);

					images.push({
						name,
						id,
						type,
						width,
						height,
						element: pic,
					});
				}
			}
		}
	}

	return images;
}

export function replaceBlockBetweenAnchors(
	loaded: LoadedDocxXml,
	startAnchor: string,
	endAnchor: string,
	newContent: string[],
): { xml: string; startIndex: number; endIndex: number } {
	const paragraphs = parseParagraphEntries(loaded);
	const startIndex = paragraphs.findIndex(paragraph => paragraph.text.includes(startAnchor));
	if (startIndex < 0) {
		throw new AgentError(`Start anchor not found: ${startAnchor}`, ErrorCode.TOOL_EXECUTION_FAILED, { startAnchor });
	}

	const endIndex = paragraphs.findIndex((paragraph, index) => index > startIndex && paragraph.text.includes(endAnchor));
	if (endIndex < 0) {
		throw new AgentError(`End anchor not found: ${endAnchor}`, ErrorCode.TOOL_EXECUTION_FAILED, { endAnchor });
	}

	const startParagraph = paragraphs[startIndex].element;
	const endParagraph = paragraphs[endIndex].element;
	const parent = startParagraph.parentNode;

	if (!parent || parent !== endParagraph.parentNode) {
		throw new AgentError('Anchors must exist under the same parent container', ErrorCode.TOOL_EXECUTION_FAILED, { startAnchor, endAnchor });
	}

	for (let index = startIndex + 1; index < endIndex; index++) {
		const element = paragraphs[index].element;
		element.parentNode?.removeChild(element);
	}

	for (const text of newContent) {
		parent.insertBefore(buildParagraphElement(loaded.xmlDocument, text), endParagraph);
	}

	return { xml: serializeXmlDocument(loaded.xmlDocument), startIndex, endIndex };
}

export function getTableDimensions(table: TableEntry | XmlElement): { rows: number; columns: number } {
	const tableElement = 'element' in (table as TableEntry) ? (table as TableEntry).element : table;
	const rows = getDirectWordChildren(tableElement, 'tr');
	const columns = rows.length > 0 ? getDirectWordChildren(rows[0], 'tc').length : 0;
	return { rows: rows.length, columns };
}

function buildParagraphElement(xmlDocument: XmlDocument, text: string, style?: string): XmlElement {
	const paragraph = createWordElement(xmlDocument, 'p');

	if (style) {
		const properties = createWordElement(xmlDocument, 'pPr');
		const styleElement = createWordElement(xmlDocument, 'pStyle');
		styleElement.setAttribute('w:val', style);
		properties.appendChild(styleElement);
		paragraph.appendChild(properties);
	}

	paragraph.appendChild(buildRunElement(xmlDocument, text));
	return paragraph;
}

export function addTableRow(
	table: XmlElement,
	rowIndex?: number,
	cellContents?: string[],
	isHeader?: boolean,
): number {
	const rows = getDirectWordChildren(table, 'tr');
	const numCols = rows.length > 0 ? getDirectWordChildren(rows[0], 'tc').length : 1;
	const insertIndex = rowIndex !== undefined ? Math.min(rowIndex, rows.length) : rows.length;

	const newRow = createWordElement(table.ownerDocument, 'tr');

	const contentLength = cellContents?.length ?? numCols;
	for (let i = 0; i < Math.max(contentLength, numCols); i++) {
		const cell = createWordElement(table.ownerDocument, 'tc');
		const cellProps = createWordElement(table.ownerDocument, 'tcPr');
		const cellWidth = createWordElement(table.ownerDocument, 'tcW');
		cellWidth.setAttribute('w:w', String(Math.round(10000 / Math.max(contentLength, numCols))));
		cellWidth.setAttribute('w:type', 'dxa');
		cellProps.appendChild(cellWidth);
		cell.appendChild(cellProps);

		const para = createWordElement(table.ownerDocument, 'p');
		const run = createWordElement(table.ownerDocument, 'r');
		const textEl = createWordElement(table.ownerDocument, 't');
		textEl.textContent = cellContents?.[i] ?? '';
		run.appendChild(textEl);
		para.appendChild(run);
		cell.appendChild(para);

		if (isHeader && i === 0) {
			const pPr = createWordElement(table.ownerDocument, 'pPr');
			const pStyle = createWordElement(table.ownerDocument, 'pStyle');
			pStyle.setAttribute('w:val', 'Heading1');
			pPr.appendChild(pStyle);
			para.insertBefore(pPr, para.firstChild);
		}

		newRow.appendChild(cell);
	}

	if (insertIndex === 0) {
		table.insertBefore(newRow, table.firstChild);
	} else {
		const refRow = rows[insertIndex - 1];
		table.insertBefore(newRow, refRow.nextSibling);
	}

	return insertIndex;
}

export function deleteTableRow(table: XmlElement, rowIndex?: number): boolean {
	const rows = getDirectWordChildren(table, 'tr');
	if (rows.length === 0) return false;

	const deleteIndex = rowIndex !== undefined ? Math.min(rowIndex, rows.length - 1) : rows.length - 1;
	const rowToDelete = rows[deleteIndex];
	table.removeChild(rowToDelete);

	return true;
}

export function addTableColumn(table: XmlElement, columnIndex?: number): number {
	const rows = getDirectWordChildren(table, 'tr');
	if (rows.length === 0) return -1;

	const numCols = getDirectWordChildren(rows[0], 'tc').length;
	const insertIndex = columnIndex !== undefined ? Math.min(columnIndex, numCols) : numCols;

	for (const row of rows) {
		const cells = getDirectWordChildren(row, 'tc');
		const newCell = createWordElement(row.ownerDocument, 'tc');

		const cellProps = createWordElement(row.ownerDocument, 'tcPr');
		const cellWidth = createWordElement(row.ownerDocument, 'tcW');
		cellWidth.setAttribute('w:w', '2000');
		cellWidth.setAttribute('w:type', 'dxa');
		cellProps.appendChild(cellWidth);
		newCell.appendChild(cellProps);

		const para = createWordElement(row.ownerDocument, 'p');
		const run = createWordElement(row.ownerDocument, 'r');
		const textEl = createWordElement(row.ownerDocument, 't');
		textEl.textContent = '';
		run.appendChild(textEl);
		para.appendChild(run);
		newCell.appendChild(para);

		if (insertIndex === 0) {
			row.insertBefore(newCell, row.firstChild);
		} else {
			const refCell = cells[insertIndex - 1];
			row.insertBefore(newCell, refCell?.nextSibling ?? null);
		}
	}

	return insertIndex;
}

export function deleteTableColumn(table: XmlElement, columnIndex?: number): boolean {
	const rows = getDirectWordChildren(table, 'tr');
	if (rows.length === 0) return false;

	const numCols = getDirectWordChildren(rows[0], 'tc').length;
	if (numCols === 0) return false;

	const deleteIndex = columnIndex !== undefined ? Math.min(columnIndex, numCols - 1) : numCols - 1;

	for (const row of rows) {
		const cells = getDirectWordChildren(row, 'tc');
		const cellToDelete = cells[deleteIndex];
		if (cellToDelete) {
			row.removeChild(cellToDelete);
		}
	}

	return true;
}

export interface MergeCellsOptions {
	startRow: number;
	startCol: number;
	endRow: number;
	endCol: number;
}

export function mergeCells(
	table: XmlElement,
	options: MergeCellsOptions,
): { success: boolean; error?: string } {
	const rows = getDirectWordChildren(table, 'tr');
	const { startRow, startCol, endRow, endCol } = options;

	// Validate bounds
	if (startRow < 0 || endRow >= rows.length) {
		return { success: false, error: 'Row index out of range' };
	}

	const startRowEl = rows[startRow];
	const startCells = getDirectWordChildren(startRowEl, 'tc');
	if (startCol < 0 || endCol >= startCells.length) {
		return { success: false, error: 'Column index out of range' };
	}

	const numRows = endRow - startRow + 1;
	const numCols = endCol - startCol + 1;

	// Find all cells in merge range
	const cellsToMerge: XmlElement[] = [];
	for (let r = startRow; r <= endRow; r++) {
		const row = rows[r];
		const cells = getDirectWordChildren(row, 'tc');
		const startC = r === startRow ? startCol : 0;
		const endC = r === endRow ? endCol : cells.length - 1;
		for (let c = startC; c <= endC; c++) {
			cellsToMerge.push(cells[c]);
		}
	}

	if (cellsToMerge.length === 0) {
		return { success: false, error: 'No cells to merge' };
	}

	// First cell gets gridSpan and vMerge="continue" for subsequent rows
	const firstCell = cellsToMerge[0];

	// Set gridSpan on first cell
	let tcPr = getDirectChild(firstCell, 'tcPr');
	if (!tcPr) {
		tcPr = createWordElement(firstCell.ownerDocument, 'tcPr');
		firstCell.insertBefore(tcPr, firstCell.firstChild);
	}

	const gridSpan = createWordElement(firstCell.ownerDocument, 'gridSpan');
	gridSpan.setAttribute('w:val', String(numCols));
	tcPr.appendChild(gridSpan);

	// Add vMerge to cells in rows below first
	for (let i = 1; i < cellsToMerge.length; i++) {
		const cell = cellsToMerge[i];
		let cellTcPr = getDirectChild(cell, 'tcPr');
		if (!cellTcPr) {
			cellTcPr = createWordElement(cell.ownerDocument, 'tcPr');
			cell.insertBefore(cellTcPr, cell.firstChild);
		}

		const vMerge = createWordElement(cell.ownerDocument, 'vMerge');
		vMerge.setAttribute('w:val', 'continue');
		cellTcPr.appendChild(vMerge);
	}

	return { success: true };
}

export function unmergeCells(
	table: XmlElement,
	rowIndex: number,
	colIndex: number,
): { success: boolean; error?: string } {
	const rows = getDirectWordChildren(table, 'tr');
	if (rowIndex < 0 || rowIndex >= rows.length) {
		return { success: false, error: 'Row index out of range' };
	}

	const row = rows[rowIndex];
	const cells = getDirectWordChildren(row, 'tc');
	if (colIndex < 0 || colIndex >= cells.length) {
		return { success: false, error: 'Column index out of range' };
	}

	const cell = cells[colIndex];
	const tcPr = getDirectChild(cell, 'tcPr');

	if (!tcPr) {
		return { success: false, error: 'Cell is not merged' };
	}

	// Check if this is a merged cell (has gridSpan > 1 or vMerge)
	const gridSpan = getDirectChild(tcPr, 'gridSpan');
	const vMerge = getDirectChild(tcPr, 'vMerge');

	if (!gridSpan && !vMerge) {
		return { success: false, error: 'Cell is not merged' };
	}

	// Remove gridSpan and vMerge
	if (gridSpan) {
		tcPr.removeChild(gridSpan);
	}
	if (vMerge) {
		tcPr.removeChild(vMerge);
	}

	// If tcPr is empty, remove it
	if (tcPr.children.length === 0) {
		cell.removeChild(tcPr);
	}

	return { success: true };
}