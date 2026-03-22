import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { parseOmmlElements, ommlToLatex } from './ommlToLatex.js';

export interface FormulaEntry {
	index: number;
	type: 'omml' | 'mathtype';
	latex: string;
	paragraphIndex: number;
	element?: any;
	olePath?: string;
}

export function getListFormulasTool(): Tool {
	return {
		name: 'list_formulas',
		description: '列出文档中所有公式的信息',
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

				// Parse OMML formulas
				const ommlElements = parseOmmlElements(loaded.xmlDocument);
				const formulas: FormulaEntry[] = [];

				// Get all paragraphs to find formula positions
				const paragraphs = loaded.xmlDocument.getElementsByTagName('w:p');
				const paragraphMap = new Map<any, number>();
				for (let i = 0; i < paragraphs.length; i++) {
					paragraphMap.set(paragraphs[i], i);
				}

				// Process OMML formulas
				for (let i = 0; i < ommlElements.length; i++) {
					const omml = ommlElements[i];
					const latex = ommlToLatex(omml);

					// Find parent paragraph
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

				if (formulas.length === 0) {
					return {
						success: true,
						data: '文档中没有公式',
					};
				}

				// Format output
				let result = `文档中共有 ${formulas.length} 个公式:\n\n`;

				if (showDetails) {
					const formulaList = formulas.map((f, idx) => {
						let info = `公式 ${idx + 1}:\n`;
						info += `  类型: ${f.type === 'omml' ? 'Office Math (OMML)' : 'MathType (OLE)'}\n`;
						info += `  LaTeX: ${f.latex}\n`;
						if (f.paragraphIndex >= 0) {
							info += `  位置: 段落 ${f.paragraphIndex + 1}`;
						}
						if (f.olePath) {
							info += `\n  嵌入文件: ${f.olePath}`;
						}
						return info;
					}).join('\n\n');
					result += formulaList;
				} else {
					const formulaList = formulas.map((f, idx) => {
						return `公式 ${idx + 1}: ${f.latex} (${f.type === 'omml' ? 'OMML' : 'MathType'})`;
					}).join('\n');
					result += formulaList;
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

/**
 * Parse MathType OLE objects from document
 */
export function parseOleFormulas(loaded: ReturnType<typeof loadDocxXml>): Omit<FormulaEntry, 'index'>[] {
	const formulas: Omit<FormulaEntry, 'index'>[] = [];

	// Check for embeddings directory
	const entries = loaded.zip.getEntries();
	const embeddingEntries = entries.filter(e => e.entryName.startsWith('word/embeddings/'));

	for (const entry of embeddingEntries) {
		const name = entry.name.split('/').pop() || '';
		// MathType formulas typically have .ole or specific naming
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
