import {
	buildRunElement,
	cloneRunWithText,
	createWordElement,
	ensurePropertiesChild,
	findClosestAncestor,
	getDirectChild,
	getElementChildren,
	getWordElements,
	setPropertyElement,
} from './dom.js';
import { ParagraphFormatOptions, TableBorderOptions, TableFormatOptions, TextFormatOptions, XmlElement, XmlNode } from './types.js';

export function applyTextFormattingToParagraph(
	paragraph: XmlElement,
	format: TextFormatOptions,
	targetText?: string,
): { changed: boolean } {
	if (!hasTextFormatChanges(format)) {
		return { changed: false };
	}

	if (targetText && targetText.length > 0) {
		const text = getParagraphText(paragraph);
		if (!text.includes(targetText)) {
			return { changed: false };
		}

		if (tryApplyTargetTextFormattingInPlace(paragraph, targetText, format)) {
			return { changed: true };
		}

		rebuildParagraphRuns(paragraph, text, targetText, format);
		return { changed: true };
	}

	let changed = false;
	const runs = getWordElements(paragraph, 'r').filter((run: XmlElement) => getWordElements(run, 't').length > 0);

	for (const run of runs) {
		applyRunProperties(run, format);
		changed = true;
	}

	const text = getParagraphText(paragraph);
	if (!text) {
		return { changed };
	}

	if (!changed) {
		rebuildParagraphRuns(paragraph, text, text, format);
		changed = true;
	}

	return { changed };
}

export function applyParagraphFormattingToParagraph(
	paragraph: XmlElement,
	format: ParagraphFormatOptions,
): { changed: boolean } {
	const properties = ensurePropertiesChild(paragraph, 'pPr');
	let changed = false;

	if (format.alignment) {
		setPropertyElement(properties, 'jc', { 'w:val': format.alignment });
		changed = true;
	}

	const spacingAttributes: Record<string, string> = {};
	if (typeof format.lineSpacing === 'number' && Number.isFinite(format.lineSpacing) && format.lineSpacing > 0) {
		spacingAttributes['w:line'] = String(Math.round(format.lineSpacing * 240));
		spacingAttributes['w:lineRule'] = 'auto';
	}
	if (typeof format.spaceBefore === 'number' && Number.isFinite(format.spaceBefore) && format.spaceBefore >= 0) {
		spacingAttributes['w:before'] = String(Math.round(format.spaceBefore * 20));
	}
	if (typeof format.spaceAfter === 'number' && Number.isFinite(format.spaceAfter) && format.spaceAfter >= 0) {
		spacingAttributes['w:after'] = String(Math.round(format.spaceAfter * 20));
	}
	if (Object.keys(spacingAttributes).length > 0) {
		setPropertyElement(properties, 'spacing', spacingAttributes);
		changed = true;
	}

	if (typeof format.firstLineIndent === 'number' && Number.isFinite(format.firstLineIndent)) {
		setPropertyElement(properties, 'ind', { 'w:firstLine': String(Math.round(format.firstLineIndent * 420)) });
		changed = true;
	}

	return { changed };
}

export function applyFormattingToTable(
	table: XmlElement,
	format: TableFormatOptions,
): { paragraphsChanged: number; cellsChanged: number } {
	let paragraphsChanged = 0;
	let cellsChanged = 0;

	if (format.bgColor) {
		for (const cell of getWordElements(table, 'tc')) {
			setCellBackground(cell, format.bgColor);
			cellsChanged += 1;
		}
	}

	for (const paragraph of getWordElements(table, 'p')) {
		let changed = false;
		if (format.align) {
			const paragraphResult = applyParagraphFormattingToParagraph(paragraph, { alignment: format.align });
			changed = changed || paragraphResult.changed;
		}

		const textResult = applyTextFormattingToParagraph(paragraph, format);
		changed = changed || textResult.changed;

		if (changed) {
			paragraphsChanged += 1;
		}
	}

	return { paragraphsChanged, cellsChanged };
}

function hasTextFormatChanges(format: TextFormatOptions): boolean {
	return Boolean(
		format.fontName ||
		format.color ||
		typeof format.fontSize === 'number' ||
		format.bold !== undefined ||
		format.italic !== undefined ||
		format.underline !== undefined,
	);
}

function getParagraphText(paragraph: XmlElement): string {
	return getWordElements(paragraph, 't').map((node: XmlElement) => node.textContent ?? '').join('');
}

function tryApplyTargetTextFormattingInPlace(paragraph: XmlElement, targetText: string, format: TextFormatOptions): boolean {
	for (const textElement of getWordElements(paragraph, 't')) {
		const textValue = textElement.textContent ?? '';
		const matchIndex = textValue.indexOf(targetText);
		if (matchIndex < 0) {
			continue;
		}

		const run = findClosestAncestor(textElement as XmlNode, 'r');
		if (!run || run.parentNode == null) {
			continue;
		}

		const parent = run.parentNode;
		const beforeText = textValue.slice(0, matchIndex);
		const matchedText = textValue.slice(matchIndex, matchIndex + targetText.length);
		const afterText = textValue.slice(matchIndex + targetText.length);

		const beforeRun = beforeText ? cloneRunWithText(run, beforeText) : null;
		const matchedRun = cloneRunWithText(run, matchedText);
		applyRunProperties(matchedRun, format);
		const afterRun = afterText ? cloneRunWithText(run, afterText) : null;

		if (beforeRun) {
			parent.insertBefore(beforeRun, run);
		}
		parent.insertBefore(matchedRun, run);
		if (afterRun) {
			parent.insertBefore(afterRun, run);
		}
		parent.removeChild(run);
		return true;
	}

	return false;
}

