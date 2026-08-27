import inquirer from 'inquirer';
import type { CognitoService } from './services/cognito.service.js';
import type { ConfigService } from './services/config.service.js';

export interface ResolvedCredentials {
  email?: string;
  password?: string;
}

/**
 * Resolves the email/password used by `login` and `get-id-token`.
 * CLI arguments take precedence over the values stored in `.env`.
 */
export async function resolveCredentials(
  configService: ConfigService,
  cliEmail?: string,
  cliPassword?: string
): Promise<ResolvedCredentials> {
  const stored = await configService.readCredentials();
  return {
    email: cliEmail ?? stored.username,
    password: cliPassword ?? stored.password,
  };
}

export interface LoginFlowResult {
  tokens: Awaited<ReturnType<CognitoService['respondToNewPassword']>>;
  newPasswordSet: boolean;
}

/**
 * Runs the shared SRP login flow, including the NEW_PASSWORD_REQUIRED challenge
 * path (prompting for a new password when Cognito demands it).
 */
export async function runLoginFlow(
  cognitoService: CognitoService,
  email: string,
  password: string
): Promise<LoginFlowResult> {
  const response = await cognitoService.login(email, password.trim());

  if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED' && response.Session) {
    console.log('A new password is required.');
    const { newPassword } = await inquirer.prompt([
      {
        type: 'password',
        name: 'newPassword',
        message: 'Enter new password:',
        mask: '*',
      },
    ]);
    const tokens = await cognitoService.respondToNewPassword(
      email,
      newPassword.trim(),
      response.Session
    );
    return { tokens, newPasswordSet: true };
  }

  return { tokens: response.AuthenticationResult, newPasswordSet: false };
}
