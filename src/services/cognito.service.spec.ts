import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';

import { CognitoService } from './cognito.service.js';
import { AppConfig, ConfigService } from './config.service.js';

jest.mock('cognito-srp-helper');

const cognitoMock = mockClient(CognitoIdentityProviderClient);

describe('CognitoService', () => {
  beforeEach(() => {
    cognitoMock.reset();
    cognitoMock.resetHistory();
    jest.clearAllMocks();

    jest.spyOn(ConfigService.prototype, 'readConfig').mockResolvedValue({
      region: 'eu-west-1',
      userPoolId: 'pool-id',
      clientId: 'client-id',
    } as AppConfig);
  });

  it('adminCreateUser generates a password when none is provided', async () => {
    cognitoMock.on(AdminCreateUserCommand).resolves({});

    const svc = await CognitoService.create();
    await svc.adminCreateUser('user@example.com');

    const call = cognitoMock.call(0);
    expect(call.args[0].input.TemporaryPassword).toBeDefined();
  });

  it('adminCreateUser keeps an explicit temporaryPassword', async () => {
    cognitoMock.on(AdminCreateUserCommand).resolves({});

    const svc = await CognitoService.create();
    await svc.adminCreateUser('foo@bar.com', 'Temp123!');

    expect(cognitoMock.call(0).args[0].input.TemporaryPassword).toBe('Temp123!');
  });

  it('deleteUser sends exactly one AdminDeleteUserCommand', async () => {
    cognitoMock.on(AdminDeleteUserCommand).resolves({});

    const svc = await CognitoService.create();
    await svc.deleteUser('gone@now.com');

    expect(cognitoMock.calls(AdminDeleteUserCommand).length).toBe(1);
  });

  it('login returns tokens without SRP when AuthenticationResult is present', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ AuthenticationResult: { AccessToken: 'tok' } });

    const svc = await CognitoService.create();
    const resp = await svc.login('me@example.com', 'Passw0rd!');

    expect(resp.AuthenticationResult?.AccessToken).toBe('tok');
    expect(cognitoMock.calls().length).toBe(1);
  });

  it('respondToNewPassword performs one challenge + one attribute update', async () => {
    cognitoMock
      .on(RespondToAuthChallengeCommand)
      .resolves({ AuthenticationResult: { AccessToken: 'at' } });
    cognitoMock.on(AdminUpdateUserAttributesCommand).resolves({});

    const svc = await CognitoService.create();
    const resp = await svc.respondToNewPassword('x@y.com', 'NewPass1!', 'sess');

    expect(resp?.AccessToken).toBe('at');
    expect(cognitoMock.commandCalls(RespondToAuthChallengeCommand).length).toBe(1);
    expect(cognitoMock.commandCalls(AdminUpdateUserAttributesCommand).length).toBe(1);
  });

  it('logout issues a GlobalSignOutCommand with the supplied token', async () => {
    cognitoMock.on(GlobalSignOutCommand).resolves({});

    const svc = await CognitoService.create();
    await svc.logout('dummy');

    expect(cognitoMock.call(0).args[0].input.AccessToken).toBe('dummy');
  });
});
