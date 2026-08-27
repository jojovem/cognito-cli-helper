import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

type AnyAsyncFn = (...args: any[]) => Promise<any>;

const mockPrompt = jest.fn<AnyAsyncFn>();
const mockSaveConfig = jest.fn<AnyAsyncFn>();
const mockSaveCredentials = jest.fn<AnyAsyncFn>();
const mockReadCredentials = jest.fn<() => Promise<{ username?: string; password?: string }>>();
const mockAdminCreateUser = jest.fn<AnyAsyncFn>();
const mockForceChangePassword = jest.fn<AnyAsyncFn>();
const mockLogin = jest.fn<AnyAsyncFn>();
const mockRespondToNewPassword = jest.fn<AnyAsyncFn>();
const mockClipboardWrite = jest.fn<AnyAsyncFn>();

jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

jest.unstable_mockModule('clipboardy', () => ({
  default: { write: mockClipboardWrite },
}));

jest.unstable_mockModule('./services/config.service.js', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    saveConfig: mockSaveConfig,
    saveCredentials: mockSaveCredentials,
    readCredentials: mockReadCredentials,
    readConfig: jest.fn<AnyAsyncFn>().mockResolvedValue({
      region: 'us-east-1',
      userPoolId: 'test-pool',
      clientId: 'test-client',
      awsProfile: 'default',
    }),
  })),
}));

jest.unstable_mockModule('./services/cognito.service.js', () => ({
  CognitoService: {
    create: jest.fn<AnyAsyncFn>().mockResolvedValue({
      adminCreateUser: mockAdminCreateUser,
      forceChangePassword: mockForceChangePassword,
      login: mockLogin,
      respondToNewPassword: mockRespondToNewPassword,
    }),
  },
}));

