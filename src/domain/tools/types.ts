import { JSONSchema7 } from 'json-schema';

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type ToolExecutor = (params: unknown) => Promise<ToolResult>;

export interface Tool {
  name: string;
  description: string;
  execute: ToolExecutor;
  schema: JSONSchema7;
}

export interface ToolDescription {
  name: string;
  description: string;
  input_schema: JSONSchema7;
}
