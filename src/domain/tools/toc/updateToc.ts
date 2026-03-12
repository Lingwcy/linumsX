import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml/io.js';
import { parseTocEntries, insertTocIntoDocument, parseParagraphEntries } from '../shared/docxXml/structure.js';

export function getUpdateTocTool(): Tool {
  return {
    name: 'update_toc',
    description: '更新文档中的目录',
    schema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: '文档路径' },
        tocIndex: { type: 'number', description: '要更新的目录索引（第几个目录）' },
      },
      required: ['docPath'],
    },
    execute: async (params) => {
      const { docPath, tocIndex = 0 } = params as {
        docPath: string;
        tocIndex?: number;
      };

      try {
        await ensureEditableDocPath(docPath);

        // 检查文档中是否有目录
        const loaded = loadDocxXml(docPath);
        const tocs = parseTocEntries(loaded);

        if (tocs.length === 0) {
          return {
            success: false,
            error: '文档中没有目录，请先使用 generate_toc 生成目录',
          };
        }

        if (tocIndex >= tocs.length) {
          return {
            success: false,
            error: `目录索引 ${tocIndex} 不存在，文档中共有 ${tocs.length} 个目录`,
          };
        }

        // 获取文档标题数量
        const paragraphs = parseParagraphEntries(loaded);
        const headings = paragraphs.filter(p => p.style?.startsWith('Heading'));

        if (headings.length === 0) {
          return {
            success: false,
            error: '文档中没有标题，无法更新目录',
          };
        }

        // 删除旧目录
        const tocPara = tocs[tocIndex].element;
        const prevSibling = tocPara.previousSibling;

        // 删除目录标题段落（如果存在）
        if (prevSibling && prevSibling.nodeType === 1) {
          const prevElement = prevSibling as Element;
          const pPr = prevElement.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'pPr')[0];
          if (pPr) {
            const style = pPr.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'pStyle')[0];
            if (style && style.getAttribute('w:val')?.includes('TOC')) {
              prevSibling.parentNode?.removeChild(prevSibling);
            }
          }
        }

        // 删除旧目录段落
        tocPara.parentNode?.removeChild(tocPara);

        // 重新生成目录
        const updatedXml = insertTocIntoDocument(loaded.xml, {
          position: 0,
          headingLevels: [1, 2, 3],
          title: '目录',
        });

        loaded.xml = updatedXml;
        await saveDocxXml(docPath, loaded);

        return {
          success: true,
          data: `目录已更新，共 ${headings.length} 个标题项`,
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
