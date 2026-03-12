export type {
	LoadedDocxXml,
	ParagraphEntry,
	ParagraphFormatOptions,
	TableBorderOptions,
	TableEntry,
	TableFormatOptions,
	TextFormatOptions,
	XmlDocument,
	XmlElement,
	XmlNode,
	ImageEntry,
} from './types.js';

export {
	ensureEditableDocPath,
	loadDocxXml,
	saveDocxXml,
	createEmptyDocument,
	listDocxFiles,
	getImageMimeType,
	addImageToDocx,
} from './io.js';

export {
	parseParagraphEntries,
	buildParagraphXml,
	appendParagraphs,
	replaceParagraphAt,
	parseTableEntries,
	replaceBlockBetweenAnchors,
	getTableDimensions,
	addTableRow,
	deleteTableRow,
	addTableColumn,
	deleteTableColumn,
	mergeCells,
	unmergeCells,
	MergeCellsOptions,
	parseImageEntries,
} from './structure.js';

export {
	applyTextFormattingToParagraph,
	applyParagraphFormattingToParagraph,
	applyFormattingToTable,
	applyTableBorders,
} from './formatting.js';