import { Tool } from '../types.js';
import { ensureEditableDocPath, getImageMimeType } from '../shared/docxXml.js';
import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';

export function getReplaceImageTool(): Tool {
  return {
    name: 'replace_image',
    description: '用新图像替换文档中现有的图像',
    schema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: '文档路径' },
        imageName: { type: 'string', description: '要替换的图像文件名' },
        newImagePath: { type: 'string', description: '新图像文件路径' },
      },
      required: ['docPath', 'imageName', 'newImagePath'],
    },
    execute: async (params) => {
      const { docPath, imageName, newImagePath } = params as {
        docPath: string;
        imageName: string;
        newImagePath: string;
      };

      try {
        await ensureEditableDocPath(docPath);

        // 验证新图像文件存在
        try {
          await fs.access(newImagePath);
        } catch {
          return { success: false, error: `新图像文件不存在: ${newImagePath}` };
        }

        // 验证新图像格式
        const mimeType = getImageMimeType(newImagePath);
        if (!mimeType) {
          return { success: false, error: `不支持的图像格式: ${path.extname(newImagePath)}` };
        }

        const zip = new AdmZip(docPath);
        const mediaPath = `word/media/${imageName}`;

        // 检查原图像是否存在
        if (!zip.getEntry(mediaPath)) {
          return { success: false, error: `图像不存在: ${imageName}` };
        }

        // 替换图像文件
        const newImageBuffer = await fs.readFile(newImagePath);
        zip.updateFile(mediaPath, newImageBuffer);

        zip.writeZip(docPath);

        return {
          success: true,
          data: `图像已替换: ${imageName}`,
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
