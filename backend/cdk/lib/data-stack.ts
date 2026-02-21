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
  public readonly watchlistTable: dynamodb.Table;
  public readonly watchedMoviesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext("env") === "prod";
    const removalPolicy = isProd
      ? cdk.RemovalPolicy.RETAIN
      : cdk.RemovalPolicy.DESTROY;
    const pitr = isProd;

    // Users: PK=user_id, GSI: email-index, parent-index
    this.usersTable = new dynamodb.Table(this, "Users", {
      tableName: `${id}-Users`,
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });
    this.usersTable.addGlobalSecondaryIndex({
      indexName: "email-index",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
    });
    this.usersTable.addGlobalSecondaryIndex({
      indexName: "parent-index",
      partitionKey: {
        name: "parent_user_id",
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Groups: PK=group_id
    this.groupsTable = new dynamodb.Table(this, "Groups", {
      tableName: `${id}-Groups`,
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });

    // GroupMemberships: PK=group_id, SK=user_id, GSI: user-groups-index
    this.groupMembershipsTable = new dynamodb.Table(
      this,
      "GroupMemberships",
      {
        tableName: `${id}-GroupMemberships`,
        partitionKey: {
          name: "group_id",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy,
        pointInTimeRecovery: pitr,
      },
    );
    this.groupMembershipsTable.addGlobalSecondaryIndex({
      indexName: "user-groups-index",
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
    });

    // Preferences: PK=group_id, SK=user_id
    this.preferencesTable = new dynamodb.Table(this, "Preferences", {
      tableName: `${id}-Preferences`,
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });

    // Invites: PK=invite_id, GSI: token-index, group-invites-index, TTL
    this.invitesTable = new dynamodb.Table(this, "Invites", {
      tableName: `${id}-Invites`,
      partitionKey: {
        name: "invite_id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
      timeToLiveAttribute: "ttl",
    });
    this.invitesTable.addGlobalSecondaryIndex({
      indexName: "token-index",
      partitionKey: {
        name: "invite_token",
        type: dynamodb.AttributeType.STRING,
      },
    });
    this.invitesTable.addGlobalSecondaryIndex({
      indexName: "group-invites-index",
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING },
    });

    // Rounds: PK=round_id, GSI: group-rounds-index
    this.roundsTable = new dynamodb.Table(this, "Rounds", {
      tableName: `${id}-Rounds`,
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });
    this.roundsTable.addGlobalSecondaryIndex({
      indexName: "group-rounds-index",
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING },
    });

    // Suggestions: PK=round_id, SK=tmdb_movie_id (Number)
    this.suggestionsTable = new dynamodb.Table(this, "Suggestions", {
      tableName: `${id}-Suggestions`,
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "tmdb_movie_id", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });

    // Votes: PK=round_id, SK=vote_key (composite: {tmdb_movie_id}#{user_id})
    this.votesTable = new dynamodb.Table(this, "Votes", {
      tableName: `${id}-Votes`,
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "vote_key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });

    // Picks: PK=pick_id, GSI: group-picks-index, round-pick-index
    this.picksTable = new dynamodb.Table(this, "Picks", {
      tableName: `${id}-Picks`,
      partitionKey: { name: "pick_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
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

    // Ratings: PK=pick_id, SK=user_id
    this.ratingsTable = new dynamodb.Table(this, "Ratings", {
      tableName: `${id}-Ratings`,
      partitionKey: { name: "pick_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });

    // Watchlist: PK=group_id, SK=tmdb_movie_id (Number)
    this.watchlistTable = new dynamodb.Table(this, "Watchlist", {
      tableName: `${id}-Watchlist`,
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "tmdb_movie_id", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });

    // WatchedMovies: PK=group_id, SK=tmdb_movie_id (Number)
    this.watchedMoviesTable = new dynamodb.Table(this, "WatchedMovies", {
      tableName: `${id}-WatchedMovies`,
      partitionKey: { name: "group_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "tmdb_movie_id", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
    });

    // TmdbCache: PK=cache_key, TTL
    this.tmdbCacheTable = new dynamodb.Table(this, "TmdbCache", {
      tableName: `${id}-TmdbCache`,
      partitionKey: {
        name: "cache_key",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: pitr,
      timeToLiveAttribute: "ttl",
    });
  }
}
