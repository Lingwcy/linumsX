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
} from './types.js';

export {
	ensureEditableDocPath,
	loadDocxXml,
	saveDocxXml,
	createEmptyDocument,
	listDocxFiles,
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
} from './structure.js';

export {
	applyTextFormattingToParagraph,
	applyParagraphFormattingToParagraph,
	applyFormattingToTable,
	applyTableBorders,
} from './formatting.js';