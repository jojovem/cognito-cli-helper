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

export class ConfigService {
  private configPath = path.join(paths.config, 'config.json');

  async saveConfig(config: AppConfig): Promise<void> {
    await fs.mkdir(paths.config, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  async readConfig(): Promise<AppConfig | null> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data) as AppConfig;
    } catch (error) {
      // If the file doesn't exist or is invalid, return null
      return null;
    }
  }
}
