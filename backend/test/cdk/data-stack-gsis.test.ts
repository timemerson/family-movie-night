import { describe, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DataStack } from "../../cdk/lib/data-stack.js";

describe("DataStack GSIs (additional coverage)", () => {
  const app = new cdk.App();
  const stack = new DataStack(app, "GsiData");
  const template = Template.fromStack(stack);

  it("GroupMemberships has user-groups-index GSI", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "GsiData-GroupMemberships",
      GlobalSecondaryIndexes: [
        {
          IndexName: "user-groups-index",
          KeySchema: [{ AttributeName: "user_id", KeyType: "HASH" }],
        },
      ],
    });
  });

  it("Invites has token-index and group-invites-index GSIs", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "GsiData-Invites",
      GlobalSecondaryIndexes: [
        {
          IndexName: "token-index",
          KeySchema: [{ AttributeName: "invite_token", KeyType: "HASH" }],
        },
        {
          IndexName: "group-invites-index",
          KeySchema: [
            { AttributeName: "group_id", KeyType: "HASH" },
            { AttributeName: "created_at", KeyType: "RANGE" },
          ],
        },
      ],
    });
  });

  it("Rounds has group-rounds-index GSI", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "GsiData-Rounds",
      GlobalSecondaryIndexes: [
        {
          IndexName: "group-rounds-index",
          KeySchema: [
            { AttributeName: "group_id", KeyType: "HASH" },
            { AttributeName: "created_at", KeyType: "RANGE" },
          ],
        },
      ],
    });
  });

  it("Votes has composite sort key vote_key", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "GsiData-Votes",
      KeySchema: [
        { AttributeName: "round_id", KeyType: "HASH" },
        { AttributeName: "vote_key", KeyType: "RANGE" },
      ],
    });
  });

  it("Ratings has composite key (pick_id, user_id)", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "GsiData-Ratings",
      KeySchema: [
        { AttributeName: "pick_id", KeyType: "HASH" },
        { AttributeName: "user_id", KeyType: "RANGE" },
      ],
    });
  });
});
