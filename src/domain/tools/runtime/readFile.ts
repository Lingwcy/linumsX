import fs from 'node:fs/promises';
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { resolveWorkspacePath, truncateOutput } from './pathSafety.js';

interface ReadFileParams {
  path: string;
  limit?: number;
}

export const readFileTool: Tool = {
  name: 'read_file',
  description: '读取工作区内文件内容',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径，支持相对工作区路径' },
      limit: { type: 'number', description: '最多返回的行数' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const { path, limit } = params as ReadFileParams;

    try {
      const resolved = resolveWorkspacePath(path);
      const content = await fs.readFile(resolved, 'utf8');
      const lines = content.split(/\r?\n/);
      const limited = limit && limit > 0 && limit < lines.length
        ? [...lines.slice(0, limit), `... (${lines.length - limit} more lines)`]
        : lines;

      return {
        success: true,
        data: {
          path: resolved,
          content: truncateOutput(limited.join('\n')),
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