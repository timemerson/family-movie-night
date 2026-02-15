import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DataStack } from "../../cdk/lib/data-stack.js";

describe("DataStack", () => {
  const app = new cdk.App();
  const stack = new DataStack(app, "TestData");
  const template = Template.fromStack(stack);

  it("creates 11 DynamoDB tables", () => {
    template.resourceCountIs("AWS::DynamoDB::Table", 11);
  });

  it("all tables use PAY_PER_REQUEST billing", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    for (const [, resource] of Object.entries(tables)) {
      const props = resource.Properties as Record<string, unknown>;
      expect(props.BillingMode).toBe("PAY_PER_REQUEST");
    }
  });

  it("Users table has email-index and parent-index GSIs", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "TestData-Users",
      GlobalSecondaryIndexes: [
        {
          IndexName: "email-index",
          KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        },
        {
          IndexName: "parent-index",
          KeySchema: [{ AttributeName: "parent_user_id", KeyType: "HASH" }],
        },
      ],
    });
  });

  it("GroupMemberships table has composite key (group_id, user_id)", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "TestData-GroupMemberships",
      KeySchema: [
        { AttributeName: "group_id", KeyType: "HASH" },
        { AttributeName: "user_id", KeyType: "RANGE" },
      ],
    });
  });

  it("Invites and TmdbCache tables have TTL enabled", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "TestData-Invites",
      TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
    });
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "TestData-TmdbCache",
      TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
    });
  });

  it("Picks table has group-picks-index and round-pick-index GSIs", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "TestData-Picks",
      GlobalSecondaryIndexes: [
        {
          IndexName: "group-picks-index",
          KeySchema: [
            { AttributeName: "group_id", KeyType: "HASH" },
            { AttributeName: "picked_at", KeyType: "RANGE" },
          ],
        },
        {
          IndexName: "round-pick-index",
          KeySchema: [{ AttributeName: "round_id", KeyType: "HASH" }],
        },
      ],
    });
  });
});
