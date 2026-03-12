// src/domain/agent/context.ts
import { Document } from '../document/entities/Document.js';
import { ToolRegistry } from '../tools/registry.js';
import { AgentContext, AgentMessage } from './types.js';

export class AgentContextBuilder {
  private messages: AgentMessage[] = [];

  constructor(
    private documentPath: string,
    private document: Document | null,
    private toolRegistry: ToolRegistry
  ) {}

  build(): AgentContext {
    return {
      documentPath: this.documentPath,
      documentInfo: this.buildDocumentInfo(),
      toolDescriptions: this.toolRegistry.getAllDescriptions(),
      messages: this.messages,
    };
  }

  private buildDocumentInfo(): string {
    if (!this.document) {
      return '无文档加载';
    }

    const info = [
      `文档路径: ${this.document.path}`,
      `段落数: ${this.document.paragraphs.length}`,
      `表格数: ${this.document.tables.length}`,
      `标题数: ${this.document.headingOutline.length}`,
      '',
      '不要基于这里的元信息直接回答文档内容问题。',
      '如果用户询问摘要、结构、章节、具体内容，必须先调用工具读取文档。',
    ];
    return info.join('\n');
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content });
  }
}
