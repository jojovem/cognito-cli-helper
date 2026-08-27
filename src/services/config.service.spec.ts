import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mockFs from 'mock-fs';
import fs from 'fs/promises';
import path from 'path';

jest.unstable_mockModule('env-paths', () => ({
  default: () => ({ config: '/tmp/.cfg' }),
}));

const { ConfigService } = await import('./config.service.js');
import type { AppConfig } from './config.service.js';

const CONFIG_DIR = '/tmp/.cfg';

const SAMPLE: AppConfig = {
  region: 'eu-west-1',
  userPoolId: 'pool-id',
  clientId: 'client-id',
  awsProfile: 'default',
};

describe('ConfigService', () => {
  const svc = new ConfigService();

  beforeEach(() => mockFs({}));
  afterEach(() => mockFs.restore());

  it('saves and reads config successfully', async () => {
    await svc.saveConfig(SAMPLE);
    const cfg = await svc.readConfig();
    expect(cfg).toEqual(SAMPLE);
  });

  it('returns null when file is missing', async () => {
    const cfg = await svc.readConfig();
    expect(cfg).toBeNull();
  });

  it('returns null when file contains invalid JSON', async () => {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(path.join(CONFIG_DIR, 'config.json'), '{ bad json');
    const cfg = await svc.readConfig();
    expect(cfg).toBeNull();
  });

  it('saves credentials to .env and reads them back', async () => {
    await svc.saveCredentials({ username: 'user@example.com', password: 's3cr3t=!' });

    const raw = await fs.readFile(path.join(CONFIG_DIR, '.env'), 'utf-8');
    expect(raw).toBe('COGNITO_USERNAME=user@example.com\nCOGNITO_PASSWORD=s3cr3t=!\n');

    const creds = await svc.readCredentials();
    expect(creds).toEqual({ username: 'user@example.com', password: 's3cr3t=!' });
  });

  it('readCredentials returns an empty object when .env is missing', async () => {
    expect(await svc.readCredentials()).toEqual({});
  });

  it('readCredentials returns an empty object when .env is malformed', async () => {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(path.join(CONFIG_DIR, '.env'), 'not a valid env file\n# just a comment\n');
    expect(await svc.readCredentials()).toEqual({});
  });
});
