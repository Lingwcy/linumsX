import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { parseOmmlElements, ommlToLatex } from './ommlToLatex.js';
import { createOmmlWrapper } from './latexToOmml.js';
import { parseOleFormulas } from './listFormulas.js';

export function getEditFormulaTool(): Tool {
	return {
		name: 'edit_formula',
		description: '修改文档中现有公式的内容',
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
				latex: {
					type: 'string',
					description: '新的 LaTeX 公式内容',
				},
			},
			required: ['docPath', 'formulaIndex', 'latex'],
		},
		execute: async (params) => {
			const { docPath, formulaIndex, latex } = params as { docPath: string; formulaIndex: number; latex: string };

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

				if (formula.type !== 'omml') {
					return {
						success: false,
						error: '不支持修改 MathType OLE 对象类型的公式。只支持修改 Office Math (OMML) 公式。',
					};
				}

				// Convert new LaTeX to OMML
				const newOmmlXml = createOmmlWrapper(latex);
				const parser = new (require('@xmldom/xmldom').DOMParser)();
				const newOmmlDoc = parser.parseFromString(newOmmlXml, 'text/xml');
				const newOMathElement = newOmmlDoc.documentElement;

				// Replace the old formula with the new one
				if (formula.element && formula.element.parentNode) {
					const newElement = newOMathElement.cloneNode(true);
					formula.element.parentNode.replaceChild(newElement, formula.element);
				} else {
					return {
						success: false,
						error: '无法定位要修改的公式元素',
					};
				}

				// Save the document
				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: `已成功修改公式 ${formulaIndex + 1}。\n旧公式: ${formula.latex}\n新公式: ${latex}`,
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

interface FormulaEntry {
	index: number;
	type: 'omml' | 'mathtype';
	latex: string;
	paragraphIndex: number;
	element?: any;
	olePath?: string;
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
