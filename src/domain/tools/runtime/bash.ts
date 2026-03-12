import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool } from '../types.js';
import { truncateOutput } from './pathSafety.js';

const execAsync = promisify(exec);

interface BashParams {
  command: string;
}

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /sudo\b/i,
  /shutdown\b/i,
  /reboot\b/i,
  />\s*\/dev\//i,
  /format\s+[a-z]:/i,
  /del\s+\/f\s+\/s\s+\/q\s+[a-z]:\\/i,
  /rd\s+\/s\s+\/q\s+[a-z]:\\/i,
];

export const bashTool: Tool = {
  name: 'bash',
  description: '在当前工作区运行 shell 命令，带危险命令拦截',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令' },
    },
    required: ['command'],
  },
  execute: async (params) => {
    const { command } = params as BashParams;

    if (!command || typeof command !== 'string') {
      return { success: false, error: 'Command must be a non-empty string' };
    }

    if (BLOCKED_PATTERNS.some(pattern => pattern.test(command))) {
      return { success: false, error: 'Dangerous command blocked' };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 120000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });

      const combined = `${stdout}${stderr}`.trim();
      return {
        success: true,
        data: {
          command,
          output: combined ? truncateOutput(combined) : '(no output)',
        },
      };
    } catch (error: any) {
      const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
      const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
      const combined = `${stdout}${stderr}`.trim();

      return {
        success: false,
        error: combined ? truncateOutput(combined) : (error instanceof Error ? error.message : 'Unknown error'),
      };
    }
  },
};