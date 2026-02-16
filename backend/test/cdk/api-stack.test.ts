import { describe, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
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
});
