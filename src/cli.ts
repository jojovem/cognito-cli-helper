#!/usr/bin/env node
import {
  NotAuthorizedException,
  UsernameExistsException,
  UserNotFoundException
} from '@aws-sdk/client-cognito-identity-provider';
import {Command} from 'commander';
import inquirer from 'inquirer';
import {CognitoService} from './services/cognito.service.js';
import {ConfigService} from './services/config.service.js';

const configService = new ConfigService();
const program = new Command();

program
.name('cognito-cli')
.description('A CLI to easily test AWS Cognito user functionalities.')
.version('1.0.0');

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
      message: 'AWS Region (default: eu-west-1):'
    },
    {
      type: 'input',
      name: 'userPoolId',
      message: 'Cognito User Pool ID:'
    },
    {
      type: 'input',
      name: 'clientId',
      message: 'Cognito Client ID:'
    },
    {
      type: 'input',
      name: 'awsProfile',
      message: 'AWS Profile to use (leave blank for default):',
      default: 'default'
    }
  ]);
  await configService.saveConfig(answers);
  console.log('✅ Configuration saved successfully!');
});

async function createService() {
  return await CognitoService.create();
}

program
.command('create-user <email> [temporary-password]')
.description('Create a new Cognito user. A temporary password can be provided, otherwise one will be generated.')
.action(async (email: string, temporaryPassword?: string) => {
  try {
    // Instantiate service inside the action to ensure config is loaded
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
.command('login <email>')
.description('Log in a Cognito user and retrieve authentication tokens.')
.action(async (email: string) => {
  try {
    const cognitoService = await CognitoService.create();
    const {password} = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: 'Enter password:',
        mask: '*'
      }
    ]);

    console.log(`Attempting to log in as ${email}...`);
    const response = await cognitoService.login(email, password.trim());

    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED' && response.Session) {
      console.log('A new password is required.');
      const {newPassword} = await inquirer.prompt([
        {
          type: 'password',
          name: 'newPassword',
          message: 'Enter new password:',
          mask: '*'
        }
      ]);
      const challengeResponse = await cognitoService.respondToNewPassword(
        email,
        newPassword.trim(),
        response.Session
      );
      console.log('✅ New password set successfully. You are now logged in.');
      console.log('Tokens:', JSON.stringify(challengeResponse, null, 2));

    } else if (response.AuthenticationResult) {
      console.log('✅ Login successful!');
      console.log('Tokens:', JSON.stringify(response.AuthenticationResult, null, 2));
    } else {
      console.error('❌ Login failed. Unexpected response:', response);
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
