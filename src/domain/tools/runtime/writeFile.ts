import fs from 'node:fs/promises';
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { ensureParentDirectory, resolveWorkspacePath } from './pathSafety.js';

interface WriteFileParams {
  path: string;
  content: string;
}

export const writeFileTool: Tool = {
  name: 'write_file',
  description: '写入工作区内文件，必要时自动创建父目录',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径，支持相对工作区路径' },
      content: { type: 'string', description: '文件内容' },
    },
    required: ['path', 'content'],
  },
  execute: async (params) => {
    const { path, content } = params as WriteFileParams;

    try {
      const resolved = resolveWorkspacePath(path);
      await ensureParentDirectory(resolved);
      await fs.writeFile(resolved, content, 'utf8');

      return {
        success: true,
        data: {
          path: resolved,
          bytesWritten: Buffer.byteLength(content, 'utf8'),
          message: `Wrote file: ${resolved}`,
        },
      };
    } catch (error) {
      if (error instanceof AgentError) {
        return { success: false, error: error.message };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};