import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml/io.js';
import { parseTocEntries } from '../shared/docxXml/structure.js';
import { XMLSerializer } from '@xmldom/xmldom';

export function getDeleteTocTool(): Tool {
  return {
    name: 'delete_toc',
    description: '删除文档中的目录',
    schema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: '文档路径' },
        tocIndex: { type: 'number', description: '要删除的目录索引（第几个目录）' },
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
            error: '文档中没有目录',
          };
        }

        if (tocIndex >= tocs.length) {
          return {
            success: false,
            error: `目录索引 ${tocIndex} 不存在，文档中共有 ${tocs.length} 个目录`,
          };
        }

        // 删除目录标题段落（如果存在）
        const tocPara = tocs[tocIndex].element;
        const prevSibling = tocPara.previousSibling;

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

        // 删除目录段落
        tocPara.parentNode?.removeChild(tocPara);

        loaded.xml = new XMLSerializer().serializeToString(loaded.xmlDocument);
        await saveDocxXml(docPath, loaded);

        return {
          success: true,
          data: '目录已删除',
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
