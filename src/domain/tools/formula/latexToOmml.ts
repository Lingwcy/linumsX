// LaTeX to OMML converter
// Handles LaTeX to Office Math Markup Language (OMML) conversion

/**
 * Convert LaTeX string to OMML XML string
 */
export function latexToOmml(latex: string): string {
	if (!latex) return '';

	const result = parseLatex(latex);
	return buildOmmlElement(result);
}

/**
 * Parse LaTeX into a structured format
 */
interface MathNode {
	type: string;
	content?: string;
	numerator?: MathNode;
	denominator?: MathNode;
	superscript?: MathNode;
	subscript?: MathNode;
	radicand?: MathNode;
	degree?: MathNode;
	elements?: MathNode[];
	operator?: string;
	limit?: MathNode;
	from?: MathNode;
	to?: MathNode;
	argument?: MathNode;
}

function parseLatex(latex: string): MathNode {
	// Remove leading/trailing whitespace
	latex = latex.trim();

	// Handle fractions: \frac{num}{den}
	const fracMatch = latex.match(/\\frac\{([^}]*)\}\{([^}]*)\}/);
	if (fracMatch) {
		return {
			type: 'fraction',
			numerator: parseLatex(fracMatch[1]),
			denominator: parseLatex(fracMatch[2]),
		};
	}

	// Handle square root: \sqrt{content}
	const sqrtMatch = latex.match(/\\sqrt(\[[^\]]*\])?\{([^}]*)\}/);
	if (sqrtMatch) {
		const degree = sqrtMatch[1] ? sqrtMatch[1].slice(1, -1) : '';
		const radicand = sqrtMatch[2];
		return {
			type: 'radical',
			degree: degree ? { type: 'text', content: degree } : undefined,
			radicand: parseLatex(radicand),
		};
	}

	// Handle superscript: ^{content}
	const supMatch = latex.match(/\^(\{[^\}]*\}|[^{])/);
	if (supMatch) {
		const content = supMatch[1].replace(/^\{|\}$/g, '');
		return {
			type: 'superscript',
			superscript: parseLatex(content),
		};
	}

	// Handle subscript: _{content}
	const subMatch = latex.match(/_(\{[^\}]*\}|[^{])/);
	if (subMatch) {
		const content = subMatch[1].replace(/^\{|\}$/g, '');
		return {
			type: 'subscript',
			subscript: parseLatex(content),
		};
	}

	// Handle combined sup/sub: _{sub}^{sup}
	const supSubMatch = latex.match(/_(\{[^\}]*\})?\^(\{[^\}]*\})/);
	if (supSubMatch) {
		const sub = supSubMatch[1] ? supSubMatch[1].replace(/^\{|\}$/g, '') : '';
		const sup = supSubMatch[2].replace(/^\{|\}$/g, '');
		return {
			type: 'supersubscript',
			subscript: sub ? parseLatex(sub) : undefined,
			superscript: parseLatex(sup),
		};
	}

	// Handle integrals: \int_{a}^{b}
	const intMatch = latex.match(/\\int(_(\{[^\}]*\}))?(\^(\{[^\}]*\}))?/);
	if (intMatch) {
		const from = intMatch[2] ? intMatch[2].replace(/^\{|\}$/g, '') : '';
		const to = intMatch[4] ? intMatch[4].replace(/^\{|\}$/g, '') : '';
		return {
			type: 'integral',
			from: from ? { type: 'text', content: from } : undefined,
			to: to ? { type: 'text', content: to } : undefined,
		};
	}

	// Handle summation: \sum_{i=1}^{n}
	const sumMatch = latex.match(/\\sum(_(\{[^\}]*\}))?(\^(\{[^\}]*\}))?/);
	if (sumMatch) {
		const from = sumMatch[2] ? sumMatch[2].replace(/^\{|\}$/g, '') : '';
		const to = sumMatch[4] ? sumMatch[4].replace(/^\{|\}$/g, '') : '';
		return {
			type: 'summation',
			from: from ? { type: 'text', content: from } : undefined,
			to: to ? { type: 'text', content: to } : undefined,
		};
	}

	// Handle product: \prod_{i=1}^{n}
	const prodMatch = latex.match(/\\prod(_(\{[^\}]*\}))?(\^(\{[^\}]*\}))?/);
	if (prodMatch) {
		const from = prodMatch[2] ? prodMatch[2].replace(/^\{|\}$/g, '') : '';
		const to = prodMatch[4] ? prodMatch[4].replace(/^\{|\}$/g, '') : '';
		return {
			type: 'product',
			from: from ? { type: 'text', content: from } : undefined,
			to: to ? { type: 'text', content: to } : undefined,
		};
	}

	// Handle limit: \lim_{x \to \infty}
	const limMatch = latex.match(/\\lim_\{([^}]*)\}/);
	if (limMatch) {
		return {
			type: 'limit',
			limit: { type: 'text', content: limMatch[1] },
		};
	}

	// Handle functions: \sin, \cos, \tan, \log, \ln, \exp
	const funcMatch = latex.match(/\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|log|ln|exp)\b/);
	if (funcMatch) {
		// Check if there's an argument
		const argMatch = latex.match(/\\(?:sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|log|ln|exp)(\{[^}]*\})/);
		if (argMatch) {
			return {
				type: 'function',
				operator: funcMatch[1],
				argument: parseLatex(argMatch[1].slice(1, -1)),
			};
		}
		return {
			type: 'function',
			operator: funcMatch[1],
		};
	}

	// Handle overline: \overline{content}
	const overlineMatch = latex.match(/\\overline\{([^}]*)\}/);
	if (overlineMatch) {
		return {
			type: 'overline',
			content: parseLatex(overlineMatch[1]),
		};
	}

	// Handle underline: \underline{content}
	const underlineMatch = latex.match(/\\underline\{([^}]*)\}/);
	if (underlineMatch) {
		return {
			type: 'underline',
			content: parseLatex(underlineMatch[1]),
		};
	}

	// Handle vec: \vec{content}
	const vecMatch = latex.match(/\\vec\{([^}]*)\}/);
	if (vecMatch) {
		return {
			type: 'vector',
			content: parseLatex(vecMatch[1]),
		};
	}

	// Handle boxed: \boxed{content}
	const boxedMatch = latex.match(/\\boxed\{([^}]*)\}/);
	if (boxedMatch) {
		return {
			type: 'boxed',
			content: parseLatex(boxedMatch[1]),
		};
	}

	// Handle text: \text{content}
	const textMatch = latex.match(/\\text\{([^}]*)\}/);
	if (textMatch) {
		return {
			type: 'text',
			content: textMatch[1],
		};
	}

	// Default: plain text
	return {
		type: 'text',
		content: latex,
	};
}

