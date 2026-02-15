import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class DataStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly groupsTable: dynamodb.Table;
  public readonly groupMembershipsTable: dynamodb.Table;
  public readonly preferencesTable: dynamodb.Table;
  public readonly invitesTable: dynamodb.Table;
  public readonly roundsTable: dynamodb.Table;
  public readonly suggestionsTable: dynamodb.Table;
  public readonly votesTable: dynamodb.Table;
  public readonly picksTable: dynamodb.Table;
  public readonly ratingsTable: dynamodb.Table;
  public readonly tmdbCacheTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Users
    this.usersTable = new dynamodb.Table(this, "Users", {
      tableName: `${id}-Users`,
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.usersTable.addGlobalSecondaryIndex({
      indexName: "email-index",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
    });
    this.usersTable.addGlobalSecondaryIndex({
      indexName: "parent-index",
      partitionKey: { name: "parent_user_id", type: dynamodb.AttributeType.STRING },
    });

    // 2. Groups
    this.groupsTable = new dynamodb.Table(this, "Groups", {
      tableName: `${id}-Groups`,
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. GroupMemberships
    this.groupMembershipsTable = new dynamodb.Table(this, "GroupMemberships", {
      tableName: `${id}-GroupMemberships`,
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.groupMembershipsTable.addGlobalSecondaryIndex({
      indexName: "user-groups-index",
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
    });

    // 4. Preferences
    this.preferencesTable = new dynamodb.Table(this, "Preferences", {
      tableName: `${id}-Preferences`,
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 5. Invites
    this.invitesTable = new dynamodb.Table(this, "Invites", {
      tableName: `${id}-Invites`,
      partitionKey: { name: "invite_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.invitesTable.addGlobalSecondaryIndex({
      indexName: "token-index",
      partitionKey: { name: "invite_token", type: dynamodb.AttributeType.STRING },
    });
    this.invitesTable.addGlobalSecondaryIndex({
      indexName: "group-invites-index",
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING },
    });

    // 6. Rounds
    this.roundsTable = new dynamodb.Table(this, "Rounds", {
      tableName: `${id}-Rounds`,
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.roundsTable.addGlobalSecondaryIndex({
      indexName: "group-rounds-index",
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING },
    });

    // 7. Suggestions
    this.suggestionsTable = new dynamodb.Table(this, "Suggestions", {
      tableName: `${id}-Suggestions`,
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "tmdb_movie_id", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 8. Votes
    this.votesTable = new dynamodb.Table(this, "Votes", {
      tableName: `${id}-Votes`,
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "vote_key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 9. Picks
    this.picksTable = new dynamodb.Table(this, "Picks", {
      tableName: `${id}-Picks`,
      partitionKey: { name: "pick_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.picksTable.addGlobalSecondaryIndex({
      indexName: "group-picks-index",
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "picked_at", type: dynamodb.AttributeType.STRING },
    });
    this.picksTable.addGlobalSecondaryIndex({
      indexName: "round-pick-index",
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
    });

    // 10. Ratings
    this.ratingsTable = new dynamodb.Table(this, "Ratings", {
      tableName: `${id}-Ratings`,
      partitionKey: { name: "pick_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 11. TmdbCache
    this.tmdbCacheTable = new dynamodb.Table(this, "TmdbCache", {
      tableName: `${id}-TmdbCache`,
      partitionKey: { name: "cache_key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
