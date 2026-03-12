import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, saveDocxXml } from '../shared/docxXml/io.js';
import { insertTocIntoDocument } from '../shared/docxXml/structure.js';
import { Document } from '../../document/entities/Document.js';

export function getGenerateTocTool(): Tool {
  return {
    name: 'generate_toc',
    description: '根据文档标题自动生成目录',
    schema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: '文档路径' },
        position: { type: 'number', description: '插入位置（段落索引）' },
        headingLevels: { type: 'array', items: { type: 'number' }, description: '要包含的标题级别，如 [1,2,3]' },
        title: { type: 'string', description: '目录标题' },
      },
      required: ['docPath'],
    },
    execute: async (params) => {
      const { docPath, position, headingLevels = [1, 2, 3], title = '目录' } = params as {
        docPath: string;
        position?: number;
        headingLevels?: number[];
        title?: string;
      };

      try {
        await ensureEditableDocPath(docPath);

        // 先加载文档检查是否有标题
        const doc = new Document(docPath);
        await doc.load();

        const headings = doc.headingOutline;
        if (headings.length === 0) {
          return {
            success: false,
            error: '文档中没有标题，请先添加标题后再生成目录',
          };
        }

        // 过滤出指定级别的标题
        const filteredHeadings = headings.filter(h => headingLevels.includes(h.level));
        if (filteredHeadings.length === 0) {
          return {
            success: false,
            error: `文档中没有指定级别 (${headingLevels.join(', ')}) 的标题`,
          };
        }

        // 加载并插入 TOC
        const loaded = loadDocxXml(docPath);
        const updatedXml = insertTocIntoDocument(loaded.xml, {
          position,
          headingLevels,
          title,
        });

        loaded.xml = updatedXml;
        await saveDocxXml(docPath, loaded);

        return {
          success: true,
          data: `目录已生成，包含 ${filteredHeadings.length} 个标题项`,
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
