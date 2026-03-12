import fs from 'node:fs/promises';
import { Tool } from '../types.js';
import { AgentError } from '../../../shared/errors/AgentError.js';
import { resolveWorkspacePath } from './pathSafety.js';

interface EditFileParams {
  path: string;
  oldText: string;
  newText: string;
}

export const editFileTool: Tool = {
  name: 'edit_file',
  description: '在工作区文件中替换一段精确文本，只替换首次匹配',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径，支持相对工作区路径' },
      oldText: { type: 'string', description: '要替换的原始文本' },
      newText: { type: 'string', description: '替换后的文本' },
    },
    required: ['path', 'oldText', 'newText'],
  },
  execute: async (params) => {
    const { path, oldText, newText } = params as EditFileParams;

    try {
      const resolved = resolveWorkspacePath(path);
      const content = await fs.readFile(resolved, 'utf8');
      const index = content.indexOf(oldText);
      if (index < 0) {
        return {
          success: false,
          error: `Text not found in ${resolved}`,
        };
      }

      const updated = `${content.slice(0, index)}${newText}${content.slice(index + oldText.length)}`;
      await fs.writeFile(resolved, updated, 'utf8');

      return {
        success: true,
        data: {
          path: resolved,
          message: `Edited file: ${resolved}`,
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