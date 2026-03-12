import { Tool } from '../types.js';
import { ensureEditableDocPath, addImageToDocx, getImageMimeType } from '../shared/docxXml.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export function getAddImageTool(): Tool {
  return {
    name: 'add_image',
    description: '从文件添加图像到 Word 文档',
    schema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: '目标文档路径' },
        imagePath: { type: 'string', description: '源图像文件路径' },
        position: { type: 'number', description: '插入位置（段落后）' },
        width: { type: 'number', description: '图像宽度（英寸）' },
        height: { type: 'number', description: '图像高度（英寸）' },
        description: { type: 'string', description: '图像描述/替代文字' },
      },
      required: ['docPath', 'imagePath'],
    },
    execute: async (params) => {
      const { docPath, imagePath, position, width = 3, height, description } = params as {
        docPath: string;
        imagePath: string;
        position?: number;
        width?: number;
        height?: number;
        description?: string;
      };

      try {
        await ensureEditableDocPath(docPath);

        // 验证图像文件存在
        try {
          await fs.access(imagePath);
        } catch {
          return { success: false, error: `图像文件不存在: ${imagePath}` };
        }

        // 验证图像格式
        const imageExt = path.extname(imagePath).toLowerCase();
        const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.emf', '.wmf'];
        if (!supportedFormats.includes(imageExt)) {
          return { success: false, error: `不支持的图像格式: ${imageExt}` };
        }

        const result = await addImageToDocx(docPath, imagePath, { position, width, height, description });

        if (result.success) {
          return {
            success: true,
            data: `图像已成功添加: ${result.imageName}`,
          };
        } else {
          return { success: false, error: result.error };
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
