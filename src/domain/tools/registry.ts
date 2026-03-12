import { Tool, ToolDescription, ToolExecutor } from './types.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, params: unknown): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool ${name} not found` };
    }
    return tool.execute(params);
  }

  getAllDescriptions(): ToolDescription[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema,
    }));
  }
}
