import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DataStack } from "../../cdk/lib/data-stack.js";

describe("DataStack (prod env)", () => {
  const app = new cdk.App({ context: { env: "prod" } });
  const stack = new DataStack(app, "ProdData");
  const template = Template.fromStack(stack);

  it("all tables have PITR enabled in prod", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    for (const [logicalId, resource] of Object.entries(tables)) {
      const props = resource.Properties as Record<string, unknown>;
      const pitr = props.PointInTimeRecoverySpecification as
        | { PointInTimeRecoveryEnabled: boolean }
        | undefined;
      expect(pitr?.PointInTimeRecoveryEnabled, `${logicalId} should have PITR`).toBe(true);
    }
  });

  it("all tables have RETAIN removal policy in prod", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    for (const [logicalId, resource] of Object.entries(tables)) {
      expect(resource.DeletionPolicy, `${logicalId} should RETAIN`).toBe("Retain");
    }
  });
});
