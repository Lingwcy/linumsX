import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml.js';
import { createOmmlWrapper } from './latexToOmml.js';

export function getAddFormulaTool(): Tool {
	return {
		name: 'add_formula',
		description: '在文档中添加新公式',
		schema: {
			type: 'object',
			properties: {
				docPath: {
					type: 'string',
					description: '文档路径',
				},
				latex: {
					type: 'string',
					description: 'LaTeX 格式的公式，如 E=mc^2 或 \\frac{a}{b}',
				},
				position: {
					type: 'number',
					description: '插入位置（段落索引，从 0 开始）。如果不指定，则添加到文档末尾',
				},
			},
			required: ['docPath', 'latex'],
		},
		execute: async (params) => {
			const { docPath, latex, position } = params as { docPath: string; latex: string; position?: number };

			try {
				await ensureEditableDocPath(docPath);
				const loaded = loadDocxXml(docPath);

				// Convert LaTeX to OMML
				const ommlXml = createOmmlWrapper(latex);

				// Parse the OMML XML
				const parser = new (require('@xmldom/xmldom').DOMParser)();
				const ommlDoc = parser.parseFromString(ommlXml, 'text/xml');
				const omathElement = ommlDoc.documentElement;

				// Get document body
				const body = loaded.xmlDocument.getElementsByTagName('w:body')[0];
				if (!body) {
					return {
						success: false,
						error: '无法找到文档主体',
					};
				}

				// Create a new paragraph with the formula
				const paragraphs = body.getElementsByTagName('w:p');

				if (position !== undefined && position >= 0 && position < paragraphs.length) {
					// Insert at specific position
					const targetParagraph = paragraphs[position];
					const newP = createParagraphWithFormula(omathElement);
					body.insertBefore(newP, targetParagraph);
				} else {
					// Add to end of document (before section properties)
					const sectPr = body.getElementsByTagName('w:sectPr')[0];
					const newP = createParagraphWithFormula(omathElement);
					if (sectPr) {
						body.insertBefore(newP, sectPr);
					} else {
						body.appendChild(newP);
					}
				}

				// Save the document
				await saveDocxXml(docPath, loaded);

				return {
					success: true,
					data: `已成功添加公式: ${latex}`,
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
 * Create a paragraph element containing an oMath element
 */
function createParagraphWithFormula(omathElement: any): any {
	const doc = omathElement.ownerDocument || omathElement.parentNode?.ownerDocument;

	// Create paragraph element
	const p = doc.createElement('w:p');

	// Create paragraph properties (optional, for centering or other styles)
	const pPr = doc.createElement('w:pPr');
	const jc = doc.createElement('w:jc');
	jc.setAttribute('w:val', 'center');
	pPr.appendChild(jc);
	p.appendChild(pPr);

	// Create run element
	const r = doc.createElement('w:r');

	// Create run properties with math font
	const rPr = doc.createElement('w:rPr');
	const rFonts = doc.createElement('w:rFonts');
	rFonts.setAttribute('w:ascii', 'Cambria Math');
	rFonts.setAttribute('w:hAnsi', 'Cambria Math');
	rFonts.setAttribute('w:cs', 'Cambria Math');
	rPr.appendChild(rFonts);
	r.appendChild(rPr);

	// Create oMathPara wrapper (for standalone formula)
	const oMathPara = doc.createElement('m:oMathPara');
	oMathPara.appendChild(omathElement.cloneNode(true));
	r.appendChild(oMathPara);

	p.appendChild(r);

	return p;
}
