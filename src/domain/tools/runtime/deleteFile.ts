import fs from 'node:fs/promises';
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { resolveWorkspacePath } from './pathSafety.js';

interface DeleteFileParams {
  path: string;
  recursive?: boolean;
}

export const deleteFileTool: Tool = {
  name: 'delete_file',
  description: '删除工作区内文件，目录删除需显式传 recursive=true',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件或目录路径，支持相对工作区路径' },
      recursive: { type: 'boolean', description: '删除目录时是否递归删除' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const { path, recursive = false } = params as DeleteFileParams;

    try {
      const resolved = resolveWorkspacePath(path);
      const stat = await fs.stat(resolved);

      if (stat.isDirectory()) {
        if (!recursive) {
          return {
            success: false,
            error: 'Refusing to delete directory without recursive=true',
          };
        }

        await fs.rm(resolved, { recursive: true, force: false });
      } else {
        await fs.unlink(resolved);
      }

      return {
        success: true,
        data: {
          path: resolved,
          message: `Deleted: ${resolved}`,
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