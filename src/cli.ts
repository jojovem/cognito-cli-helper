#!/usr/bin/env node
import {
  NotAuthorizedException,
  UsernameExistsException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import clipboard from 'clipboardy';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { resolveCredentials, runLoginFlow } from './login-flow.js';
import { CognitoService } from './services/cognito.service.js';
import { ConfigService } from './services/config.service.js';
import pkg from '../package.json';

const configService = new ConfigService();
const program = new Command();

program
  .name('cognito-cli')
  .description('A CLI to easily test AWS Cognito user functionalities.')
  .version(pkg.version);

program
  .command('configure')
  .description('Configure the AWS Cognito CLI credentials (one-time setup).')
  .action(async () => {
    const configService = new ConfigService();
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'region',
        default: 'eu-west-1',
        message: 'AWS Region (default: eu-west-1):',
      },
      {
        type: 'input',
        name: 'userPoolId',
        message: 'Cognito User Pool ID:',
      },
      {
        type: 'input',
        name: 'clientId',
        message: 'Cognito Client ID:',
      },
      {
        type: 'input',
        name: 'awsProfile',
        message: 'AWS Profile to use (leave blank for default):',
        default: 'default',
      },
      {
        type: 'input',
        name: 'username',
        message: 'Cognito username (email):',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Cognito password:',
        mask: '*',
      },
    ]);
    const { username, password, ...config } = answers;
    await configService.saveConfig(config);
    await configService.saveCredentials({ username, password });
    console.log('✅ Configuration saved successfully!');
  });

async function createService() {
  return await CognitoService.create();
}

program
  .command('create-user <email> [temporary-password]')
  .description(
    'Create a new Cognito user. A temporary password can be provided, otherwise one will be generated.'
  )
  .action(async (email: string, temporaryPassword?: string) => {
    try {
      const cognitoService = await createService();
      console.log(`Creating user "${email}"...`);
      await cognitoService.adminCreateUser(email, temporaryPassword);
      console.log(`✅ User "${email}" created successfully.`);
      console.log('User will be required to set a new password on first login.');
    } catch (err: any) {
      if (err instanceof UsernameExistsException) {
        console.error(`❌ Error: User "${email}" already exists.`);
      } else {
        console.error('❌ An unexpected error occurred during user creation:', err.message);
      }
      process.exit(1);
    }
  });

program
  .command('login [email]')
  .description('Log in a Cognito user and retrieve authentication tokens.')
  .action(async (email?: string) => {
    try {
      const { email: resolvedEmail, password: envPassword } = await resolveCredentials(
        configService,
        email
      );

      if (!resolvedEmail) {
        console.error(
          '❌ No email provided. Run "cognito-cli configure" or pass the email: cognito-cli login <email>'
        );
        process.exit(1);
        return;
      }

      const cognitoService = await CognitoService.create();

      let password = envPassword;
      if (!password) {
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Enter password:',
            mask: '*',
          },
        ]);
        password = answers.password;
      }

      console.log(`Attempting to log in as ${resolvedEmail}...`);
      const { tokens, newPasswordSet } = await runLoginFlow(
        cognitoService,
        resolvedEmail,
        password!
      );

      if (newPasswordSet) {
        console.log('✅ New password set successfully. You are now logged in.');
        console.log('Tokens:', JSON.stringify(tokens, null, 2));
      } else if (tokens) {
        console.log('✅ Login successful!');
        console.log('Tokens:', JSON.stringify(tokens, null, 2));
      } else {
        console.error('❌ Login failed. Unexpected response.');
        process.exit(1);
      }
    } catch (err: any) {
      if (err instanceof NotAuthorizedException) {
        console.error('❌ Login failed: Not authorized. Please check email and password.');
      } else {
        console.error('❌ An unexpected error occurred during login:', err.message);
      }
      process.exit(1);
    }
  });

program
  .command('get-id-token [email] [password]')
  .description('Log in and copy the resulting IdToken to the system clipboard.')
  .action(async (email?: string, password?: string) => {
    const { email: resolvedEmail, password: resolvedPassword } = await resolveCredentials(
      configService,
      email,
      password
    );

    if (!resolvedEmail || !resolvedPassword) {
      console.error(
        '❌ No credentials found. Pass the email and password: cognito-cli get-id-token <email> <password>'
      );
      process.exit(1);
      return;
    }

    try {
      const cognitoService = await CognitoService.create();
      console.log(`Attempting to log in as ${resolvedEmail}...`);
      const { tokens } = await runLoginFlow(cognitoService, resolvedEmail, resolvedPassword);

      if (!tokens?.IdToken) {
        console.error('❌ Login failed. No IdToken was returned.');
        process.exit(1);
        return;
      }

      await clipboard.write(tokens.IdToken);
      console.log('✅ IdToken copied to clipboard.');
    } catch (err: any) {
      if (err instanceof NotAuthorizedException) {
        console.error('❌ Login failed: Not authorized. Please check email and password.');
      } else {
        console.error('❌ An unexpected error occurred during login:', err.message);
      }
      process.exit(1);
    }
  });

program
  .command('delete-user <email>')
  .description('Delete a Cognito user.')
  .action(async (email: string) => {
    try {
      const cognitoService = await createService();
      console.log(`Deleting user "${email}"...`);
      await cognitoService.deleteUser(email);
      console.log(`✅ User "${email}" deleted successfully.`);
    } catch (err: any) {
      if (err instanceof UserNotFoundException) {
        console.error(`❌ Error: User "${email}" not found.`);
      } else {
        console.error('❌ An unexpected error occurred during user deletion:', err.message);
      }
      process.exit(1);
    }
  });

program
  .command('force-change-password <email> [temporary-password]')
  .description(
    'Force a user to change their password on next login by setting a temporary password.'
  )
  .action(async (email: string, temporaryPassword?: string) => {
    try {
      const cognitoService = await createService();
      console.log(`Setting user "${email}" to FORCE_CHANGE_PASSWORD status...`);
      await cognitoService.forceChangePassword(email, temporaryPassword);
      console.log(`✅ User "${email}" is now required to change password on next login.`);
      console.log(
        'The user will need to use the temporary password to log in and set a new permanent password.'
      );
    } catch (err: any) {
      if (err instanceof UserNotFoundException) {
        console.error(`❌ Error: User "${email}" not found.`);
      } else {
        console.error(
          '❌ An unexpected error occurred while setting force change password:',
          err.message
        );
      }
      process.exit(1);
    }
  });

program
  .command('invalidate-token <accessToken>')
  .description('Invalidates an accessToken.')
  .action(async (accessToken: string) => {
    try {
      const cognitoService = await createService();
      console.log(`Revoking access for accessToken "${accessToken.substring(0, 10)}..."`);
      await cognitoService.logout(accessToken);
      console.log(`✅ Token invalidated successfully.`);
    } catch (err: any) {
      console.error('❌ An unexpected error occurred during token invalidation:', err.message);
    }
    process.exit(1);
  });

program.parse(process.argv);
