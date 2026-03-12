import { Tool } from '../types.js';
import { ensureEditableDocPath } from '../shared/docxXml.js';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const EMU_PER_INCH = 914400;

export function getResizeImageTool(): Tool {
  return {
    name: 'resize_image',
    description: '修改文档中图像的尺寸',
    schema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: '文档路径' },
        imageName: { type: 'string', description: '图像文件名' },
        width: { type: 'number', description: '新宽度（英寸）' },
        height: { type: 'number', description: '新高度（英寸）' },
      },
      required: ['docPath', 'imageName', 'width'],
    },
    execute: async (params) => {
      const { docPath, imageName, width, height } = params as {
        docPath: string;
        imageName: string;
        width: number;
        height?: number;
      };

      try {
        await ensureEditableDocPath(docPath);

        // 验证参数
        if (width <= 0 || width > 100) {
          return { success: false, error: '宽度必须在 0-100 英寸之间' };
        }
        if (height !== undefined && (height <= 0 || height > 100)) {
          return { success: false, error: '高度必须在 0-100 英寸之间' };
        }

        const zip = new AdmZip(docPath);
        const docEntry = zip.getEntry('word/document.xml');

        if (!docEntry) {
          return { success: false, error: '无效的文档' };
        }

        let docXml = docEntry.getData().toString('utf8');
        docXml = updateImageSize(docXml, imageName, width, height);
        zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf8'));

        zip.writeZip(docPath);

        return {
          success: true,
          data: `图像尺寸已更新: ${imageName}`,
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

function updateImageSize(docXml: string, imageName: string, width: number, height?: number): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'text/xml');

  const widthEmus = Math.round(width * EMU_PER_INCH);
  const heightEmus = height ? Math.round(height * EMU_PER_INCH) : widthEmus;

  // 查找所有包含指定图像名称的 drawing 元素
  const drawings = doc.getElementsByTagName('w:drawing');

  for (let i = 0; i < drawings.length; i++) {
    const drawing = drawings[i];
    const picLocks = drawing.getElementsByTagName('pic:cNvPicPr')[0] ||
                     drawing.getElementsByTagName('picLocks')[0];

    if (picLocks && picLocks.getAttribute('name') === imageName) {
      // 更新 wp:extent
      const extent = drawing.getElementsByTagName('wp:extent')[0];
      if (extent) {
        extent.setAttribute('cx', String(widthEmus));
        extent.setAttribute('cy', String(heightEmus));
      }

      // 更新 pic:spPr/a:xfrm/a:ext
      const ext = drawing.getElementsByTagName('a:ext')[0];
      if (ext) {
        ext.setAttribute('cx', String(widthEmus));
        ext.setAttribute('cy', String(heightEmus));
      }
    }
  }

  return new XMLSerializer().serializeToString(doc);
}
