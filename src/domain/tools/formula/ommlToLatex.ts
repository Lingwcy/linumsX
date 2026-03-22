// OMML to LaTeX converter
// Handles Office Math Markup Language (OMML) to LaTeX conversion

type XmlElement = any;

// OMML namespace
const MATH_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

/**
 * Convert OMML XML element to LaTeX string
 */
export function ommlToLatex(ommlElement: XmlElement): string {
	if (!ommlElement) return '';

	// Get all child elements in the oMath
	const children = ommlElement.childNodes || [];
	let result = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (!child.nodeType) continue; // Skip text nodes for now

		const localName = child.localName || child.nodeName;

		switch (localName) {
			case 'r':
				// Run - plain text
				result += getTextContent(child);
				break;
			case 't':
				// Text element
				result += child.textContent || child.text || '';
				break;
			case 'f':
				// Fraction
				result += convertFraction(child);
				break;
			case 's':
				// Superscript or subscript
				result += convertSupSub(child);
				break;
			case 'sup':
				// Superscript
				result += '^' + wrapInBraces(getInnerMath(child));
				break;
			case 'sub':
				// Subscript
				result += '_' + wrapInBraces(getInnerMath(child));
				break;
			case 'rad':
				// Radical
				result += convertRadical(child);
				break;
			case 'sin':
			case 'cos':
			case 'tan':
			case 'cot':
			case 'sec':
			case 'csc':
			case 'arcsin':
			case 'arccos':
			case 'arctan':
			case 'log':
			case 'ln':
			case 'exp':
				// Functions
				result += '\\' + localName + ' ';
				break;
			case 'lim':
				// Limit
				result += convertLimit(child);
				break;
			case 'int':
				// Integral
				result += convertIntegral(child);
				break;
			case 'sum':
				// Summation
				result += convertSum(child);
				break;
			case 'prod':
				// Product
				result += convertProduct(child);
				break;
			case 'bar':
				// Overline
				result += '\\overline{' + getInnerMath(child) + '}';
				break;
			case 'bar':
				// Underline
				result += '\\underline{' + getInnerMath(child) + '}';
				break;
			case 'vec':
				// Vector
				result += '\\vec{' + getInnerMath(child) + '}';
				break;
			case 'acc':
				// Accent
				result += convertAccent(child);
				break;
			case 'box':
				// Box
				result += '\\boxed{' + getInnerMath(child) + '}';
				break;
			case 'eqArr':
				// Equation array
				result += convertEquationArray(child);
				break;
			case 'func':
				// Function application
				result += convertFunction(child);
				break;
			case 'groupChar':
				// Grouping character (brackets)
				result += convertGroupChar(child);
				break;
			case 'd':
				// Differential (for integrals)
				result += convertDifferential(child);
				break;
			default:
				// Try to get inner content
				const inner = getInnerMath(child);
				if (inner) {
					result += inner;
				}
		}
	}

	return result;
}

/**
 * Get text content from a run element
 */
function getTextContent(element: XmlElement): string {
	if (!element) return '';
	const children = element.childNodes || [];
	let text = '';
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeName === 't' || child.localName === 't') {
			text += child.textContent || child.text || '';
		} else if (child.nodeType === 3) {
			text += child.textContent || '';
		}
	}
	return text;
}

/**
 * Get inner math content
 */
function getInnerMath(element: XmlElement): string {
	if (!element) return '';
	const children = element.childNodes || [];
	let result = '';
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.nodeType === 1) { // Element node
			if (child.localName === 'oMath' || child.nodeName === 'oMath') {
				result += ommlToLatex(child);
			} else {
				result += ommlToLatex(child);
			}
		}
	}
	return result;
}

/**
 * Convert fraction element
 */
function convertFraction(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let num = '';
	let den = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'num') {
			num = getInnerMath(child);
		} else if (localName === 'den') {
			den = getInnerMath(child);
		}
	}

	if (!num || !den) return '';

	return `\\frac{${num}}{${den}}`;
}

/**
 * Convert superscript/subscript element
 */
function convertSupSub(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let sup = '';
	let sub = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'sup') {
			sup = getInnerMath(child);
		} else if (localName === 'sub') {
			sub = getInnerMath(child);
		}
	}

	if (sup && sub) {
		return `_{${sub}}^{${sup}}`;
	} else if (sup) {
		return '^{' + sup + '}';
	} else if (sub) {
		return '_{' + sub + '}';
	}

	return '';
}

/**
 * Convert radical element
 */
function convertRadical(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let degree = '';
	let radicand = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'deg') {
			degree = getInnerMath(child);
		} else if (localName === 'e' || localName === 'radicand') {
			radicand = getInnerMath(child);
		}
	}

	if (!radicand) return '';

	if (degree) {
		return `\\sqrt[${degree}]{${radicand}}`;
	}

	return `\\sqrt{${radicand}}`;
}

/**
 * Convert limit element
 */
