import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Document as DocxDocument, Packer, Paragraph } from 'docx';
import { Agent } from '../../src/domain/agent/Agent.js';
import { ConfigManager } from '../../src/infrastructure/config/ConfigManager.js';
import { MessageContentBlock } from '../../src/infrastructure/ai/types.js';
import { ToolRegistry } from '../../src/domain/tools/registry.js';
import { addContentTool } from '../../src/domain/tools/content/addContent.js';

async function createTempDocx(name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-doc-ts-agent-'));
  const filePath = path.join(dir, name);
  const document = new DocxDocument({
    sections: [{ children: [new Paragraph('初始段落')] }],
  });
  const buffer = await Packer.toBuffer(document);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

describe('Agent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes the loaded document state after a successful mutation tool call', async () => {
    const docPath = await createTempDocx('agent-refresh.docx');
    const mockComplete = vi.fn();
    vi.spyOn(ConfigManager, 'load').mockReturnValue({
      model: {
        apiKey: 'test-key',
        baseUrl: undefined,
        model: 'test-model',
      },
      agent: {
        temperature: 0,
        maxTokens: 1024,
      },
    } as any);

    mockComplete
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'add_content',
            input: {
              docPath,
              content: '新增段落',
            },
          },
        ],
        stop_reason: 'tool_use',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '已完成所有步骤' }],
        stop_reason: 'end_turn',
      });

    const registry = new ToolRegistry();
    registry.register(addContentTool);

    const agent = new Agent(registry, {
      maxIterations: 4,
      temperature: 0,
      maxTokens: 1024,
      aiClient: {
        complete: mockComplete,
      },
    });

    await agent.loadDocument(docPath);
    const result = await agent.run('添加一个新段落，然后确认完成。');

    expect(result).toContain('已完成所有步骤');
    expect(agent.getDocument()?.paragraphs.map(paragraph => paragraph.text)).toEqual(['初始段落', '新增段落']);

    const secondCallParams = mockComplete.mock.calls[1][0];
    const toolResultMessage = secondCallParams.messages.find((message: { role: string; content: string | MessageContentBlock[] }) => message.role === 'user' && Array.isArray(message.content));
    expect(toolResultMessage).toBeDefined();
    expect(toolResultMessage?.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: expect.any(String),
        content: [
          JSON.stringify({ success: true, data: { message: 'Added paragraph: 新增段落' } }),
          '',
      '[文档状态已刷新]',
      `文档路径: ${docPath}`,
      '段落数: 2',
      '表格数: 0',
      '标题数: 0',
      '如果还需要确认正文或结构，请继续调用文档工具读取最新内容。',
        ].join('\n'),
      },
    ]);
  });

  it('continues automatically when the model ends with progress-only text during a multi-step task', async () => {
    const docPath = await createTempDocx('agent-autocontinue.docx');
    const mockComplete = vi.fn();
    vi.spyOn(ConfigManager, 'load').mockReturnValue({
      model: {
        apiKey: 'test-key',
        baseUrl: undefined,
        model: 'test-model',
      },
      agent: {
        temperature: 0,
        maxTokens: 1024,
      },
    } as any);

    mockComplete
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'add_content',
            input: {
              docPath,
              content: '阶段性测试段落',
            },
          },
        ],
        stop_reason: 'tool_use',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '我需要先读取文档内容，了解其结构后再进行测试。现在我来对文档进行全面的边界能力测试。我会测试各种功能并记录测试结果。继续进行更多边界测试：继续进行更多边界测试：' }],
        stop_reason: 'end_turn',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '**测试3：添加普通段落**' }],
        stop_reason: 'end_turn',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '继续测试更多格式功能：' }],
        stop_reason: 'end_turn',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '已完成所有测试，并已在文档结尾写入已测试内容总结。' }],
        stop_reason: 'end_turn',
      });

    const registry = new ToolRegistry();
    registry.register(addContentTool);

    const agent = new Agent(registry, {
      maxIterations: 6,
      temperature: 0,
      maxTokens: 1024,
      aiClient: {
        complete: mockComplete,
      },
    });

    await agent.loadDocument(docPath);
    const result = await agent.run('向这个文章写入你能够测试到的全面的文档边界能力，尽量覆盖全测试样例，并在文档结尾输出你测试了什么');

    expect(mockComplete).toHaveBeenCalledTimes(5);
  expect(result).toContain('继续进行更多边界测试');
    expect(result).toContain('测试3：添加普通段落');
    expect(result).toContain('继续测试更多格式功能');
    expect(result).toContain('已完成所有测试，并已在文档结尾写入已测试内容总结。');

    const fifthCallParams = mockComplete.mock.calls[4][0];
    const messageContents = fifthCallParams.messages
      .filter((message: { content: string | MessageContentBlock[] }) => typeof message.content === 'string')
      .map((message: { content: string }) => message.content);
    expect(messageContents).toContain([
      '继续执行剩余未完成步骤。',
      '不要只汇报计划或阶段性进度。',
      '完成全部文档修改，并在文档结尾写入“已测试内容”总结后，再给出最终简短回复。',
      '如果还需要确认修改结果，请继续调用工具。',
    ].join('\n'));
  });
});