describe('CLI', () => {
  let originalArgv: string[];
  let originalExit: any;
  let originalConsole: any;

  const loadCli = async () => {
    jest.resetModules();
    const modulePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.ts');
    return import(modulePath);
  };

  const runCliCommand = async (args: string[]) => {
    process.argv = ['node', 'cli.js', ...args];
    await loadCli();
    return;
  };

  beforeEach(() => {
    originalArgv = [...process.argv];

    originalExit = process.exit;
    process.exit = jest.fn() as any;

    originalConsole = { ...console };
    console.log = jest.fn();
    console.error = jest.fn();

    mockReadCredentials.mockResolvedValue({});
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    Object.assign(console, originalConsole);
    jest.clearAllMocks();
  });

  describe('force-change-password command', () => {
    it('should force password change for user with provided password', async () => {
      mockForceChangePassword.mockResolvedValueOnce({});

      await runCliCommand(['force-change-password', 'test@example.com', 'NewPass123!']);

      expect(mockForceChangePassword).toHaveBeenCalledWith('test@example.com', 'NewPass123!');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('is now required to change password')
      );
    });

    it('should handle other errors', async () => {
      const error = new Error('Some other error');
      mockForceChangePassword.mockRejectedValueOnce(error);

      await runCliCommand(['force-change-password', 'test@example.com']);

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('configure command', () => {
    it('persists config.json and writes credentials to .env', async () => {
      mockPrompt.mockResolvedValueOnce({
        region: 'eu-west-1',
        userPoolId: 'pool',
        clientId: 'client',
        awsProfile: 'default',
        username: 'user@example.com',
        password: 'S3cret!',
      });

      await runCliCommand(['configure']);

      expect(mockSaveConfig).toHaveBeenCalledWith({
        region: 'eu-west-1',
        userPoolId: 'pool',
        clientId: 'client',
        awsProfile: 'default',
      });
      expect(mockSaveCredentials).toHaveBeenCalledWith({
        username: 'user@example.com',
        password: 'S3cret!',
      });
      expect(console.log).toHaveBeenCalledWith('✅ Configuration saved successfully!');
    });
  });

  describe('login command', () => {
    it('uses .env email and password without prompting', async () => {
      mockReadCredentials.mockResolvedValueOnce({
        username: 'env@example.com',
        password: 'EnvPass1!',
      });
      mockLogin.mockResolvedValueOnce({
        AuthenticationResult: { IdToken: 'id', AccessToken: 'ac' },
      });

      await runCliCommand(['login']);

      expect(mockLogin).toHaveBeenCalledWith('env@example.com', 'EnvPass1!');
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ Login successful!');
    });

    it('lets a CLI email override the .env value while keeping the .env password', async () => {
      mockReadCredentials.mockResolvedValueOnce({
        username: 'env@example.com',
        password: 'EnvPass1!',
      });
      mockLogin.mockResolvedValueOnce({ AuthenticationResult: { IdToken: 'id' } });

      await runCliCommand(['login', 'cli@example.com']);

      expect(mockLogin).toHaveBeenCalledWith('cli@example.com', 'EnvPass1!');
    });

    it('prompts for the password when it is not in .env', async () => {
      mockReadCredentials.mockResolvedValueOnce({ username: 'env@example.com' });
      mockPrompt.mockResolvedValueOnce({ password: 'Typed1!' });
      mockLogin.mockResolvedValueOnce({ AuthenticationResult: { IdToken: 'id' } });

      await runCliCommand(['login']);

      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledWith('env@example.com', 'Typed1!');
    });

    it('still supports the classic flow: CLI email plus an interactive password prompt', async () => {
      mockReadCredentials.mockResolvedValueOnce({});
      mockPrompt.mockResolvedValueOnce({ password: 'Typed1!' });
      mockLogin.mockResolvedValueOnce({ AuthenticationResult: { IdToken: 'id' } });

      await runCliCommand(['login', 'cli@example.com']);

      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledWith('cli@example.com', 'Typed1!');
    });

    it('exits non-zero when no email is available anywhere', async () => {
      mockReadCredentials.mockResolvedValueOnce({});

      await runCliCommand(['login']);

      expect(mockLogin).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('cognito-cli configure'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('get-id-token command', () => {
    it('copies the IdToken to the clipboard and confirms without printing it', async () => {
      mockReadCredentials.mockResolvedValueOnce({
        username: 'env@example.com',
        password: 'EnvPass1!',
      });
      mockLogin.mockResolvedValueOnce({ AuthenticationResult: { IdToken: 'THE_ID_TOKEN' } });

      await runCliCommand(['get-id-token']);

      expect(mockClipboardWrite).toHaveBeenCalledWith('THE_ID_TOKEN');
      expect(console.log).toHaveBeenCalledWith('✅ IdToken copied to clipboard.');
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('THE_ID_TOKEN'));
    });

    it('lets CLI args override .env values', async () => {
      mockReadCredentials.mockResolvedValueOnce({
        username: 'env@example.com',
        password: 'EnvPass1!',
      });
      mockLogin.mockResolvedValueOnce({ AuthenticationResult: { IdToken: 'tok' } });

      await runCliCommand(['get-id-token', 'cli@example.com', 'CliPass1!']);

      expect(mockLogin).toHaveBeenCalledWith('cli@example.com', 'CliPass1!');
      expect(mockClipboardWrite).toHaveBeenCalledWith('tok');
    });

    it('prints guidance and exits non-zero when no credentials are available', async () => {
      mockReadCredentials.mockResolvedValueOnce({});

      await runCliCommand(['get-id-token']);

      expect(mockLogin).not.toHaveBeenCalled();
      expect(mockClipboardWrite).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No credentials found. Pass the email and password')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('handles the NEW_PASSWORD_REQUIRED challenge before copying the IdToken', async () => {
      mockReadCredentials.mockResolvedValueOnce({
        username: 'env@example.com',
        password: 'EnvPass1!',
      });
      mockLogin.mockResolvedValueOnce({ ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: 'sess' });
      mockPrompt.mockResolvedValueOnce({ newPassword: 'NewPass1!' });
      mockRespondToNewPassword.mockResolvedValueOnce({ IdToken: 'CHALLENGE_ID_TOKEN' });

      await runCliCommand(['get-id-token']);

      expect(mockRespondToNewPassword).toHaveBeenCalledWith('env@example.com', 'NewPass1!', 'sess');
      expect(mockClipboardWrite).toHaveBeenCalledWith('CHALLENGE_ID_TOKEN');
      expect(console.log).toHaveBeenCalledWith('✅ IdToken copied to clipboard.');
    });
  });
});
