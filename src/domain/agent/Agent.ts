// src/domain/agent/Agent.ts
import path from 'node:path';
import { ToolRegistry } from '../tools/registry.js';
import { Document } from '../document/entities/Document.js';
import { AgentContextBuilder } from './context.js';
import { AgentConfig, AgentMessage, AgentRunHooks } from './types.js';
import { CompleteMessage, CompleteParams, MessageContentBlock, ToolResultContentBlock, ToolUseContentBlock } from '../../infrastructure/ai/types.js';
import { ConfigManager } from '../../infrastructure/config/ConfigManager.js';

const SYSTEM_PROMPT = `你是一个智能文档编辑助手。你可以使用工具来读取和编辑 Word 文档。

可用工具：
- bash: 在工作区内执行命令
- read_file: 读取工作区文件
- write_file: 写入工作区文件
- edit_file: 精确替换工作区文件中的文本
- delete_file: 删除工作区文件或目录
- get_document_info: 获取文档基本信息
- get_document_text: 获取文档完整文本内容
- get_document_outline: 获取文档大纲（标题结构）
- format_text: 格式化文本（字体、大小、颜色、粗体、斜体、下划线等）
- format_paragraphs: 格式化段落（对齐、行距、缩进等）
- format_table_cells: 格式化表格（边框、对齐、单元格样式等）
- search_and_replace: 搜索并替换文本
- add_content: 添加新内容（段落、表格等）
- add_heading: 添加标题
- replace_block_between_anchors: 替换锚点之间的内容
- list_images: 列出文档中的所有图像
- add_image: 添加图像到文档
- delete_image: 删除文档中的图像
- resize_image: 修改图像尺寸
- replace_image: 替换文档中的图像

工作流程：
1. 首先使用工具了解文档内容
2. 如果任务涉及工作区文件、脚本、配置或命令，优先使用通用 runtime 工具
3. 根据用户指令决定需要执行的操作
4. 使用相应工具完成编辑
5. 返回操作结果

注意：
- 在执行任何编辑前，先读取文档内容了解结构
- 对于“全部、完整、逐项、边界测试、穷举”这类多步骤任务，先在内部列出检查清单，逐项完成后再结束
- 如果只完成了部分步骤，不要把阶段性进度当成最终答案，继续执行剩余步骤
- 每次编辑文档后，都要基于最新结果继续判断下一步，必要时再次读取文档确认修改已经生效
- 如果用户没有指定文档，提醒用户加载文档
- 所有修改都会直接保存到原文档
- 如果用户要求写知识库、教程、说明文、报告、文章、总结等成品内容，即使用户没有明确要求配色和字号，也要默认把结构和排版做完整，不要只写裸文本
- 默认成品排版规则：文档主标题使用一级标题，并额外设置为加粗、较大字号、醒目颜色；各节标题使用二级标题，并额外设置为加粗、略小于主标题的字号、与主标题协调的颜色；正文保持清晰易读，必要时使用段落格式工具改善可读性
- 当用户提到“格式规范”“标题规范”“写得美观”“整理成知识库”这类要求时，除了写入内容，还应主动调用格式化工具完成标题和关键结构的美化
- 写入较长结构化内容后，优先检查大纲或关键标题是否已经成型；如果只是添加了 heading 样式但还没有完成视觉格式化，应继续调用格式化工具，不要过早结束
- 如果用户询问“文档讲了什么”、“总结一下”、“这一章内容”之类的问题，必须先调用工具读取文档，不要只根据已有上下文猜测
- 这是终端 CLI，不要使用 Markdown 格式
- 不要输出标题、表格、代码块、粗体、斜体、项目符号层级或引用格式
- 不要使用 emoji
- 用简洁的纯文本回答，必要时用普通换行和阿拉伯数字编号`;

export class Agent {
  private document: Document | null = null;
  private documentPath: string | null = null;
  private messages: CompleteMessage[] = [];

  constructor(
    private toolRegistry: ToolRegistry,
    private config: AgentConfig = {}
  ) {
    this.config = {
      temperature: 0.7,
      maxTokens: 4096,
      persistConversation: false,
      ...config,
    };
  }

  async loadDocument(documentPath: string): Promise<void> {
    this.documentPath = documentPath;
    this.document = new Document(documentPath);
    await this.document.load();
    // Reset conversation when loading new document
    this.messages = [];
  }

  getDocument(): Document | null {
    return this.document;
  }

  getDocumentPath(): string | null {
    return this.documentPath;
  }

  unloadDocument(): void {
    this.document = null;
    this.documentPath = null;
    this.messages = [];
  }

