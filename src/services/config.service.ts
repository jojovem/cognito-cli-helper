import envPaths from 'env-paths';
import { promises as fs } from 'fs';
import path from 'path';

const paths = envPaths('cognito-cli-helper', { suffix: '' });

export interface AppConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  awsProfile?: string;
}

export interface StoredCredentials {
  username?: string;
  password?: string;
}

const USERNAME_KEY = 'COGNITO_USERNAME';
const PASSWORD_KEY = 'COGNITO_PASSWORD';

export class ConfigService {
  private readonly configPath = path.join(paths.config, 'config.json');
  private readonly envPath = path.join(paths.config, '.env');

  async saveConfig(config: AppConfig): Promise<void> {
    await fs.mkdir(paths.config, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  async readConfig(): Promise<AppConfig | null> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data) as AppConfig;
    } catch (error) {
      return null;
    }
  }

  /**
   * Persists the Cognito username/password as plain KEY=value lines in a `.env`
   * file alongside `config.json`.
   */
  async saveCredentials(credentials: Required<StoredCredentials>): Promise<void> {
    await fs.mkdir(paths.config, { recursive: true });
    const contents =
      `${USERNAME_KEY}=${credentials.username}\n` + `${PASSWORD_KEY}=${credentials.password}\n`;
    await fs.writeFile(this.envPath, contents);
  }

  /**
   * Reads and parses the `.env` file. Returns an empty object when the file is
   * missing or unparseable, mirroring `readConfig`'s null-on-missing behavior.
   */
  async readCredentials(): Promise<StoredCredentials> {
    let data: string;
    try {
      data = await fs.readFile(this.envPath, 'utf-8');
    } catch (error) {
      return {};
    }

    const parsed: Record<string, string> = {};
    for (const line of data.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      parsed[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }

    const credentials: StoredCredentials = {};
    if (parsed[USERNAME_KEY]) credentials.username = parsed[USERNAME_KEY];
    if (parsed[PASSWORD_KEY]) credentials.password = parsed[PASSWORD_KEY];
    return credentials;
  }
}
