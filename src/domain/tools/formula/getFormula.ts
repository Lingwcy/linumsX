import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml } from '../shared/docxXml.js';
import { parseOmmlElements, ommlToLatex } from './ommlToLatex.js';
import { FormulaEntry, parseOleFormulas } from './listFormulas.js';

export function getGetFormulaTool(): Tool {
	return {
		name: 'get_formula',
		description: '获取指定公式的详细信息',
		schema: {
			type: 'object',
			properties: {
				docPath: {
					type: 'string',
					description: '文档路径',
				},
				formulaIndex: {
					type: 'number',
					description: '公式索引（从 0 开始）',
				},
			},
			required: ['docPath', 'formulaIndex'],
		},
		execute: async (params) => {
			const { docPath, formulaIndex } = params as { docPath: string; formulaIndex: number };

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);

				// Get all formulas
				const formulas = getAllFormulas(loaded);

				if (formulas.length === 0) {
					return {
						success: false,
						error: '文档中没有公式',
					};
				}

				if (formulaIndex < 0 || formulaIndex >= formulas.length) {
					return {
						success: false,
						error: `公式索引无效。有效范围: 0 - ${formulas.length - 1}`,
					};
				}

				const formula = formulas[formulaIndex];

				let result = `公式 ${formulaIndex + 1} 详情:\n`;
				result += `类型: ${formula.type === 'omml' ? 'Office Math (OMML)' : 'MathType (OLE)'}\n`;
				result += `LaTeX: ${formula.latex}\n`;

				if (formula.paragraphIndex >= 0) {
					result += `所在段落: ${formula.paragraphIndex + 1}`;
				}

				if (formula.olePath) {
					result += `\n嵌入文件: ${formula.olePath}`;
				}

				// If OMML, also show raw XML for reference
				if (formula.type === 'omml' && formula.element) {
					try {
						const serializer = new (require('@xmldom/xmldom').XMLSerializer)();
						const xml = serializer.serializeToString(formula.element);
						if (xml.length < 500) {
							result += `\n\n原始 OMML:\n${xml}`;
						}
					} catch {
						// Ignore serialization errors
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

function getAllFormulas(loaded: ReturnType<typeof loadDocxXml>): FormulaEntry[] {
	const formulas: FormulaEntry[] = [];

	// Parse OMML formulas
	const ommlElements = parseOmmlElements(loaded.xmlDocument);

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

	return formulas;
}
