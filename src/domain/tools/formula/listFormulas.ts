import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml } from '../shared/docxXml.js';
import { parseOmmlElements, ommlToLatex } from './ommlToLatex.js';

export interface FormulaEntry {
	index: number;
	type: 'omml' | 'mathtype' | 'image' | 'unicode';
	latex: string;
	paragraphIndex: number;
	element?: any;
	olePath?: string;
	imageName?: string;
	imageId?: string;
}

export function getListFormulasTool(): Tool {
	return {
		name: 'list_formulas',
		description: '列出文档中所有公式的信息（包括 OMML 公式、MathType、公式图片、Unicode 数学符号）',
		schema: {
			type: 'object',
			properties: {
				docPath: {
					type: 'string',
					description: '文档路径',
				},
				showDetails: {
					type: 'boolean',
					description: '显示详细信息（包括位置等）',
				},
			},
			required: ['docPath'],
		},
		execute: async (params) => {
			const { docPath, showDetails = false } = params as { docPath: string; showDetails?: boolean };

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);
				const formulas: FormulaEntry[] = [];

				// Get all paragraphs to find formula positions
				const paragraphs = loaded.xmlDocument.getElementsByTagName('w:p');
				const paragraphMap = new Map<any, number>();
				for (let i = 0; i < paragraphs.length; i++) {
					paragraphMap.set(paragraphs[i], i);
				}

				// Parse OMML formulas
				const ommlElements = parseOmmlElements(loaded.xmlDocument);
				for (let i = 0; i < ommlElements.length; i++) {
					const omml = ommlElements[i];
					const latex = ommlToLatex(omml);

					let parent = omml.parentNode;
					let paragraphIndex = -1;
					while (parent) {
						if (paragraphMap.has(parent)) {
							paragraphIndex = paragraphMap.get(parent) || -1;
							break;
						}
						parent = parent.parentNode;
					}

					formulas.push({
						index: formulas.length,
						type: 'omml',
						latex,
						paragraphIndex,
						element: omml,
					});
				}

				// Check for MathType OLE objects
				const oleFormulas = parseOleFormulas(loaded);
				for (const ole of oleFormulas) {
					formulas.push({
						index: formulas.length,
						...ole,
					});
				}

				// Parse image-based formulas (many images in document may be formulas)
				const imageFormulas = parseImageFormulas(loaded);
				for (const img of imageFormulas) {
					formulas.push({
						index: formulas.length,
						...img,
					});
				}

				// Parse Unicode math symbols
				const unicodeFormulas = parseUnicodeMath(loaded);
				for (const uni of unicodeFormulas) {
					formulas.push({
						index: formulas.length,
						...uni,
					});
				}

				if (formulas.length === 0) {
					return {
						success: true,
						data: '文档中没有发现公式',
					};
				}

				// Count by type
				const typeCount = {
					omml: formulas.filter(f => f.type === 'omml').length,
					mathtype: formulas.filter(f => f.type === 'mathtype').length,
					image: formulas.filter(f => f.type === 'image').length,
					unicode: formulas.filter(f => f.type === 'unicode').length,
				};

				// Format output
				let result = `文档中共有 ${formulas.length} 个公式/数学内容:\n`;
				result += `- Office Math (OMML): ${typeCount.omml}\n`;
				result += `- MathType (OLE): ${typeCount.mathtype}\n`;
				result += `- 公式图片: ${typeCount.image}\n`;
				result += `- Unicode 数学符号: ${typeCount.unicode}\n\n`;

				if (showDetails) {
					const formulaList = formulas.map((f, idx) => {
						let info = `公式 ${idx + 1}:\n`;
						info += `  类型: ${getTypeName(f.type)}\n`;
						info += `  内容: ${f.latex}\n`;
						if (f.paragraphIndex >= 0) {
							info += `  位置: 段落 ${f.paragraphIndex + 1}`;
						}
						if (f.imageName) {
							info += `\n  图片: ${f.imageName}`;
						}
						if (f.olePath) {
							info += `\n  嵌入文件: ${f.olePath}`;
						}
						return info;
					}).join('\n\n');
					result += formulaList;
				} else {
					// Show summary grouped by type
					if (typeCount.unicode > 0) {
						result += '\nUnicode 数学符号示例（前10个）:\n';
						const unicodeItems = formulas.filter(f => f.type === 'unicode').slice(0, 10);
						for (const f of unicodeItems) {
							result += `  段落 ${f.paragraphIndex + 1}: ${f.latex}\n`;
						}
					}
					if (typeCount.image > 0) {
						result += `\n公式图片: 共 ${typeCount.image} 张（可能是公式截图或图片公式）`;
					}
				}

				return {
					success: true,
					data: result,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	};
}

function getTypeName(type: string): string {
	switch (type) {
		case 'omml': return 'Office Math (OMML)';
		case 'mathtype': return 'MathType (OLE)';
		case 'image': return '公式图片';
		case 'unicode': return 'Unicode 数学符号';
		default: return type;
	}
}

/**
 * Parse MathType OLE objects from document
 */
export function parseOleFormulas(loaded: ReturnType<typeof loadDocxXml>): Omit<FormulaEntry, 'index'>[] {
	const formulas: Omit<FormulaEntry, 'index'>[] = [];

	const entries = loaded.zip.getEntries();
	const embeddingEntries = entries.filter(e => e.entryName.startsWith('word/embeddings/'));

	for (const entry of embeddingEntries) {
		const name = entry.name.split('/').pop() || '';
		if (name.includes('Equation') || name.endsWith('.ole') || name.endsWith('.mht')) {
			formulas.push({
				type: 'mathtype',
				latex: `[MathType OLE 对象: ${name}]`,
				paragraphIndex: -1,
				olePath: entry.entryName,
			});
		}
	}

	return formulas;
}

/**
 * Parse image-based formulas
 * Many documents store formulas as images
 */
export function parseImageFormulas(loaded: ReturnType<typeof loadDocxXml>): Omit<FormulaEntry, 'index'>[] {
	const formulas: Omit<FormulaEntry, 'index'>[] = [];

	// Get all drawings (images) in the document
	const drawings = loaded.xmlDocument.getElementsByTagName('w:drawing');
	const paragraphs = loaded.xmlDocument.getElementsByTagName('w:p');
	const paragraphMap = new Map<any, number>();
	for (let i = 0; i < paragraphs.length; i++) {
		paragraphMap.set(paragraphs[i], i);
	}

	// Get all images in media folder
	const entries = loaded.zip.getEntries();
	const mediaFiles = entries
		.filter(e => e.entryName.startsWith('word/media/') && !e.entryName.endsWith('/'))
		.map(e => ({
			name: e.name.split('/').pop() || '',
			path: e.entryName,
		}));

	// Map rId to image name
	const idToImage = new Map<string, string>();
	for (const entry of entries) {
		const relsEntry = loaded.zip.getEntry('word/_rels/document.xml.rels');
		if (relsEntry) {
			const relsXml = relsEntry.getData().toString('utf8');
			const idMatches = relsXml.match(/Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/g) || [];
			for (const match of idMatches) {
				const idMatch = match.match(/Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/);
				if (idMatch) {
					idToImage.set(idMatch[1], idMatch[2]);
				}
			}
		}
		break;
	}

	// Process each drawing
	for (let i = 0; i < drawings.length; i++) {
		const drawing = drawings[i];

		// Find the blip (image reference)
		const blips = drawing.getElementsByTagName('a:blip') || drawing.getElementsByTagName('wp:inline');
		let imageName = '未知图片';

		// Try to get image ID
		const embedAttr = drawing.getAttribute('r:embed') || drawing.getAttribute('embed');
		if (embedAttr && idToImage.has(embedAttr)) {
			imageName = idToImage.get(embedAttr) || '未知图片';
		}

		// Find parent paragraph
		let parent = drawing.parentNode;
		let paragraphIndex = -1;
		while (parent) {
			if (paragraphMap.has(parent)) {
				paragraphIndex = paragraphMap.get(parent) || -1;
				break;
			}
			parent = parent.parentNode;
		}

		formulas.push({
			type: 'image',
			latex: `[图片公式: ${imageName}]`,
			paragraphIndex,
			imageName,
		});
	}

	return formulas;
}

/**
 * Parse Unicode math symbols in the document
 * These are plain text math symbols like ∑, ∫, √, etc.
 */
export function parseUnicodeMath(loaded: ReturnType<typeof loadDocxXml>): Omit<FormulaEntry, 'index'>[] {
	const formulas: Omit<FormulaEntry, 'index'>[] = [];

	// Unicode math symbols
	const mathSymbols = [
		'∫', '∬', '∭', '∮', '∯', '∰',  // Integrals
		'∑', '∏', '∐',                    // Summation/Product
		'√', '∛', '∜',                    // Roots
		'∞',                               // Infinity
		'∂', '∇',                          // Derivatives
		'±', '∓', '×', '÷', '·',          // Operators
		'≤', '≥', '≠', '≈', '≡',          // Relations
		'⊂', '⊃', '⊆', '⊇', '∈', '∉',    // Set theory
		'∩', '∪', '∅',                    // Set operations
		'∀', '∃', '∄',                    // Quantifiers
		'∠', '⊥', '∥',                    // Geometry
		'←', '→', '↑', '↓', '↔', '⇔',    // Arrows
		'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω',  // Greek lowercase
		'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω',  // Greek uppercase
		'′', '″', '‴',                    // Primes
		'ℕ', 'ℤ', 'ℚ', 'ℝ', 'ℂ',         // Number sets
	];

	// Get all paragraphs
	const paragraphs = loaded.xmlDocument.getElementsByTagName('w:p');

	for (let i = 0; i < paragraphs.length; i++) {
		const para = paragraphs[i];
		const text = para.textContent || '';

		// Check if paragraph contains math symbols
		for (const symbol of mathSymbols) {
			if (text.includes(symbol)) {
				// Get surrounding context
				const idx = text.indexOf(symbol);
				const start = Math.max(0, idx - 20);
				const end = Math.min(text.length, idx + 20);
				let context = text.substring(start, end).trim();

				// Clean up context
				context = context.replace(/\s+/g, ' ');
				if (start > 0) context = '...' + context;
				if (end < text.length) context = context + '...';

				formulas.push({
					type: 'unicode',
					latex: context,
					paragraphIndex: i,
				});

				// Only add one entry per paragraph
				break;
			}
		}
	}

	return formulas;
}
