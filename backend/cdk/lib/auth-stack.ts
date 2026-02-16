import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${id}-UserPool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Apple Sign-In IdP — only configured when CDK context values are provided
    const appleServicesId = this.node.tryGetContext("appleServicesId");
    const appleTeamId = this.node.tryGetContext("appleTeamId");
    const appleKeyId = this.node.tryGetContext("appleKeyId");

    let supportedIdPs: cognito.UserPoolClientIdentityProvider[] = [
      cognito.UserPoolClientIdentityProvider.COGNITO,
    ];

    if (appleServicesId && appleTeamId && appleKeyId) {
      const appleProvider = new cognito.UserPoolIdentityProviderApple(
        this,
        "Apple",
        {
          userPool: this.userPool,
          clientId: appleServicesId,
          teamId: appleTeamId,
          keyId: appleKeyId,
          privateKey: "PLACEHOLDER", // Replaced at deploy time via Secrets Manager
          scopes: ["email", "name"],
          attributeMapping: {
            email: cognito.ProviderAttribute.APPLE_EMAIL,
            fullname: cognito.ProviderAttribute.APPLE_NAME,
          },
        },
      );
      supportedIdPs.push(cognito.UserPoolClientIdentityProvider.APPLE);

      // Ensure Apple IdP is created before the client
      this.userPoolClient = new cognito.UserPoolClient(this, "AppClient", {
        userPool: this.userPool,
        userPoolClientName: `${id}-AppClient`,
        generateSecret: false,
        authFlows: {
          userSrp: true,
        },
        supportedIdentityProviders: supportedIdPs,
      });
      this.userPoolClient.node.addDependency(appleProvider);
    } else {
      this.userPoolClient = new cognito.UserPoolClient(this, "AppClient", {
        userPool: this.userPool,
        userPoolClientName: `${id}-AppClient`,
        generateSecret: false,
        authFlows: {
          userSrp: true,
        },
        supportedIdentityProviders: supportedIdPs,
      });
    }

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "CognitoIssuerUrl", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
    });
  }
}
