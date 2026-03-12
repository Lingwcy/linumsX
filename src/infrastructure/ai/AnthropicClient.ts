// src/infrastructure/ai/AnthropicClient.ts
import Anthropic from '@anthropic-ai/sdk';
import { AIModelClient, CompleteParams, CompleteResponse } from './types.js';
import { AgentError, ErrorCode } from '../../shared/errors/AgentError.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

export class AnthropicClient implements AIModelClient {
  private client: Anthropic;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseUrl,
    });
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
