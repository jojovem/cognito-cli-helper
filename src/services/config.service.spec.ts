import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mockFs from 'mock-fs';

jest.mock('env-paths', () => () => ({ config: '/tmp/.cfg' }));

import { ConfigService, AppConfig } from './config.service.js';
import fs from 'fs/promises';
import path from 'path';

const SAMPLE: AppConfig = {
  region: 'eu-west-1',
  userPoolId: 'pool‑id',
  clientId: 'client‑id',
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
    await fs.mkdir('/tmp/.cfg', { recursive: true });
    await fs.writeFile(path.join('/tmp/.cfg', 'config.json'), '{ bad json');
    const cfg = await svc.readConfig();
    expect(cfg).toBeNull();
  });
});