function rebuildParagraphRuns(paragraph: XmlElement, text: string, targetText: string, format: TextFormatOptions): void {
	const properties = getDirectChild(paragraph, 'pPr');
	const childrenToRemove = getElementChildren(paragraph).filter(child => child !== properties);
	for (const child of childrenToRemove) {
		paragraph.removeChild(child);
	}

	const segments = text.split(targetText);
	for (let index = 0; index < segments.length; index++) {
		if (segments[index]) {
			paragraph.appendChild(buildRunElement(paragraph.ownerDocument, segments[index]));
		}
		if (index < segments.length - 1) {
			const run = buildRunElement(paragraph.ownerDocument, targetText);
			applyRunProperties(run, format);
			paragraph.appendChild(run);
		}
	}
}

function applyRunProperties(run: XmlElement, format: TextFormatOptions): void {
	const properties = ensurePropertiesChild(run, 'rPr');

	if (format.fontName) {
		setPropertyElement(properties, 'rFonts', {
			'w:ascii': format.fontName,
			'w:hAnsi': format.fontName,
			'w:eastAsia': format.fontName,
			'w:cs': format.fontName,
		});
	}

	if (typeof format.fontSize === 'number' && Number.isFinite(format.fontSize) && format.fontSize > 0) {
		const halfPoints = String(Math.round(format.fontSize * 2));
		setPropertyElement(properties, 'sz', { 'w:val': halfPoints });
		setPropertyElement(properties, 'szCs', { 'w:val': halfPoints });
	}

	if (format.bold !== undefined) {
		setPropertyElement(properties, 'b', format.bold ? {} : { 'w:val': '0' });
	}

	if (format.italic !== undefined) {
		setPropertyElement(properties, 'i', format.italic ? {} : { 'w:val': '0' });
	}

	if (format.underline !== undefined) {
		setPropertyElement(properties, 'u', { 'w:val': format.underline ? 'single' : 'none' });
	}

	const color = normalizeHexColor(format.color);
	if (color) {
		setPropertyElement(properties, 'color', { 'w:val': color });
	}
}

function setCellBackground(cell: XmlElement, bgColor: string): void {
	const color = normalizeHexColor(bgColor);
	if (!color) {
		return;
	}

	const properties = ensurePropertiesChild(cell, 'tcPr');
	setPropertyElement(properties, 'shd', { 'w:fill': color });
}

function normalizeHexColor(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const normalized = value.replace(/^#/, '').trim().toUpperCase();
	return /^[0-9A-F]{6}$/.test(normalized) ? normalized : undefined;
}

export function applyTableBorders(
	table: XmlElement,
	options: TableBorderOptions,
): { changed: boolean } {
	// Get or create tblPr element
	const tblPr = getOrCreateTableProperties(table);
	let tblBorders = getDirectChild(tblPr, 'tblBorders');

	if (!tblBorders) {
		tblBorders = createWordElement(table.ownerDocument, 'tblBorders');
		tblPr.appendChild(tblBorders);
	}

	const borders = [
		{ key: 'topBorder', name: 'top' },
		{ key: 'bottomBorder', name: 'bottom' },
		{ key: 'leftBorder', name: 'left' },
		{ key: 'rightBorder', name: 'right' },
		{ key: 'insideHBorder', name: 'insideH' },
		{ key: 'insideVBorder', name: 'insideV' },
	];

	let changed = false;
	for (const { key, name } of borders) {
		const value = options[key as keyof TableBorderOptions];
		if (typeof value === 'number') {
			setBorderElement(tblBorders, name, value, options.borderStyle, options.borderColor);
			changed = true;
		}
	}

	return { changed };
}

function getOrCreateTableProperties(table: XmlElement): XmlElement {
	let tblPr = getDirectChild(table, 'tblPr');
	if (!tblPr) {
		tblPr = createWordElement(table.ownerDocument, 'tblPr');
		table.insertBefore(tblPr, table.firstChild);
	}
	return tblPr;
}

function setBorderElement(
	borders: XmlElement,
	name: string,
	size: number,
	style: string = 'single',
	color?: string,
): void {
	const border = createWordElement(borders.ownerDocument, name);
	border.setAttribute('w:val', style === 'none' ? 'nil' : style);
	if (style !== 'none') {
		border.setAttribute('w:sz', String(Math.round(size / 20))); // twips to half-points
		border.setAttribute('w:space', '0');
		if (color) {
			border.setAttribute('w:color', color.replace('#', ''));
		} else {
			border.setAttribute('w:color', '000000');
		}
	}

	const existing = getDirectChild(borders, name);
	if (existing) {
		borders.replaceChild(border, existing);
	} else {
		borders.appendChild(border);
	}
}