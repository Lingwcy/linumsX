import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
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
  private static userConfig: AppConfig | null = null;
  private static configPath: string | null = null;

  private static getConfigFilePath(): string {
    if (!this.configPath) {
      const userDataPath = app.getPath('userData');
      this.configPath = path.join(userDataPath, 'config.json');
    }
    return this.configPath;
  }

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

    // Validate numeric values before parsing
    const maxTokens = process.env.MAX_TOKENS;
    if (maxTokens && isNaN(parseInt(maxTokens, 10))) {
      throw new Error(`Invalid MAX_TOKENS: ${maxTokens}. Must be a number.`);
    }

    const temperature = process.env.TEMPERATURE;
    if (temperature && isNaN(parseFloat(temperature))) {
      throw new Error(`Invalid TEMPERATURE: ${temperature}. Must be a number.`);
    }

    const provider = process.env.MODEL_PROVIDER || 'anthropic';
    const config: AppConfig = {
      model: {
        provider,
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL || process.env.OPENAI_BASE_URL || (provider === 'minimax' ? 'https://api.minimax.chat' : undefined),
        model: process.env.MODEL_ID || 'claude-3-5-sonnet-20241022',
      },
      agent: {
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : 4096,
        temperature: temperature ? parseFloat(temperature) : 0.7,
      },
    };
    return AppConfigSchema.parse(config);
  }

  static loadUserConfig(): AppConfig {
    if (this.userConfig) {
      return this.userConfig;
    }

    try {
      const configPath = this.getConfigFilePath();
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(content);
        this.userConfig = AppConfigSchema.parse(parsed);
        return this.userConfig;
      }
    } catch (error) {
      console.error('Failed to load user config:', error);
    }

    return this.getDefault();
  }

  static saveUserConfig(config: AppConfig): void {
    try {
      const normalizedConfig = AppConfigSchema.parse(config);
      const configPath = this.getConfigFilePath();
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(normalizedConfig, null, 2), 'utf8');
      this.userConfig = normalizedConfig;
    } catch (error) {
      console.error('Failed to save user config:', error);
      throw error;
    }
  }

  static load(): AppConfig {
    // Priority: user config > env > defaults
    const userConfig = this.loadUserConfig();
    const envConfig = this.fromEnv();

    return AppConfigSchema.parse({
      ...envConfig,
      ...userConfig,
      model: {
        ...envConfig.model,
        ...userConfig.model,
      },
      agent: {
        ...envConfig.agent,
        ...userConfig.agent,
      },
    });
  }
}
