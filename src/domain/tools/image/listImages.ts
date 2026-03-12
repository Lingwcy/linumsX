import { Tool } from '../types.js';
import { ensureEditableDocPath, loadDocxXml, parseImageEntries } from '../shared/docxXml.js';

export function getListImagesTool(): Tool {
  return {
    name: 'list_images',
    description: '列出文档中所有图像的信息，包括图像名称、尺寸、类型等',
    schema: {
      type: 'object',
      properties: {
        docPath: {
          type: 'string',
          description: '文档路径',
        },
      },
      required: ['docPath'],
    },
    execute: async (params) => {
      const { docPath } = params as { docPath: string };

      try {
        await ensureEditableDocPath(docPath);
        const loaded = loadDocxXml(docPath);
        const images = parseImageEntries(loaded);

        if (images.length === 0) {
          return {
            success: true,
            data: '文档中没有图像',
          };
        }

        const imageList = images.map((img, index) =>
          `图像 ${index + 1}:\n` +
          `  名称: ${img.name}\n` +
          `  ID: ${img.id}\n` +
          `  类型: ${img.type}\n` +
          `  宽度: ${img.width ? img.width.toFixed(2) + ' 英寸' : '未知'}\n` +
          `  高度: ${img.height ? img.height.toFixed(2) + ' 英寸' : '未知'}`
        ).join('\n\n');

        return {
          success: true,
          data: `文档中共有 ${images.length} 个图像:\n\n${imageList}`,
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
