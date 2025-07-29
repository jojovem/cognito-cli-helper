import {
  AdminCreateUserCommand,
  AdminCreateUserCommandOutput,
  AdminDeleteUserCommand,
  AdminDeleteUserCommandOutput,
  AdminSetUserPasswordCommand,
  AdminSetUserPasswordCommandOutput,
  AdminUpdateUserAttributesCommand,
  AuthFlowType,
  ChallengeNameType,
  CognitoIdentityProviderClient,
  DeliveryMediumType,
  GlobalSignOutCommand,
  GlobalSignOutCommandOutput,
  InitiateAuthCommand,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider/dist-types/models/models_0.js';
import { fromIni } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import {
  createSrpSession,
  signSrpSession,
  wrapAuthChallenge,
  wrapInitiateAuth,
} from 'cognito-srp-helper';
import { generateRandomPassword } from '../utils.js';
import { ConfigService } from './config.service.js';

/**
 * Wrapper around AWS Cognito identity flows.
 */
export class CognitoService {
  private cognitoClient!: CognitoIdentityProviderClient;
  private clientId?: string;
  private userPoolId?: string;
  private readonly configService = new ConfigService();

  private constructor(configService: ConfigService) {
    this.configService = configService;
  }

  public static async create(configService?: ConfigService) {
    const service = new CognitoService(configService || new ConfigService());
    await service.initialize();
    return service;
  }

  /**
   * Initializes the Cognito client with the saved configuration.
   */
  private async initialize() {
    const config = await this.configService.readConfig();
    if (!config?.region) {
      console.error(
        'Configuration is missing or incomplete. Please run "cognito-cli configure" and provide a valid AWS Region.'
      );
      process.exit(1);
    }

    let credentialsProvider: AwsCredentialIdentityProvider | undefined;

    if (config.awsProfile && config.awsProfile !== 'default') {
      credentialsProvider = fromIni({ profile: config.awsProfile });
    }

    this.cognitoClient = new CognitoIdentityProviderClient({
      region: config.region,
      credentials: credentialsProvider,
    });

    this.clientId = config.clientId;
    this.userPoolId = config.userPoolId;
  }

  /**
   * Creates a new user with a temporary password via admin API.
   */
  async adminCreateUser(
    email: string,
    temporaryPassword?: string
  ): Promise<AdminCreateUserCommandOutput> {
    if (temporaryPassword == undefined) {
      temporaryPassword = generateRandomPassword();
      console.log(`Generated temporary password: ${temporaryPassword}`);
    }

    return this.cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        TemporaryPassword: temporaryPassword,
        DesiredDeliveryMediums: [DeliveryMediumType.EMAIL],
        UserAttributes: [{ Name: 'email', Value: email }],
      })
    );
  }

  /**
   * Deletes a user by email via admin API.
   */
  async deleteUser(email: string): Promise<AdminDeleteUserCommandOutput> {
    return this.cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      })
    );
  }

  /**
   * Performs SRP auth and handles PASSWORD_VERIFIER challenge.
   */
  async login(email: string, password: string): Promise<InitiateAuthCommandOutput> {
    // initialize SRP
    const srpSession = createSrpSession(email, password, this.userPoolId!, false);
    const initParams = wrapInitiateAuth(srpSession, {
      ClientId: this.clientId,
      AuthFlow: AuthFlowType.USER_SRP_AUTH,
      AuthParameters: { USERNAME: email },
    });

    const initResp = await this.cognitoClient.send(new InitiateAuthCommand(initParams));

    // if we get PASSWORD_VERIFIER challenge, respond
    if (initResp.ChallengeName === ChallengeNameType.PASSWORD_VERIFIER) {
      const challengeParams = wrapAuthChallenge(signSrpSession(srpSession, initResp), {
        ClientId: this.clientId,
        ChallengeName: ChallengeNameType.PASSWORD_VERIFIER,
        ChallengeResponses: { USERNAME: email },
      });
      return this.cognitoClient.send(new RespondToAuthChallengeCommand(challengeParams));
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
          NEW_PASSWORD: newPassword,
        },
      })
    );

    await this.cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [{ Name: 'email_verified', Value: 'true' }],
      })
    );

    return resp.AuthenticationResult;
  }

  /**
   * Invalidates the accessToken, logging the user out globally.
   */
  async logout(accessToken: string): Promise<GlobalSignOutCommandOutput> {
    return this.cognitoClient.send(
      new GlobalSignOutCommand({
        AccessToken: accessToken,
      })
    );
  }

  /**
   * Forces a user to change their password on next login by setting a temporary password.
   */
  async forceChangePassword(
    email: string,
    temporaryPassword?: string
  ): Promise<AdminSetUserPasswordCommandOutput> {
    if (temporaryPassword == undefined) {
      temporaryPassword = generateRandomPassword();
      console.log(`Generated temporary password: ${temporaryPassword}`);
    }

    return this.cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        Password: temporaryPassword,
        Permanent: false, // This forces the user to change password on next login
      })
    );
  }
}