  async run(instruction: string, hooks: AgentRunHooks = {}): Promise<string> {
    // Initialize AI client
    const config = ConfigManager.load();
    const aiClient = await this.resolveAiClient(config);

    // Build context
    const contextBuilder = new AgentContextBuilder(
      this.documentPath || '',
      this.document,
      this.toolRegistry
    );
    const context = contextBuilder.build();

    // Build a fresh working transcript for this run. By default the CLI treats each
    // top-level request as a separate task to avoid unfinished prior chatter leaking in.
    const workingMessages: CompleteMessage[] = this.config.persistConversation ? [...this.messages] : [];

    // Add user message
    const userContent = this.document
      ? `${instruction}\n\n[文档信息]\n${context.documentInfo}`
      : instruction;

    workingMessages.push({ role: 'user', content: userContent });

    // Build messages for API
    const apiMessages = workingMessages;

    // Get tool definitions
    const tools = this.toolRegistry.getAllDescriptions();

    // Agent loop
    const maxIterations = this.config.maxIterations;
    let result = '';
    let completed = false;
    let exhaustedIterationBudget = false;
    let toolCallsObserved = 0;
    let iterationNumber = 0;

    while (maxIterations === undefined || iterationNumber < maxIterations) {
      iterationNumber += 1;
      hooks.onStateChange?.({
        state: 'thinking',
        summary: iterationNumber === 1 ? 'Analyzing your request and current document context' : 'Reviewing tool results and planning the next step',
        iteration: iterationNumber,
      });

      // Call AI
      const params: CompleteParams = {
        system: SYSTEM_PROMPT,
        messages: apiMessages,
        model: config.model.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        tools: tools as any,
      };

      const response = await aiClient.complete(params);
      const normalizedResponseContent = normalizeResponseContent(response.content, iterationNumber);
      apiMessages.push({ role: 'assistant', content: toAssistantContentBlocks(normalizedResponseContent) });
      let respondingAnnounced = false;
      let handledBlock = false;
      let iterationText = '';
      const toolResults: ToolResultContentBlock[] = [];

      // Process response
      for (const block of normalizedResponseContent) {
        if (block.type === 'text' && block.text) {
          handledBlock = true;
          if (!respondingAnnounced) {
            hooks.onStateChange?.({
              state: 'responding',
              summary: 'Composing the final answer',
              iteration: iterationNumber,
            });
            respondingAnnounced = true;
          }

          iterationText += block.text;
          result += block.text;
          hooks.onText?.(block.text);
        } else if (block.type === 'tool_use' && block.name && block.input) {
          handledBlock = true;
          toolCallsObserved += 1;
          // Execute tool
          const toolName = block.name;
          const toolInput = block.input;
          const toolUseId = block.id ?? `toolu:${iterationNumber}:fallback`;

          hooks.onStateChange?.({
            state: 'tool_use',
            summary: summarizeToolUse(toolName, toolInput),
            iteration: iterationNumber,
          });
          hooks.onToolStart?.({
            name: toolName,
            input: toolInput,
            summary: summarizeToolUse(toolName, toolInput),
            iteration: iterationNumber,
          });

          try {
            const tool = this.toolRegistry.get(toolName);
            if (!tool) {
              const missingToolMsg = `Tool execution error: Tool not found: ${toolName}`;
              hooks.onToolResult?.({
                name: toolName,
                input: toolInput,
                summary: missingToolMsg,
                result: missingToolMsg,
                success: false,
                iteration: iterationNumber,
              });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: missingToolMsg,
              });
              continue;
            }

            const toolResult = await tool.execute(toolInput);
            hooks.onToolResult?.({
              name: toolName,
              input: toolInput,
              summary: summarizeToolResult(toolName, toolResult),
              result: toolResult,
              success: toolResult.success,
              iteration: iterationNumber,
            });

            let resultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);

            try {
              const refreshedContext = await this.refreshDocumentContextAfterTool(toolName, toolInput, toolResult);
              if (refreshedContext) {
                resultText = `${resultText}\n\n${refreshedContext}`;
              }
            } catch (error) {
              const refreshWarning = `Document refresh warning: ${error instanceof Error ? error.message : String(error)}`;
              resultText = `${resultText}\n\n${refreshWarning}`;
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: resultText,
            });
          } catch (error) {
            const errorMsg = `Tool execution error: ${error instanceof Error ? error.message : String(error)}`;
            hooks.onToolResult?.({
              name: toolName,
              input: toolInput,
              summary: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
              result: errorMsg,
              success: false,
              iteration: iterationNumber,
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: errorMsg,
            });
          }
        }
      }

      if (toolResults.length > 0) {
        apiMessages.push({ role: 'user', content: toolResults });
      }

      if (!handledBlock) {
        const errorMsg = 'Agent received an empty response and could not continue the task.';
        apiMessages.push({ role: 'assistant', content: errorMsg });
        break;
      }

      // Check if done
      if (response.stop_reason === 'end_turn') {
        const autoContinueDecision = getAutoContinueDecision({
          instruction,
          iterationText,
          toolCallsObserved,
        });

        if (autoContinueDecision.shouldContinue) {
          const continueMessage = buildContinueMessage();
          apiMessages.push({ role: 'user' as const, content: continueMessage });
          hooks.onStateChange?.({
            state: 'thinking',
            summary: 'Previous reply was only progress update; continuing remaining steps automatically',
            iteration: iterationNumber,
          });
          continue;
        }

        completed = true;
        break;
      }
    }

    if (!completed && maxIterations !== undefined && iterationNumber >= maxIterations) {
      exhaustedIterationBudget = true;
    }

    hooks.onStateChange?.({ state: 'idle', summary: 'Ready' });

    if (this.config.persistConversation) {
      this.messages = apiMessages;
    }

    if (!completed) {
      const incompleteNotice = exhaustedIterationBudget
        ? '任务达到配置的代理迭代上限，结果可能不完整。你可以直接让我继续剩余测试，或者把 maxIterations 设得更大。'
        : '任务未明确结束，结果可能不完整。你可以直接让我继续剩余测试。';
      return result ? `${result}\n\n${incompleteNotice}` : incompleteNotice;
    }

    return result || '处理完成';
  }

  private async refreshDocumentContextAfterTool(
    toolName: string,
    toolInput: object,
    toolResult: { success?: boolean }
  ): Promise<string | null> {
    if (!toolResult.success || !this.documentPath || !DOCUMENT_MUTATION_TOOLS.has(toolName)) {
      return null;
    }

    const updatedDocPath = getToolDocumentPath(toolInput);
    if (!updatedDocPath || !isSameDocumentPath(this.documentPath, updatedDocPath)) {
      return null;
    }

    const reloadedDocument = new Document(this.documentPath);
    await reloadedDocument.load();
    this.document = reloadedDocument;

    return [
      '[文档状态已刷新]',
      `文档路径: ${reloadedDocument.path}`,
      `段落数: ${reloadedDocument.paragraphs.length}`,
      `表格数: ${reloadedDocument.tables.length}`,
      `标题数: ${reloadedDocument.headingOutline.length}`,
      '如果还需要确认正文或结构，请继续调用文档工具读取最新内容。',
    ].join('\n');
  }

  private async resolveAiClient(config: ReturnType<typeof ConfigManager.load>) {
    if (this.config.aiClient) {
      return this.config.aiClient;
    }

    const apiKey = config.model.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }

    const { createAnthropicClient } = await import('../../infrastructure/ai/AnthropicClient.js');
    return createAnthropicClient(apiKey, config.model.baseUrl);
  }
}