/**
 * Build OMML XML from parsed math node
 */
function buildOmmlElement(node: MathNode): string {
	if (!node) return '';

	switch (node.type) {
		case 'fraction':
			return buildFraction(node);
		case 'radical':
			return buildRadical(node);
		case 'superscript':
			return buildSuperscript(node);
		case 'subscript':
			return buildSubscript(node);
		case 'supersubscript':
			return buildSuperSubscript(node);
		case 'integral':
			return buildIntegral(node);
		case 'summation':
			return buildSummation(node);
		case 'product':
			return buildProduct(node);
		case 'limit':
			return buildLimit(node);
		case 'function':
			return buildFunction(node);
		case 'overline':
			return buildAccent(node, 'bar');
		case 'underline':
			return buildAccent(node, 'bar');
		case 'vector':
			return buildAccent(node, 'vec');
		case 'boxed':
			return buildBox(node);
		case 'text':
			return buildRun(node.content || '');
		default:
			return buildRun(node.content || '');
	}
}

function buildRun(text: string): string {
	return `<w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>`;
}

function buildFraction(node: MathNode): string {
	const num = node.numerator ? buildOmmlElement(node.numerator) : '';
	const den = node.denominator ? buildOmmlElement(node.denominator) : '';
	return `<m:f><m:num>${num}</m:num><m:den>${den}</m:den></m:f>`;
}

