import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { AgentError, ErrorCode } from '../../../../shared/errors/AgentError.js';
import { XmlDocument, XmlElement, XmlNode } from './types.js';

export const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const parser = new DOMParser();
const serializer = new XMLSerializer();

export function parseXmlDocument(xml: string): XmlDocument {
	return parser.parseFromString(xml, 'application/xml');
}

export function serializeXmlDocument(xmlDocument: XmlDocument): string {
	return serializer.serializeToString(xmlDocument);
}

export function createWordElement(xmlDocument: XmlDocument, localName: string): XmlElement {
	return xmlDocument.createElementNS(WORD_NS, `w:${localName}`);
}

export function getWordElements(root: XmlDocument | XmlElement, localName: string): XmlElement[] {
	const withPrefix = root.getElementsByTagName(`w:${localName}`);
	if (withPrefix.length > 0) {
		return nodeListToArray(withPrefix);
	}

	if (typeof root.getElementsByTagNameNS === 'function') {
		return nodeListToArray(root.getElementsByTagNameNS(WORD_NS, localName));
	}

	return [];
}

export function getDirectWordChildren(parent: XmlElement, localName: string): XmlElement[] {
	return getElementChildren(parent).filter(child => getLocalName(child) === localName);
}

export function getDirectChild(parent: XmlElement, localName: string): XmlElement | null {
	return getDirectWordChildren(parent, localName)[0] ?? null;
}

export function getElementChildren(parent: XmlElement): XmlElement[] {
	const children: XmlElement[] = [];
	for (let index = 0; index < parent.childNodes.length; index++) {
		const child = parent.childNodes[index];
		if (child.nodeType === 1) {
			children.push(child);
		}
	}
	return children;
}

export function getLocalName(node: XmlNode): string {
	return (node.localName ?? node.nodeName.split(':').pop() ?? '').toString();
}

export function findClosestAncestor(node: XmlNode, localName: string): XmlElement | null {
	let current = node.parentNode;
	while (current) {
		if (current.nodeType === 1 && getLocalName(current) === localName) {
			return current as XmlElement;
		}
		current = current.parentNode;
	}

	return null;
}

export function ensurePropertiesChild(parent: XmlElement, localName: string): XmlElement {
	const existing = getDirectChild(parent, localName);
	if (existing) {
		return existing;
	}

	const created = createWordElement(parent.ownerDocument, localName);
	parent.insertBefore(created, parent.firstChild ?? null);
	return created;
}

export function setPropertyElement(parent: XmlElement, localName: string, attributes: Record<string, string>): XmlElement {
	let property = getDirectChild(parent, localName);
	if (!property) {
		property = createWordElement(parent.ownerDocument, localName);
		parent.appendChild(property);
	}

	for (const attributeName of Object.keys(attributes)) {
		property.setAttribute(attributeName, attributes[attributeName]);
	}

	return property;
}

export function getBody(xmlDocument: XmlDocument): XmlElement {
	const body = getWordElements(xmlDocument, 'body')[0];
	if (!body) {
		throw new AgentError('Invalid docx XML: missing w:body', ErrorCode.TOOL_EXECUTION_FAILED, {});
	}
	return body;
}

export function getParagraphText(paragraph: XmlElement): string {
	return getWordElements(paragraph, 't').map((node: XmlElement) => node.textContent ?? '').join('');
}

export function getParagraphStyle(paragraph: XmlElement): string | undefined {
	const properties = getDirectChild(paragraph, 'pPr');
	const style = properties ? getDirectChild(properties, 'pStyle') : null;
	return style?.getAttribute('w:val') ?? undefined;
}

export function buildRunElement(xmlDocument: XmlDocument, text: string): XmlElement {
	const run = createWordElement(xmlDocument, 'r');
	const textElement = createWordElement(xmlDocument, 't');
	if (/^\s|\s$|\s{2,}/.test(text)) {
		textElement.setAttribute('xml:space', 'preserve');
	}
	textElement.appendChild(xmlDocument.createTextNode(text));
	run.appendChild(textElement);
	return run;
}

export function cloneRunWithText(run: XmlElement, text: string): XmlElement {
	const clone = run.cloneNode(true) as XmlElement;
	const textElements = getWordElements(clone, 't');
	if (textElements.length === 0) {
		const fallbackRun = buildRunElement(clone.ownerDocument, text);
		for (const child of getElementChildren(fallbackRun)) {
			clone.appendChild(child.cloneNode(true));
		}
		return clone;
	}

	textElements[0].textContent = text;
	if (/^\s|\s$|\s{2,}/.test(text)) {
		textElements[0].setAttribute('xml:space', 'preserve');
	} else {
		textElements[0].removeAttribute('xml:space');
	}

	for (let index = textElements.length - 1; index >= 1; index--) {
		const node = textElements[index];
		node.parentNode?.removeChild(node);
	}

	return clone;
}

function nodeListToArray(nodeList: any): XmlElement[] {
	const elements: XmlElement[] = [];
	for (let index = 0; index < nodeList.length; index++) {
		elements.push(nodeList.item(index));
	}
	return elements;
}