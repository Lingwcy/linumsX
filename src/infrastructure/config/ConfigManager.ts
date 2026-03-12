import fs from 'node:fs';
import path from 'node:path';
import { AppConfigSchema, AppConfig } from './schema.js';

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export class ConfigManager {
  private static envLoaded = false;

  private static loadEnvFiles(): void {
    if (this.envLoaded) {
      return;
    }

    const cwd = process.cwd();
    const envPaths = [path.resolve(cwd, '.env'), path.resolve(cwd, '.env.local')];

    for (const envPath of envPaths) {
      if (!fs.existsSync(envPath)) {
        continue;
      }

      const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }

    this.envLoaded = true;
  }

  static getDefault(): AppConfig {
    return AppConfigSchema.parse({});
  }

  static fromEnv(): AppConfig {
    this.loadEnvFiles();

    // Validate provider with explicit check before type casting
    const provider = process.env.MODEL_PROVIDER;
    if (provider && !['anthropic', 'openai'].includes(provider)) {
      throw new Error(`Invalid MODEL_PROVIDER: ${provider}. Must be 'anthropic' or 'openai'`);
    }

    // Validate numeric values before parsing
    const maxTokens = process.env.MAX_TOKENS;
    if (maxTokens && isNaN(parseInt(maxTokens, 10))) {
      throw new Error(`Invalid MAX_TOKENS: ${maxTokens}. Must be a number.`);
    }

    const temperature = process.env.TEMPERATURE;
    if (temperature && isNaN(parseFloat(temperature))) {
      throw new Error(`Invalid TEMPERATURE: ${temperature}. Must be a number.`);
    }

    const config: AppConfig = {
      model: {
        provider: (provider as 'anthropic' | 'openai') || 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL || process.env.OPENAI_BASE_URL,
        model: process.env.MODEL_ID || 'claude-3-5-sonnet-20241022',
      },
      agent: {
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : 4096,
        temperature: temperature ? parseFloat(temperature) : 0.7,
      },
    };
    return AppConfigSchema.parse(config);
  }

  static load(): AppConfig {
    // Priority: existing process env > .env files > defaults
    return this.fromEnv();
  }
}