function buildRadical(node: MathNode): string {
	const radicand = node.radicand ? buildOmmlElement(node.radicand) : '';
	const degree = node.degree ? buildOmmlElement(node.degree) : '';
	if (degree) {
		return `<m:rad><m:deg>${degree}</m:deg><m:e>${radicand}</m:e></m:rad>`;
	}
	return `<m:rad><m:e>${radicand}</m:e></m:rad>`;
}

function buildSuperscript(node: MathNode): string {
	const sup = node.superscript ? buildOmmlElement(node.superscript) : '';
	return `<m:s><m:sup>${sup}</m:sup></m:s>`;
}

function buildSubscript(node: MathNode): string {
	const sub = node.subscript ? buildOmmlElement(node.subscript) : '';
	return `<m:s><m:sub>${sub}</m:sub></m:s>`;
}

function buildSuperSubscript(node: MathNode): string {
	const sub = node.subscript ? buildOmmlElement(node.subscript) : '';
	const sup = node.superscript ? buildOmmlElement(node.superscript) : '';
	return `<m:s><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup></m:s>`;
}

function buildIntegral(node: MathNode): string {
	const sub = node.from ? buildOmmlElement(node.from) : '';
	const sup = node.to ? buildOmmlElement(node.to) : '';
	let result = '<m:int>';
	if (sub) result += `<m:sub>${sub}</m:sub>`;
	if (sup) result += `<m:sup>${sup}</m:sup>`;
	result += '</m:int>';
	return result;
}

function buildSummation(node: MathNode): string {
	const sub = node.from ? buildOmmlElement(node.from) : '';
	const sup = node.to ? buildOmmlElement(node.to) : '';
	let result = '<m:sum>';
	if (sub) result += `<m:sub>${sub}</m:sub>`;
	if (sup) result += `<m:sup>${sup}</m:sup>`;
	result += '</m:sum>';
	return result;
}

function buildProduct(node: MathNode): string {
	const sub = node.from ? buildOmmlElement(node.from) : '';
	const sup = node.to ? buildOmmlElement(node.to) : '';
	let result = '<m:prod>';
	if (sub) result += `<m:sub>${sub}</m:sub>`;
	if (sup) result += `<m:sup>${sup}</m:sup>`;
	result += '</m:prod>';
	return result;
}

function buildLimit(node: MathNode): string {
	const limLoc = node.limit ? buildOmmlElement(node.limit) : '';
	return `<m:lim><m:limLoc>${limLoc}</m:limLoc></m:lim>`;
}

function buildFunction(node: MathNode): string {
	const fname = node.operator || '';
	const arg = node.argument ? buildOmmlElement(node.argument) : '';
	if (arg) {
		return `<m:func><m:fName><m:r><w:t>${escapeXml(fname)}</w:t></m:r></m:fName><m:e>${arg}</m:e></m:func>`;
	}
	return `<m:func><m:fName><m:r><w:t>${escapeXml(fname)}</w:t></m:r></m:fName></m:func>`;
}

function buildAccent(node: MathNode, accentType: string): string {
	const e = node.content ? buildOmmlElement(node.content) : '';
	return `<m:${accentType}><m:e>${e}</m:e></m:${accentType}>`;
}

function buildBox(node: MathNode): string {
	const e = node.content ? buildOmmlElement(node.content) : '';
	return `<m:box><m:e>${e}</m:e></m:box>`;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Create a complete oMath wrapper with proper namespace
 */
export function createOmmlWrapper(latex: string): string {
	const ommlContent = latexToOmml(latex);
	return `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${ommlContent}</m:oMath>`;
}
