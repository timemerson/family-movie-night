import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { Construct } from "constructs";
import type { DataStack } from "./data-stack.js";
import type { AuthStack } from "./auth-stack.js";

export interface ApiStackProps extends cdk.StackProps {
  dataStack: DataStack;
  authStack: AuthStack;
}

export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { dataStack, authStack } = props;

    // TMDB API key stored in SSM Parameter Store (must be created before first deploy)
    const tmdbApiKeyParam = ssm.StringParameter.fromStringParameterName(
      this,
      "TmdbApiKeyParam",
      "/family-movie-night/tmdb-api-key",
    );

    // Lambda function
    this.handler = new lambda.Function(this, "Handler", {
      functionName: `${id}-Handler`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist"),
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      environment: {
        USERS_TABLE: dataStack.usersTable.tableName,
        GROUPS_TABLE: dataStack.groupsTable.tableName,
        GROUP_MEMBERSHIPS_TABLE: dataStack.groupMembershipsTable.tableName,
        PREFERENCES_TABLE: dataStack.preferencesTable.tableName,
        INVITES_TABLE: dataStack.invitesTable.tableName,
        ROUNDS_TABLE: dataStack.roundsTable.tableName,
        SUGGESTIONS_TABLE: dataStack.suggestionsTable.tableName,
        VOTES_TABLE: dataStack.votesTable.tableName,
        PICKS_TABLE: dataStack.picksTable.tableName,
        RATINGS_TABLE: dataStack.ratingsTable.tableName,
        TMDB_CACHE_TABLE: dataStack.tmdbCacheTable.tableName,
        TMDB_API_KEY: tmdbApiKeyParam.stringValue,
      },
    });

    // Grant DynamoDB access
    dataStack.usersTable.grantReadWriteData(this.handler);
    dataStack.groupsTable.grantReadWriteData(this.handler);
    dataStack.groupMembershipsTable.grantReadWriteData(this.handler);
    dataStack.invitesTable.grantReadWriteData(this.handler);
    dataStack.preferencesTable.grantReadWriteData(this.handler);
    dataStack.picksTable.grantReadWriteData(this.handler);
    dataStack.tmdbCacheTable.grantReadWriteData(this.handler);

    // JWT Authorizer using Cognito
    const issuerUrl = `https://cognito-idp.${this.region}.amazonaws.com/${authStack.userPool.userPoolId}`;
    const jwtAuthorizer = new apigwv2Authorizers.HttpJwtAuthorizer(
      "JwtAuthorizer",
      issuerUrl,
      {
        jwtAudience: [authStack.userPoolClient.userPoolClientId],
      },
    );

    // HTTP API
    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `${id}-HttpApi`,
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ["Authorization", "Content-Type"],
      },
      defaultAuthorizer: jwtAuthorizer,
    });

    const lambdaIntegration =
      new apigwv2Integrations.HttpLambdaIntegration(
        "LambdaIntegration",
        this.handler,
      );

    // Health route — no auth
    this.httpApi.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
      authorizer: new apigwv2.HttpNoneAuthorizer(),
    });

    // Default route — JWT auth
    this.httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: this.httpApi.apiEndpoint,
    });
  }
}
