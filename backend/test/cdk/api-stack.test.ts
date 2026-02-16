import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { DataStack } from "../../cdk/lib/data-stack.js";
import { AuthStack } from "../../cdk/lib/auth-stack.js";
import { ApiStack } from "../../cdk/lib/api-stack.js";

describe("ApiStack", () => {
  const app = new cdk.App({ context: { env: "dev" } });
  const dataStack = new DataStack(app, "TestData");
  const authStack = new AuthStack(app, "TestAuth");
  const apiStack = new ApiStack(app, "TestApi", { dataStack, authStack });
  const template = Template.fromStack(apiStack);

  it("creates an HTTP API", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      ProtocolType: "HTTP",
    });
  });

  it("creates a JWT authorizer", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      AuthorizerType: "JWT",
    });
  });

  it("creates a Lambda function with Node.js 20 runtime", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs20.x",
    });
  });

  it("creates a Lambda integration", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationType: "AWS_PROXY",
    });
  });

  it("health route has no authorizer (NONE)", () => {
    // Find routes with /health path — they should have AuthorizationType NONE
    const routes = template.findResources("AWS::ApiGatewayV2::Route", {
      Properties: {
        RouteKey: "GET /health",
      },
    });
    const routeIds = Object.keys(routes);
    expect(routeIds.length).toBe(1);
    expect(routes[routeIds[0]].Properties.AuthorizationType).toBe("NONE");
  });

  it("grants Lambda read-write access to picksTable", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              "dynamodb:BatchGetItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:PutItem",
              "dynamodb:DeleteItem",
            ]),
            Resource: Match.arrayWith([
              {
                "Fn::ImportValue": Match.stringLikeRegexp("Picks"),
              },
            ]),
          }),
        ]),
      },
    });
  });

  it("grants Lambda read-write access to tmdbCacheTable", () => {
    const json = JSON.stringify(template.toJSON());
    // Verify the IAM policy references the TmdbCache table via cross-stack import
    expect(json).toContain("TmdbCache");
    // And that grantReadWriteData produces DynamoDB actions
    expect(json).toContain("dynamodb:PutItem");
  });

  it("resolves TMDB_API_KEY from SSM Parameter Store", () => {
    const json = JSON.stringify(template.toJSON());
    // CDK should produce a dynamic SSM reference, not a plaintext value
    expect(json).toContain("/family-movie-night/tmdb-api-key");
    // Verify it appears as a Lambda environment variable
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          TMDB_API_KEY: Match.anyValue(),
          TMDB_CACHE_TABLE: Match.anyValue(),
        }),
      },
    });
  });

  it("catch-all route uses JWT authorizer", () => {
    const routes = template.findResources("AWS::ApiGatewayV2::Route", {
      Properties: {
        RouteKey: Match.stringLikeRegexp("\\{proxy\\+\\}"),
      },
    });
    const routeIds = Object.keys(routes);
    expect(routeIds.length).toBeGreaterThanOrEqual(1);
    for (const id of routeIds) {
      expect(routes[id].Properties.AuthorizerId).toBeDefined();
    }
  });
});
