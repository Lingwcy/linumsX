import fs from 'node:fs/promises';
import path from 'node:path';
import { AgentError, ErrorCode } from '../../../shared/errors/AgentError.js';

function workspaceRoot(): string {
  return path.resolve(process.cwd());
}

export function resolveWorkspacePath(pathText: string): string {
  if (!pathText || typeof pathText !== 'string') {
    throw new AgentError('Path must be a non-empty string', ErrorCode.INVALID_CONFIG, { path: pathText });
  }

  const root = workspaceRoot();
  const resolved = path.isAbsolute(pathText) ? path.resolve(pathText) : path.resolve(root, pathText);
  const relative = path.relative(root, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AgentError(`Path escapes workspace: ${pathText}`, ErrorCode.INVALID_CONFIG, { path: pathText });
  }

  return resolved;
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export function truncateOutput(text: string, limit = 50000): string {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}\n... (truncated)`;
}