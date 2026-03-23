// src/infrastructure/ai/AnthropicClient.ts
import Anthropic from '@anthropic-ai/sdk';
import { AIModelClient, CompleteParams, CompleteResponse } from './types.js';
import { AgentError, ErrorCode } from '../../shared/errors/AgentError.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

export type StreamCallback = (chunk: string) => void;
export type StreamDoneCallback = (final: string) => void;

export class AnthropicClient implements AIModelClient {
  private client: Anthropic;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseUrl,
    });
  }

  /**
   * Streaming completion - sends chunks via callback as they arrive
   */
  async completeStream(
    params: CompleteParams,
    onChunk: StreamCallback,
    onDone?: StreamDoneCallback
  ): Promise<CompleteResponse> {
    let lastError: unknown;
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const response = await this.client.messages.create({
          model: params.model,
          system: params.system,
          messages: params.messages as any,
          temperature: params.temperature,
          max_tokens: params.maxTokens || 4096,
          tools: params.tools as any,
          stream: true,
        });

        let fullContent: any[] = [];
        let currentBlock: { type: string; text?: string; id?: string; name?: string; input?: object } | null = null;
        let stopReason: string | null = null;
        let inputTokens = 0;
        let outputTokens = 0;

        // Process streaming response
        for await (const event of response) {
          if (event.type === 'content_block_start') {
            const block = event.content_block;
            if (block.type === 'tool_use') {
              currentBlock = { type: 'tool_use', id: block.id, name: block.name, input: {} };
            } else if (block.type === 'text') {
              currentBlock = { type: 'text', text: '' };
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta' && currentBlock?.type === 'text') {
              const text = event.delta.text;
              currentBlock.text = (currentBlock.text || '') + text;
              onChunk(text);
            } else if (event.delta.type === 'input_json_delta' && currentBlock?.type === 'tool_use') {
              // Accumulate tool use input
              const inputDelta = event.delta.partial_json;
              try {
                const partialInput = JSON.parse(inputDelta);
                currentBlock.input = { ...currentBlock.input, ...partialInput };
              } catch {
                // Incomplete JSON, continue accumulating
                const existingInput = currentBlock.input as Record<string, any> || {};
                try {
                  // Try to merge partial JSON
                  Object.assign(existingInput, JSON.parse('{' + inputDelta + '}'));
                } catch {
                  // Store raw for now
                  (currentBlock as any)._rawInput = ((currentBlock as any)._rawInput || '') + inputDelta;
                }
              }
            }
          } else if (event.type === 'content_block_stop') {
            if (currentBlock) {
              if (currentBlock.type === 'text' && currentBlock.text) {
                fullContent.push({ type: 'text', text: currentBlock.text });
              } else if (currentBlock.type === 'tool_use' && currentBlock.id && currentBlock.name) {
                // Handle raw input if any
                let input = currentBlock.input as Record<string, any>;
                if ((currentBlock as any)._rawInput) {
                  try {
                    input = JSON.parse('{' + (currentBlock as any)._rawInput + '}');
                  } catch {
                    input = {};
                  }
                }
                fullContent.push({
                  type: 'tool_use',
                  id: currentBlock.id,
                  name: currentBlock.name,
                  input: input || {}
                });
              }
              currentBlock = null;
            }
          } else if (event.type === 'message_stop') {
            stopReason = (event as any).stop_reason ?? null;
          } else if (event.type === 'message_delta') {
            const delta = event as any;
            if (delta.usage) {
              outputTokens = delta.usage.output_tokens ?? 0;
            }
          }
        }

        if (onDone) {
          onDone('');
        }

        return {
          content: fullContent.length > 0 ? fullContent : [{ type: 'text', text: '' }],
          stop_reason: stopReason as any,
          usage: {
            inputTokens,
            outputTokens,
          },
        };
      } catch (error) {
        lastError = error;

        if (!shouldRetry(error) || attempt === MAX_RETRY_ATTEMPTS) {
          break;
        }

        await delay(RETRY_BASE_DELAY_MS * attempt);
      }
    }

    throw new AgentError(
      `AI API error: ${formatApiError(lastError)}${buildRetrySuffix(lastError, attempts)}`,
      ErrorCode.AI_API_ERROR,
      {},
      lastError instanceof Error ? lastError : undefined
    );
  }

  async complete(params: CompleteParams): Promise<CompleteResponse> {
    let lastError: unknown;
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const response = await this.client.messages.create({
          model: params.model,
          system: params.system,
          messages: params.messages as any,
          temperature: params.temperature,
          max_tokens: params.maxTokens || 4096,
          tools: params.tools as any,
        });

        return {
          content: response.content.map((block: any) => ({
            type: block.type,
            text: block.text,
            id: block.id,
            name: block.name,
            input: block.input,
          })),
          stop_reason: response.stop_reason as any,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      } catch (error) {
        lastError = error;

        if (!shouldRetry(error) || attempt === MAX_RETRY_ATTEMPTS) {
          break;
        }

        await delay(RETRY_BASE_DELAY_MS * attempt);
      }
    }

    throw new AgentError(
      `AI API error: ${formatApiError(lastError)}${buildRetrySuffix(lastError, attempts)}`,
      ErrorCode.AI_API_ERROR,
      {},
      lastError instanceof Error ? lastError : undefined
    );
  }
}

function shouldRetry(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (typeof status === 'number' && status >= 500) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return message.includes('system error') || message.includes('api_error') || message.includes('internal server error');
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const maybeStatus = (error as { status?: unknown }).status;
  return typeof maybeStatus === 'number' ? maybeStatus : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }
  }

  return String(error ?? 'Unknown error');
}

function formatApiError(error: unknown): string {
  return getErrorMessage(error);
}

function buildRetrySuffix(error: unknown, attempts: number): string {
  const requestId = getRequestId(error);
  if (attempts <= 1) {
    return requestId ? ` (request_id: ${requestId})` : '';
  }

  return requestId ? ` (request_id: ${requestId}, retried ${attempts} times)` : ` (retried ${attempts} times)`;
}

function getRequestId(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const maybeRequestId = (error as { request_id?: unknown; headers?: { get?: (name: string) => string | null } }).request_id;
  if (typeof maybeRequestId === 'string' && maybeRequestId) {
    return maybeRequestId;
  }

  const headers = (error as { headers?: { get?: (name: string) => string | null } }).headers;
  const headerRequestId = headers?.get?.('request-id') ?? headers?.get?.('x-request-id');
  return headerRequestId || undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createAnthropicClient(apiKey: string, baseUrl?: string): AIModelClient {
  return new AnthropicClient(apiKey, baseUrl);
}
