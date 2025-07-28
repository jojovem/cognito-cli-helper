import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const mockPrompt = jest.fn();
const mockSaveConfig = jest.fn();
const mockAdminCreateUser = jest.fn();
const mockForceChangePassword = jest.fn();

jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt }
}));

jest.unstable_mockModule('./services/config.service.js', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    saveConfig: mockSaveConfig,
    readConfig: jest.fn().mockResolvedValue({
      region: 'us-east-1',
      userPoolId: 'test-pool',
      clientId: 'test-client',
      awsProfile: 'default'
    })
  }))
}));

jest.unstable_mockModule('./services/cognito.service.js', () => ({
  CognitoService: {
    create: jest.fn().mockResolvedValue({
      adminCreateUser: mockAdminCreateUser,
      forceChangePassword: mockForceChangePassword
    })
  }
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
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    jest.clearAllMocks();
  });

  describe('force-change-password command', () => {
    it('should force password change for user with provided password', async () => {
      mockForceChangePassword.mockResolvedValueOnce({});
      
      await runCliCommand(['force-change-password', 'test@example.com', 'NewPass123!']);
      
      expect(mockForceChangePassword).toHaveBeenCalledWith('test@example.com', 'NewPass123!');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('is now required to change password'));
    });

    it('should handle other errors', async () => {
      const error = new Error('Some other error');
      mockForceChangePassword.mockRejectedValueOnce(error);
      
      await runCliCommand(['force-change-password', 'test@example.com']);
      
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});