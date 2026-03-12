import AdmZip from 'adm-zip';

export type XmlDocument = any;
export type XmlElement = any;
export type XmlNode = any;

export interface ParagraphEntry {
	text: string;
	style?: string;
	element: XmlElement;
}

export interface LoadedDocxXml {
	zip: AdmZip;
	xml: string;
	xmlDocument: XmlDocument;
}

export interface TableEntry {
	element: XmlElement;
}

export interface TextFormatOptions {
	fontName?: string;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	color?: string;
}

export interface ParagraphFormatOptions {
	alignment?: 'left' | 'center' | 'right' | 'justify';
	lineSpacing?: number;
	firstLineIndent?: number;
	spaceBefore?: number;
	spaceAfter?: number;
}

export interface TableFormatOptions extends TextFormatOptions {
	bgColor?: string;
	align?: 'left' | 'center' | 'right';
}

export interface TableBorderOptions {
	topBorder?: number;
	bottomBorder?: number;
	leftBorder?: number;
	rightBorder?: number;
	insideHBorder?: number;
	insideVBorder?: number;
	borderStyle?: 'single' | 'double' | 'none';
	borderColor?: string;
}

export interface ImageEntry {
	name: string;
	id: string;
	type: string;
	width?: number;
	height?: number;
	description?: string;
	element: XmlElement;
}

export interface TocEntry {
	index: number;
	element: XmlElement;
	title?: string;
	levelRange?: string;
}