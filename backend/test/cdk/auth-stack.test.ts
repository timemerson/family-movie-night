import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AuthStack } from "../../cdk/lib/auth-stack.js";

describe("AuthStack", () => {
  const app = new cdk.App();
  const stack = new AuthStack(app, "TestAuth");
  const template = Template.fromStack(stack);

  it("creates a Cognito UserPool with correct password policy", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: false,
          RequireNumbers: true,
          RequireSymbols: false,
          RequireUppercase: false,
        },
      },
    });
  });

  it("creates an AppClient with no secret", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
    });
  });

  it("exports UserPoolId", () => {
    template.hasOutput("UserPoolId", {});
  });

  it("exports UserPoolClientId", () => {
    template.hasOutput("UserPoolClientId", {});
  });

  it("exports CognitoIssuerUrl", () => {
    template.hasOutput("CognitoIssuerUrl", {});
  });
});
