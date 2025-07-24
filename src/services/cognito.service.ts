import {
  AdminCreateUserCommand,
  AdminCreateUserCommandOutput,
  AdminDeleteUserCommand,
  AdminDeleteUserCommandOutput,
  AdminUpdateUserAttributesCommand,
  AdminUpdateUserAttributesCommandOutput,
  AuthFlowType,
  ChallengeNameType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmForgotPasswordCommandOutput,
  DeliveryMediumType,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  GlobalSignOutCommandOutput,
  InitiateAuthCommand,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand
} from '@aws-sdk/client-cognito-identity-provider';
import {
  AuthenticationResultType,
  CodeDeliveryDetailsType
} from '@aws-sdk/client-cognito-identity-provider/dist-types/models/models_0';
import { fromIni } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { createSrpSession, signSrpSession, wrapAuthChallenge, wrapInitiateAuth } from 'cognito-srp-helper';
import { ConfigService } from './config.service';

/**
 * Wrapper around AWS Cognito identity flows.
 */
export class CognitoService {
  private cognitoClient!: CognitoIdentityProviderClient;
  private clientId?: string;
  private userPoolId?: string;
  private configService = new ConfigService();

  constructor() {
  }

  public static async create(): Promise<CognitoService> {
    const service = new CognitoService();
    await service.initialize(); // Wait for the async initialization to complete
    return service;
  }

  /**
   * Initializes the Cognito client with the saved configuration.
   */
  private async initialize() {
    const config = await this.configService.readConfig();
    if (!config || !config.region) {
      console.error(
        'Configuration is missing or incomplete. Please run "cognito-cli configure" and provide a valid AWS Region.'
      );
      process.exit(1);
    }

    let credentialsProvider: AwsCredentialIdentityProvider | undefined;

    // Explicitly create the credential provider if a profile is specified.
    if (config.awsProfile && config.awsProfile !== 'default') {
      console.log(`Using AWS Profile: "${config.awsProfile}"`);
      credentialsProvider = fromIni({ profile: config.awsProfile });
    } else {
      console.log('Using default AWS credential chain (environment variables or default profile).');
    }

    this.cognitoClient = new CognitoIdentityProviderClient({
      region: config.region,
      // Pass the created provider, or let the SDK use its default chain.
      credentials: credentialsProvider
    });

    this.clientId = config.clientId;
    this.userPoolId = config.userPoolId;
  }


  private generateRandomPassword(length: number = 12): string {
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = lowercaseChars + uppercaseChars + numberChars + symbolChars;

    let password = '';
    password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
    password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
    password += numberChars[Math.floor(Math.random() * numberChars.length)];
    password += symbolChars[Math.floor(Math.random() * symbolChars.length)];

    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }

  /**
   * Creates a new user with a temporary password via admin API.
   */
  async adminCreateUser(
    email: string,
    temporaryPassword?: string
  ): Promise<AdminCreateUserCommandOutput> {

    if (temporaryPassword == undefined) {
      temporaryPassword = this.generateRandomPassword();
      console.log(`Generated temporary password: ${temporaryPassword}`);
    }

    return this.cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        TemporaryPassword: temporaryPassword,
        DesiredDeliveryMediums: [DeliveryMediumType.EMAIL],
        UserAttributes: [{ Name: 'email', Value: email }]
      })
    );
  }

  /**
   * Deletes a user by email via admin API.
   */
  async deleteUser(
    email: string
  ): Promise<AdminDeleteUserCommandOutput> {
    return this.cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: email
      })
    );
  }

  /**
   * Anonymizes a user by redacting their email address.
   */
  async anonymizeUser(
    email: string
  ): Promise<AdminUpdateUserAttributesCommandOutput> {
    return this.cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'email',
            Value: `redacted-${Date.now()}@example.com`
          },
          {
            Name: 'email_verified',
            Value: 'false'
          }
        ]
      })
    );
  }

  /**
   * Performs SRP auth and handles PASSWORD_VERIFIER challenge.
   */
  async login(
    email: string,
    password: string
  ): Promise<InitiateAuthCommandOutput> {
    // initialize SRP
    const srpSession = createSrpSession(
      email,
      password,
      this.userPoolId!,
      false
    );
    const initParams = wrapInitiateAuth(srpSession, {
      ClientId: this.clientId,
      AuthFlow: AuthFlowType.USER_SRP_AUTH,
      AuthParameters: { USERNAME: email }
    });

    const initResp = await this.cognitoClient.send(
      new InitiateAuthCommand(initParams)
    );

    // if we get PASSWORD_VERIFIER challenge, respond
    if (initResp.ChallengeName === ChallengeNameType.PASSWORD_VERIFIER) {
      const challengeParams = wrapAuthChallenge(
        signSrpSession(srpSession, initResp),
        {
          ClientId: this.clientId,
          ChallengeName: ChallengeNameType.PASSWORD_VERIFIER,
          ChallengeResponses: { USERNAME: email }
        }
      );
      return this.cognitoClient.send(
        new RespondToAuthChallengeCommand(challengeParams)
      );
    }

    return initResp;
  }

  /**
   * Completes NEW_PASSWORD_REQUIRED challenge and marks email verified.
   */
  async respondToNewPassword(
    email: string,
    newPassword: string,
    session: string
  ): Promise<AuthenticationResultType | undefined> {
    const resp = await this.cognitoClient.send(
      new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword
        }
      })
    );

    // auto-verify email
    await this.cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [{ Name: 'email_verified', Value: 'true' }]
      })
    );

    return resp.AuthenticationResult;
  }

  /**
   * Sends forgot-password code to user.
   */
  async forgotPassword(
    email: string
  ): Promise<CodeDeliveryDetailsType | undefined> {
    const resp = await this.cognitoClient.send(
      new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email
      })
    );
    return resp.CodeDeliveryDetails;
  }

  /**
   * Confirms forgot-password code and sets new password.
   */
  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<ConfirmForgotPasswordCommandOutput> {
    return this.cognitoClient.send(
      new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword
      })
    );
  }

  /**
   * Invalidates the accessToken, logging the user out globally.
   */
  async logout(
    accessToken: string
  ): Promise<GlobalSignOutCommandOutput> {
    return this.cognitoClient.send(
      new GlobalSignOutCommand({
        AccessToken: accessToken
      })
    );
  }
}
