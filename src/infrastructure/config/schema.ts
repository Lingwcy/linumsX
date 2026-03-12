import { z } from 'zod';

export const ModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']).default('anthropic'),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().default('claude-3-5-sonnet-20241022'),
});

export const AgentConfigSchema = z.object({
  maxTokens: z.number().default(4096),
  temperature: z.number().default(0.7),
});

export const AppConfigSchema = z.object({
  model: ModelConfigSchema.optional().default({
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
  }),
  agent: AgentConfigSchema.optional().default({
    maxTokens: 4096,
    temperature: 0.7,
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
