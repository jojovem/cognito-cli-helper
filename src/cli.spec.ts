import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrompt = jest.fn();
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: mockPrompt,
  },
}));

const mockSaveConfig = jest.fn();
jest.unstable_mockModule('./services/config.service.js', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    saveConfig: mockSaveConfig,
  })),
}));

const mockAdminCreateUser = jest.fn();
jest.unstable_mockModule('./services/cognito.service.js', () => ({
  CognitoService: {
    create: jest.fn().mockResolvedValue({
      adminCreateUser: mockAdminCreateUser,
    }),
  },
}));

let exitSpy: jest.SpyInstance;
let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;
let originalArgv: string[];

beforeEach(() => {
  originalArgv = [...process.argv];
  
  jest.clearAllMocks();
  jest.resetModules();
  
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  
  exitSpy = jest.spyOn(process, 'exit').mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_code?: number) => undefined as never
  );
});

afterEach(() => {
  process.argv = originalArgv;
  
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  exitSpy.mockRestore();
});

describe('CLI commands', () => {
  it('configure → calls ConfigService.saveConfig with prompt answers', async () => {
    const mockAnswers = {
      region: 'eu-west-1',
      userPoolId: 'pool‑id',
      clientId: 'client‑id',
      awsProfile: 'default',
    };
    
    mockPrompt.mockResolvedValueOnce(mockAnswers);
    process.argv = ['node', 'cli.js', 'configure'];
    const cliModule = await import('./cli.js?' + Date.now());
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockSaveConfig).toHaveBeenCalledWith(mockAnswers);
  });

  it('create-user → calls CognitoService.adminCreateUser', async () => {
    process.argv = ['node', 'cli.js', 'create-user', 'new@example.com', 'Temp123!'];
    const cliModule = await import('./cli.js?' + Date.now());
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockAdminCreateUser).toHaveBeenCalledWith('new@example.com', 'Temp123!');
  });
});
