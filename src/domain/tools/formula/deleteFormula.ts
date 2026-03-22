import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { parseOmmlElements, ommlToLatex } from './ommlToLatex.js';
import { parseOleFormulas, FormulaEntry } from './listFormulas.js';

export function getDeleteFormulaTool(): Tool {
	return {
		name: 'delete_formula',
		description: '删除文档中的指定公式',
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

				if (formula.type !== 'omml') {
					return {
						success: false,
						error: '不支持删除 MathType OLE 对象类型的公式。只支持删除 Office Math (OMML) 公式。',
					};
				}

				// Get the oMath element
				const omathElement = formula.element;

				// Try to find a suitable parent to remove
				// The structure is typically: p -> r -> oMathPara -> oMath
				let removed = false;
				let current: any = omathElement;

				while (current && current.parentNode) {
					const parent = current.parentNode;
					const localName = current.localName || current.nodeName?.split(':').pop();

					// Check if we should remove this element
					if (localName === 'oMath' || localName === 'oMathPara') {
						// Check if the parent run only contains this formula
						if (parent.localName === 'w:r' || (parent.nodeName && parent.nodeName.includes('r'))) {
							// Try to remove the run instead
							if (parent.parentNode) {
								parent.parentNode.removeChild(parent);
								removed = true;
								break;
							}
						} else if (localName === 'oMath') {
							// Just remove the oMath element
							parent.removeChild(current);
							removed = true;
							break;
						}
					}

					current = parent;
				}

				if (!removed) {
					// Fallback: try to directly remove the oMath element
					try {
						if (omathElement.parentNode) {
							omathElement.parentNode.removeChild(omathElement);
							removed = true;
						}
					} catch {
						// Ignore
					}
				}

				if (!removed) {
					return {
						success: false,
						error: '无法删除公式元素',
					};
				}

				// Save the document
				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: `已成功删除公式 ${formulaIndex + 1}: ${formula.latex}`,
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
