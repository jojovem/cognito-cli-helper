import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';

let exitSpy: jest.SpyInstance;

beforeEach(() => {
  jest.resetModules();

  jest.spyOn(console, 'log').mockImplementation(() => {
  });
  jest.spyOn(console, 'error').mockImplementation(() => {
  });

  exitSpy = jest.spyOn(process, 'exit').mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_code?: number) => undefined as never
  );
});

afterEach(() => {
  (console.log as jest.Mock).mockRestore?.();
  (console.error as jest.Mock).mockRestore?.();
  exitSpy.mockRestore();
});

const mockAnswers = {
  region: 'eu-west-1',
  userPoolId: 'pool‑id',
  clientId: 'client‑id',
  awsProfile: 'default'
};
jest.unstable_mockModule('inquirer', () => ({
  __esModule: true,
  default: {prompt: jest.fn(() => Promise.resolve(mockAnswers))}
}));

const saveConfig = jest.fn(() => Promise.resolve());

jest.unstable_mockModule('./services/config.service.js', () => ({
  __esModule: true,
  ConfigService: jest.fn().mockImplementation(() => ({saveConfig}))
}));

const adminCreateUser = jest.fn(() => Promise.resolve());

jest.unstable_mockModule('./services/cognito.service.js', () => ({
  __esModule: true,
  CognitoService: {
    create: jest.fn(() =>
      Promise.resolve({
        adminCreateUser
      })
    )
  }
}));

const tick = () => new Promise(process.nextTick);

describe('CLI commands', () => {
  it('configure → calls ConfigService.saveConfig with prompt answers', async () => {
    process.argv = ['node', 'cli.js', 'configure'];
    await import('./cli.js');
    await tick();

    expect(saveConfig).toHaveBeenCalledWith(mockAnswers);
  });

  it('create-user → calls CognitoService.adminCreateUser', async () => {
    process.argv = [
      'node',
      'cli.js',
      'create-user',
      'new@example.com',
      'Temp123!'
    ];
    await import('./cli.js');
    await tick();

    expect(adminCreateUser).toHaveBeenCalledWith(
      'new@example.com',
      'Temp123!'
    );
  });
});