function convertLimit(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || '';
	let limLoc = '';
	let e = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'limLoc') {
			limLoc = getInnerMath(child);
		} else if (localName === 'e') {
			e = getInnerMath(child);
		}
	}

	if (limLoc && e) {
		return `\\lim_{${limLoc}} ${e}`;
	} else if (e) {
		return `\\lim ${e}`;
	}

	return '\\lim';
}

/**
 * Convert integral element
 */
function convertIntegral(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let sub = '';
	let sup = '';
	let e = '';
	let dir = 'int';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'sub') {
			sub = getInnerMath(child);
		} else if (localName === 'sup') {
			sup = getInnerMath(child);
		} else if (localName === 'e') {
			e = getInnerMath(child);
		} else if (localName === 'ctrlPr') {
			// Control properties - check for limits
		}
	}

	// Build integral with limits
	let result = dir;
	if (sub || sup) {
		result += '_';
		if (sub) result += wrapInBraces(sub);
		result += '^';
		result += wrapInBraces(sup || '');
	}

	if (e) {
		result += ' ' + e;
	}

	return result;
}

/**
 * Convert summation element
 */
function convertSum(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let sub = '';
	let sup = '';
	let e = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'sub') {
			sub = getInnerMath(child);
		} else if (localName === 'sup') {
			sup = getInnerMath(child);
		} else if (localName === 'e') {
			e = getInnerMath(child);
		}
	}

	let result = '\\sum';
	if (sub || sup) {
		result += '_';
		result += wrapInBraces(sub || '');
		result += '^';
		result += wrapInBraces(sup || '');
	}

	if (e) {
		result += ' ' + e;
	}

	return result;
}

/**
 * Convert product element
 */
function convertProduct(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let sub = '';
	let sup = '';
	let e = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'sub') {
			sub = getInnerMath(child);
		} else if (localName === 'sup') {
			sup = getInnerMath(child);
		} else if (localName === 'e') {
			e = getInnerMath(child);
		}
	}

	let result = '\\prod';
	if (sub || sup) {
		result += '_';
		result += wrapInBraces(sub || '');
		result += '^';
		result += wrapInBraces(sup || '');
	}

	if (e) {
		result += ' ' + e;
	}

	return result;
}

/**
 * Convert accent element
 */
function convertAccent(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let accent = '';
	let e = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'chr') {
			accent = child.textContent || child.text || '';
		} else if (localName === 'e') {
			e = getInnerMath(child);
		}
	}

	// Map OMML accents to LaTeX
	const accentMap: Record<string, string> = {
		'̂': '\\hat',
		'̃': '\\tilde',
		'̄': '\\bar',
		'̆': '\\breve',
		'̇': '\\dot',
		'̈': '\\ddot',
		'⃗': '\\vec',
	};

	if (accentMap[accent]) {
		return `${accentMap[accent]}{${e || ''}}`;
	}

	return e;
}

/**
 * Convert function element
 */
function convertFunction(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let fname = '';
	let arg = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'fName') {
			fname = getInnerMath(child);
		} else if (localName === 'e' || localName === 'arg') {
			arg = getInnerMath(child);
		}
	}

	if (arg) {
		return `\\${fname}\\left(${arg}\\right)`;
	}

	return `\\${fname}`;
}

/**
 * Convert group character (brackets)
 */
function convertGroupChar(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let char = '';
	let e = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'chr') {
			char = child.textContent || child.text || '';
		} else if (localName === 'e') {
			e = getInnerMath(child);
		}
	}

	if (char && e) {
		return `\\left${char} ${e} \\right${char}`;
	}

	return e;
}

/**
 * Convert differential element
 */
function convertDifferential(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let e = '';

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'e') {
			e = getInnerMath(child);
		}
	}

	return 'd' + (e || '');
}

/**
 * Convert equation array
 */
function convertEquationArray(element: XmlElement): string {
	if (!element) return '';

	const children = element.childNodes || [];
	let rows: string[] = [];

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const localName = child.localName || child.nodeName;

		if (localName === 'e') {
			rows.push(getInnerMath(child));
		}
	}

	if (rows.length === 0) return '';
	if (rows.length === 1) return rows[0];

	return rows.join(' \\\\ ');
}

/**
 * Wrap content in braces if not empty
 */
function wrapInBraces(content: string): string {
	if (!content) return '{}';
	if (content.startsWith('{') && content.endsWith('}')) {
		return content;
	}
	return '{' + content + '}';
}

/**
 * Parse all oMath elements from document XML
 */
export function parseOmmlElements(xmlDocument: XmlElement): XmlElement[] {
	const omathElements: XmlElement[] = [];

	// Find all oMath elements using getElementsByTagNameNS
	try {
		const elements = xmlDocument.getElementsByTagNameNS(MATH_NS, 'oMath');
		for (let i = 0; i < elements.length; i++) {
			omathElements.push(elements[i]);
		}
	} catch {
		// Fallback: try without namespace
	}

	// Also try without namespace
	if (omathElements.length === 0) {
		try {
			const elements = xmlDocument.getElementsByTagName('oMath');
			for (let i = 0; i < elements.length; i++) {
				omathElements.push(elements[i]);
			}
		} catch {
			// Ignore
		}
	}

	return omathElements;
}