function toAssistantContentBlocks(content: Array<{ type: 'text' | 'tool_use'; text?: string; id?: string; name?: string; input?: object }>): MessageContentBlock[] {
  const blocks: MessageContentBlock[] = [];
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      blocks.push({ type: 'text', text: block.text });
      continue;
    }

    if (block.type === 'tool_use' && block.id && block.name && block.input) {
      blocks.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }

  }

  return blocks;
}

function normalizeResponseContent(
  content: Array<{ type: 'text' | 'tool_use'; text?: string; id?: string; name?: string; input?: object }>,
  iterationNumber: number,
): Array<{ type: 'text' | 'tool_use'; text?: string; id?: string; name?: string; input?: object }> {
  return content.map((block, index) => {
    if (block.type === 'tool_use' && !block.id) {
      return {
        ...block,
        id: `toolu:${iterationNumber}:${index}`,
      };
    }

    return block;
  });
}

function getAutoContinueDecision(params: {
  instruction: string;
  iterationText: string;
  toolCallsObserved: number;
}): {
  shouldContinue: boolean;
  multiStepTask: boolean;
  incompleteReply: boolean;
  progressStub: boolean;
  explicitCompletion: boolean;
} {
  const { instruction, iterationText, toolCallsObserved } = params;
  if (toolCallsObserved === 0) {
    return {
      shouldContinue: false,
      multiStepTask: false,
      incompleteReply: false,
      progressStub: false,
      explicitCompletion: false,
    };
  }

  const normalizedInstruction = normalizeTextForHeuristics(instruction);
  const normalizedIterationText = normalizeTextForHeuristics(iterationText);
  if (!normalizedIterationText) {
    return {
      shouldContinue: false,
      multiStepTask: false,
      incompleteReply: false,
      progressStub: false,
      explicitCompletion: false,
    };
  }

  const multiStepTask = MULTI_STEP_TASK_PATTERNS.some(pattern => pattern.test(normalizedInstruction));
  const incompleteReply = INCOMPLETE_PROGRESS_PATTERNS.some(pattern => pattern.test(normalizedIterationText));
  const progressStub = looksLikeProgressStub(normalizedIterationText);
  const explicitCompletion = COMPLETION_PATTERNS.some(pattern => pattern.test(normalizedIterationText));

  return {
    shouldContinue: multiStepTask && (incompleteReply || progressStub) && !explicitCompletion,
    multiStepTask,
    incompleteReply,
    progressStub,
    explicitCompletion,
  };
}

