import { describe, expect, it, vi } from 'vitest';
import { AnthropicClient } from '../../src/infrastructure/ai/AnthropicClient.js';

describe('AnthropicClient', () => {
	it('retries transient 500 API errors and eventually succeeds', async () => {
		const client = new AnthropicClient('test-key');
		const create = vi.fn()
			.mockRejectedValueOnce({ status: 500, message: 'system error (1033)', request_id: 'req-1' })
			.mockRejectedValueOnce({ status: 500, message: 'system error (1033)', request_id: 'req-1' })
			.mockResolvedValueOnce({
				content: [{ type: 'text', text: 'ok' }],
				stop_reason: 'end_turn',
			});

		(client as any).client = {
			messages: {
				create,
			},
		};

		const response = await client.complete({
			model: 'test-model',
			messages: [{ role: 'user', content: 'hello' }],
			maxTokens: 128,
		});

		expect(create).toHaveBeenCalledTimes(3);
		expect(response.stop_reason).toBe('end_turn');
		expect(response.content[0]).toMatchObject({ type: 'text', text: 'ok' });
	});

	it('fails immediately for non-retriable API errors', async () => {
		const client = new AnthropicClient('test-key');
		const create = vi.fn().mockRejectedValueOnce({ status: 400, message: 'bad request', request_id: 'req-2' });

		(client as any).client = {
			messages: {
				create,
			},
		};

		await expect(client.complete({
			model: 'test-model',
			messages: [{ role: 'user', content: 'hello' }],
			maxTokens: 128,
		})).rejects.toThrow('bad request');

		expect(create).toHaveBeenCalledTimes(1);
	});
});