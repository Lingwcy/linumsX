import { Tool } from '../types.js';
import { ensureEditableDocPath } from '../shared/docxXml.js';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export function getDeleteImageTool(): Tool {
  return {
    name: 'delete_image',
    description: '删除文档中的指定图像',
    schema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: '文档路径' },
        imageName: { type: 'string', description: '要删除的图像文件名' },
      },
      required: ['docPath', 'imageName'],
    },
    execute: async (params) => {
      const { docPath, imageName } = params as { docPath: string; imageName: string };

      try {
        await ensureEditableDocPath(docPath);
        const zip = new AdmZip(docPath);

        // 检查图像文件是否存在
        const mediaPath = `word/media/${imageName}`;
        const imageEntry = zip.getEntry(mediaPath);
        if (!imageEntry) {
          return { success: false, error: `图像不存在: ${imageName}` };
        }

        // 删除图像文件
        zip.deleteFile(mediaPath);

        // 从 document.xml 中移除引用
        const docEntry = zip.getEntry('word/document.xml');
        if (docEntry) {
          let docXml = docEntry.getData().toString('utf8');
          docXml = removeImageReference(docXml, imageName);
          zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf8'));
        }

        // 从关系文件中移除图像关系
        const relsEntry = zip.getEntry('word/_rels/document.xml.rels');
        if (relsEntry) {
          let relsXml = relsEntry.getData().toString('utf8');
          relsXml = removeImageRel(relsXml, imageName);
          zip.updateFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'));
        }

        zip.writeZip(docPath);

        return { success: true, data: `图像已删除: ${imageName}` };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

function removeImageReference(docXml: string, imageName: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'text/xml');

  // 查找所有包含指定图像名称的 drawing 元素
  const drawings = doc.getElementsByTagName('w:drawing');
  const toRemove: Element[] = [];

  for (let i = 0; i < drawings.length; i++) {
    const drawing = drawings[i];
    const picLocks = drawing.getElementsByTagName('pic:cNvPicPr')[0] ||
                     drawing.getElementsByTagName('picLocks')[0];
    if (picLocks && picLocks.getAttribute('name') === imageName) {
      toRemove.push(drawing);
    }
  }

  // 移除找到的 drawing 元素
  for (const el of toRemove) {
    el.parentNode?.removeChild(el);
  }

  return new XMLSerializer().serializeToString(doc);
}

function removeImageRel(relsXml: string, imageName: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(relsXml, 'text/xml');

  const relationships = doc.getElementsByTagName('Relationship');
  const toRemove: Element[] = [];

  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i];
    const target = rel.getAttribute('Target');
    if (target && target === `media/${imageName}`) {
      toRemove.push(rel);
    }
  }

  for (const el of toRemove) {
    el.parentNode?.removeChild(el);
  }

  return new XMLSerializer().serializeToString(doc);
}