function looksLikeProgressStub(normalizedText: string): boolean {
  const hasContinuationVerb = CONTINUATION_STUB_PATTERNS.some(pattern => pattern.test(normalizedText));
  const endsWithLeadIn = /[：:]$/.test(normalizedText);
  return hasContinuationVerb && endsWithLeadIn;
}

function buildContinueMessage(): string {
  return [
    '继续执行剩余未完成步骤。',
    '不要只汇报计划或阶段性进度。',
    '完成全部文档修改，并在文档结尾写入“已测试内容”总结后，再给出最终简短回复。',
    '如果还需要确认修改结果，请继续调用工具。',
  ].join('\n');
}

function normalizeTextForHeuristics(value: string): string {
  return value
    .replace(/[*_`#>\-[\]]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const MULTI_STEP_TASK_PATTERNS = [
  /全面/,
  /完整/,
  /逐项/,
  /边界/,
  /尽量覆盖/,
  /全部/,
  /测试样例/,
  /文档结尾输出/,
];

const INCOMPLETE_PROGRESS_PATTERNS = [
  /测试\d+[：:]/,
  /继续添加/,
  /继续进行/,
  /继续测试/,
  /现在添加/,
  /现在测试/,
  /现在我来/,
  /我来先/,
  /我需要先/,
  /我来继续/,
  /我会测试/,
  /我会继续/,
  /我将继续/,
  /然后添加/,
  /接下来/,
  /下一步/,
  /继续执行/,
  /继续补充/,
  /继续完成/,
  /继续更多/,
  /先读取文档内容/,
  /了解其结构后再进行测试/,
  /进行全面的边界能力测试/,
];

const CONTINUATION_STUB_PATTERNS = [
  /^继续/,
  /^接下来/,
  /^下一步/,
  /^现在继续/,
  /^继续测试/,
  /^继续添加/,
  /^继续补充/,
  /^继续完成/,
];

const COMPLETION_PATTERNS = [
  /已完成/,
  /处理完成/,
  /全部完成/,
  /测试完成/,
  /已测试内容/,
  /总结如下/,
  /最终结果/,
  /完成情况/,
];

const DOCUMENT_MUTATION_TOOLS = new Set([
  'add_content',
  'add_heading',
  'add_image',
  'create_document',
  'delete_image',
  'format_paragraphs',
  'format_table_cells',
  'format_text',
  'replace_block_between_anchors',
  'replace_image',
  'resize_image',
  'search_and_replace',
]);

function getToolDocumentPath(toolInput: object): string | null {
  const values = toolInput as Record<string, unknown>;
  return typeof values.docPath === 'string' ? values.docPath : null;
}

function isSameDocumentPath(left: string, right: string): boolean {
  return normalizeDocumentPath(left) === normalizeDocumentPath(right);
}

function normalizeDocumentPath(value: string): string {
  return path.resolve(value).replace(/\\/g, '/').toLowerCase();
}

function summarizeToolUse(toolName: string, input: object): string {
  const values = input as Record<string, unknown>;
  const keys = Object.keys(values);

  switch (toolName) {
    case 'get_document_info':
      return 'Inspecting document metadata and structure';
    case 'get_document_text':
      return 'Reading document text to gather context';
    case 'get_document_outline':
      return 'Inspecting the document outline';
    case 'search_and_replace':
      return `Searching and replacing text${typeof values.search === 'string' ? ` for "${values.search}"` : ''}`;
    case 'add_content':
      return `Adding content${typeof values.content === 'string' ? `: ${truncate(values.content, 48)}` : ''}`;
    case 'format_text':
    case 'format_paragraphs':
    case 'format_table_cells':
      return `Applying ${toolName} changes`;
    default:
      return keys.length > 0
        ? `Running ${toolName} with ${keys.slice(0, 3).join(', ')}`
        : `Running ${toolName}`;
  }
}

function summarizeToolResult(toolName: string, result: unknown): string {
  if (typeof result === 'object' && result !== null && 'success' in result) {
    const toolResult = result as { success?: boolean; error?: string; data?: unknown };
    if (toolResult.success) {
      if (typeof toolResult.data === 'string') {
        return `${toolName} completed: ${truncate(toolResult.data, 72)}`;
      }
      return `${toolName} completed successfully`;
    }

    return `${toolName} failed${toolResult.error ? `: ${truncate(toolResult.error, 72)}` : ''}`;
  }

  return `${toolName} completed`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
